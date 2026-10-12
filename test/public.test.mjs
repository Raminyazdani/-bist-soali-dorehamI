import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,utimes} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {BlobStore} from '../lib/blob-store.mjs';
import {fileBlob} from '../scripts/file-blob.mjs';
import {createRoom} from '../lib/game.mjs';
import {photoLink,verifyPhoto} from '../lib/security.mjs';
import {gameRequest} from '../lib/http.mjs';
import {BlobError} from '@vercel/blob';

async function disk(t){
  const directory=await mkdtemp(join(tmpdir(),'forehead-public-'));t.after(()=>rm(directory,{recursive:true,force:true}));
  return {directory,sdk:fileBlob(directory)};
}
test('photo proofs expire, resist changes and cannot be reused after a fresh game',()=>{
  const now=Date.now(),{room,credentials}=createRoom({name:'رامین',now});
  const params=new URL(photoLink(room,credentials.playerId,'card.png',now),'https://example.invalid').searchParams;
  assert.equal(verifyPhoto(room,params,now),credentials.playerId);assert.ok(!params.has('token'));
  const changed=new URLSearchParams(params);changed.set('path','another.png');assert.throws(()=>verifyPhoto(room,changed,now),{code:'INVALID_PHOTO'});
  assert.throws(()=>verifyPhoto(room,params,Number(params.get('expires'))),{code:'INVALID_PHOTO'});
  assert.throws(()=>verifyPhoto({...room,generation:room.generation+1},params,now),{code:'INVALID_PHOTO'});
  assert.throws(()=>verifyPhoto({...room,players:[]},params,now),{code:'INVALID_PHOTO'});
});
test('concurrent quotas persist across store instances, recover retries and open the next window',async t=>{
  const {sdk}=await disk(t),now=Date.now(),limit=(id,time=now)=>new BlobStore({sdk}).limit('same-address',3,600000,id,time);
  const results=await Promise.allSettled(Array.from({length:8},(_,i)=>limit(String(i))));
  assert.equal(results.filter(r=>r.status==='fulfilled').length,3);
  assert.ok(results.filter(r=>r.status==='rejected').every(r=>r.reason.code==='RATE_LIMIT'&&r.reason.retryAfter>0));
  const accepted=results.findIndex(r=>r.status==='fulfilled');await limit(String(accepted));await assert.rejects(()=>limit('new'),{code:'RATE_LIMIT'});
  await limit('new',Math.floor(now/600000)*600000+600000);
});
test('cleanup removes expired rooms, their codes, photos and quotas while preserving live games',async t=>{
  const {sdk,directory}=await disk(t),store=new BlobStore({sdk}),now=Date.now();
  const expired=createRoom({name:'گذشته',now:now-25*3600000,code:'123456'}).room;
  const live=createRoom({name:'امروز',now,code:'654321'}).room;
  await store.insert(expired);await store.insert(live);
  const expiredPhoto=`${expired.id}/old.png`,livePhoto=`${live.id}/live.png`,orphanPhoto='missing-room/orphan.png';
  for(const path of [expiredPhoto,livePhoto,orphanPhoto])await store.upload(path,Buffer.from([137,80,78,71]),'image/png');
  await utimes(join(directory,'forehead-v3/photos',orphanPhoto),new Date(now-3600000),new Date(now-3600000));
  await store.write('codes/999999.json',{id:'pending-reservation'});
  await store.limit('old-address',3,600000,'old',now-3600000);await store.limit('live-address',3,600000,'live',now);
  const result=await store.cleanup(now+1000);assert.ok(result.removed>=4);
  assert.equal(await store.read(`rooms/${expired.id}.json`),null);assert.equal(await store.read('codes/123456.json'),null);assert.equal(await store.photo(expiredPhoto),null);assert.equal(await store.photo(orphanPhoto),null);
  assert.ok(await store.read(`rooms/${live.id}.json`));assert.ok(await store.read('codes/654321.json'));assert.ok(await store.photo(livePhoto));assert.ok(await store.read('codes/999999.json'));
  const limits=await store.list('limits/');assert.equal(limits.blobs.length,1);
});
test('cleanup conditional deletion preserves a room extended by another request and its photo',async t=>{
  const {sdk}=await disk(t),now=Date.now();const room=createRoom({name:'رامین',now:now-25*3600000}).room;
  const store=new BlobStore({sdk});await store.insert(room);await store.upload(`${room.id}/keep.png`,Buffer.from('photo'),'image/png');
  let raced=false;
  const concurrent={...sdk,del:async(path,options)=>{
    if(String(path).includes('/rooms/')&&!raced){raced=true;const fresh=new BlobStore({sdk}),row=await fresh.get(room.id);await fresh.cas(row,{...row.state,expiresAt:now+3600000});}
    return sdk.del(path,options);
  }};
  await new BlobStore({sdk:concurrent}).cleanup(now);assert.ok(raced);assert.ok(await store.read(`rooms/${room.id}.json`));assert.ok(await store.photo(`${room.id}/keep.png`));
});
test('an unconfigured deployment reports an honest setup error before any storage request',async()=>{
  const headers={};let value;
  const response={setHeader:(key,v)=>headers[key]=v,end:body=>value=JSON.parse(body)};
  await gameRequest({method:'POST',headers:{host:'example.invalid','content-type':'application/json'},body:{type:'config'}},response,{configured:()=>false});
  assert.equal(response.statusCode,503);assert.equal(value.code,'SERVICE_NOT_CONFIGURED');assert.equal(headers['Cache-Control'],'no-store');
});

