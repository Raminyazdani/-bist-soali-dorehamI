import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {localServer} from '../scripts/server.mjs';

const png = Buffer.from([137,80,78,71,13,10,26,10,1]);
async function fixture(t, importer) {
  const directory = await mkdtemp(join(tmpdir(), 'forehead-import-http-'));
  const server = localServer({directory, imageImporter: importer});
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { await new Promise(resolve => server.close(resolve)); await rm(directory, {recursive:true, force:true}); });
  const base = `http://127.0.0.1:${server.address().port}`;
  async function post(path, body, headers={}) {
    return fetch(base+path, {method:'POST', headers:{'Content-Type':'application/json', ...headers}, body:JSON.stringify(body)});
  }
  async function game(data) { const res=await post('/api/game',data), body=await res.json(); assert.equal(res.status,200,JSON.stringify(body)); return body; }
  const action=(c,action,data={})=>game({type:'action',...c,action,data,requestId:randomUUID()});
  const a=await game({type:'create',name:'رامین',cardsPerPlayer:1});
  const b=await game({type:'join',code:a.credentials.code,name:'امین'});
  for(const p of[a,b])await action(p.credentials,'readyLobby',{ready:true});
  const started=await action(a.credentials,'startWriting');
  const own=started.snapshot.ownCards[0];
  const payload={...a.credentials,cardId:own.id,generation:started.snapshot.generation,url:'https://example.com/friend.png',requestId:randomUUID()};
  return {base,post,game,action,a,b,payload,importPhoto:(patch={},headers={})=>post('/api/image-import',{...payload,...patch},headers)};
}

test('image import authenticates membership, ownership, origin and editing before any outbound request',async t=>{
  const calls=[];
  const f=await fixture(t,async(url,options)=>{calls.push({url,options});return {bytes:png,contentType:'image/png'};});
  for(const [patch,headers,status,code] of[
    [{token:'wrong'}, {},401,'UNAUTHORIZED'],
    [{playerId:randomUUID()}, {},401,'UNAUTHORIZED'],
    [{...f.b.credentials}, {},400,'NOT_YOUR_CARD'],
    [{generation:999}, {},400,'STALE_GAME'],
    [{requestId:'bad'}, {},400,'BAD_REQUEST_ID'],
    [{roomId:[]}, {},400,'BAD_ID'],
    [{}, {Origin:'https://other.invalid'},403,'ORIGIN']
  ]) {
    const res=await f.importPhoto(patch,headers);assert.equal(res.status,status);
    assert.equal((await res.json()).code,code);assert.equal(calls.length,0);
  }
  const response=await f.importPhoto({roomId:f.payload.roomId.toUpperCase(),playerId:f.payload.playerId.toUpperCase()});
  assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'image/png');
  assert.equal(response.headers.get('cache-control'),'private, no-store');assert.equal(response.headers.get('x-content-type-options'),'nosniff');
  assert.deepEqual(Buffer.from(await response.arrayBuffer()),png);assert.equal(calls.length,1);
  assert.equal(calls[0].options.maxBytes,3*1024*1024);
  const before=(await f.game({type:'state',...f.a.credentials})).snapshot;
  assert.equal(before.ownCards[0].imageUrl,null,'import alone does not attach or hotlink a card');
  await f.action(f.a.credentials,'saveCard',{cardId:f.payload.cardId,text:'امین'});
  await f.action(f.a.credentials,'readyWriting',{ready:true});
  const locked=await f.importPhoto();assert.equal(locked.status,400);assert.equal((await locked.json()).code,'CARDS_LOCKED');assert.equal(calls.length,1);
});

test('an import racing readiness or game reset never returns bytes authorized by stale room state',async t=>{
  let onFetch=async()=>{};
  const f=await fixture(t,async()=>{await onFetch();return {bytes:png,contentType:'image/png'};});
  await f.action(f.a.credentials,'saveCard',{cardId:f.payload.cardId,text:'امین'});
  onFetch=()=>f.action(f.a.credentials,'readyWriting',{ready:true});
  let res=await f.importPhoto();assert.equal(res.status,400);assert.equal((await res.json()).code,'CARDS_LOCKED');
  await f.action(f.a.credentials,'readyWriting',{ready:false});
  onFetch=()=>f.action(f.a.credentials,'reset',{confirm:true});
  res=await f.importPhoto();assert.equal(res.status,400);assert.equal((await res.json()).code,'STALE_GAME');
});

test('repeated import IDs still consume durable fetch quota and respect Retry-After',async t=>{
  let calls=0;
  const f=await fixture(t,async()=>{calls++;return {bytes:png,contentType:'image/png'};});
  for(let i=0;i<20;i++){const response=await f.importPhoto();assert.equal(response.status,200);await response.arrayBuffer();}
  const response=await f.importPhoto();assert.equal(response.status,429);assert.equal((await response.json()).code,'RATE_LIMIT');
  assert.ok(Number(response.headers.get('retry-after'))>0);assert.equal(calls,20);
});