test('large mutable JSON reads preserve an atomic strong ETag and reject stale writes',async t=>{
  const {sdk}=await disk(t);
  const room=createRoom({name:'رامین',code:'123456'}).room;
  room.requests=Array.from({length:250},(_,i)=>`${room.creatorId}:large_request_${i}`);
  assert.ok(Buffer.byteLength(JSON.stringify(room))>6000);
  // The hosted provider weakens the ETag of compressed JSON. An uncoded
  // response returns the exact stored body and its conditional-write version.
  const provider={...sdk,get:async(name,options={})=>{
    const result=await sdk.get(name);if(!result)return null;
    const bytes=Buffer.from(await new Response(result.stream).arrayBuffer());
    const compressed=bytes.length>6000&&new Headers(options.headers).get('accept-encoding')!=='identity';
    return {...result,stream:new Response(bytes).body,blob:{...result.blob,etag:compressed?`W/"${result.blob.etag}"`:result.blob.etag}};
  }};
  await new BlobStore({sdk:provider}).insert(room);
  const firstStore=new BlobStore({sdk:provider}),secondStore=new BlobStore({sdk:provider});
  const first=await firstStore.get(room.id),stale=await secondStore.get(room.id);
  assert.deepEqual(first.state,room);
  assert.equal(await firstStore.cas(first,{...first.state,cardsPerPlayer:2}),true,'the body version must be usable for a conditional write');
  assert.equal(await secondStore.cas(stale,{...stale.state,cardsPerPlayer:3}),false,'a concurrent write must still invalidate the old body version');
  const latest=await secondStore.get(room.id);
  assert.equal(latest.state.cardsPerPlayer,2);assert.equal(latest.revision,1);
  assert.equal(await secondStore.cas(latest,{...latest.state,players:latest.state.players.map(player=>({...player,ready:true}))}),true);
  const committed=await new BlobStore({sdk:provider}).get(room.id);
  assert.equal(committed.state.cardsPerPlayer,2);assert.equal(committed.state.players[0].ready,true);assert.equal(committed.revision,2);
  assert.deepEqual(committed.state.requests,room.requests);
});

test('unexpected backend diagnostics identify SDK failures without exposing messages or unsafe fields',async t=>{
  const logs=[];t.mock.method(console,'error',(...values)=>logs.push(values));
  const failure=new BlobError('Failed to fetch blob: 502 Bad Gateway https://private.invalid/token=secret');
  Object.assign(failure,{code:'UND_ERR_SOCKET',cause:{code:'UND_ERR_CONNECT_TIMEOUT'}});
  const response={setHeader(){},end(){}};
  const request={method:'POST',headers:{host:'example.invalid','content-type':'application/json'},body:{type:'state'}};
  await gameRequest(request,response,{configured:()=>true,get:async()=>{throw failure;}});
  assert.equal(response.statusCode,503);
  assert.deepEqual(logs[0],['Game backend:',{kind:'BlobError',code:'UND_ERR_SOCKET',causeCode:'UND_ERR_CONNECT_TIMEOUT',httpStatus:502}]);
  const unsafe=Object.assign(new Error('private-room-and-token'),{code:'https://private.invalid/token=secret',cause:{code:'token=secret'}});
  await gameRequest(request,response,{configured:()=>true,get:async()=>{throw unsafe;}});
  assert.deepEqual(logs[1],['Game backend:',{kind:'Error',code:'',causeCode:''}]);
  assert.ok(!JSON.stringify(logs).includes('secret'));
});
