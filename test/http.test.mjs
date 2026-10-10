import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {localServer} from '../scripts/server.mjs';
import {fileBlob} from '../scripts/file-blob.mjs';
import {BlobStore} from '../lib/blob-store.mjs';
import {GameService} from '../lib/service.mjs';

async function fixture(t) {
  const directory=await mkdtemp(join(tmpdir(),'forehead-server-'));
  let server,base;
  async function start() { server=localServer({directory});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base=`http://127.0.0.1:${server.address().port}`; }
  await start();t.after(async()=>{await new Promise(resolve=>server.close(resolve));await rm(directory,{recursive:true,force:true});});
  async function post(body,expected=200) {const response=await fetch(base+'/api/game',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const result=await response.json();assert.equal(response.status,expected,JSON.stringify(result));return result;}
  const action=(c,action,data={},expected=200)=>post({type:'action',...c,action,data,requestId:randomUUID()},expected);
  const state=c=>post({type:'state',...c});
  const create=()=>post({type:'create',name:'رامین',cardsPerPlayer:1,roomId:randomUUID(),playerId:randomUUID(),token:'a'.repeat(32)});
  return {post,action,state,create,base:()=>base,restart:async()=>{await new Promise(resolve=>server.close(resolve));await start();}};
}
async function writing(f) {
  const a=await f.create(),b=await f.post({type:'join',code:a.credentials.code,name:'امین'});
  for(const p of [a,b])await f.action(p.credentials,'readyLobby',{ready:true});
  await f.action(a.credentials,'startWriting');return [a,b];
}
test('HTTP rooms survive a fresh server, and guest cards save without any creator connection',async t=>{
  const f=await fixture(t),[a,b]=await writing(f);await f.restart();
  const card=(await f.state(b.credentials)).snapshot.ownCards[0];
  await f.action(b.credentials,'saveCard',{cardId:card.id,text:'میلاد'});await f.restart();
  const restored=await f.state(b.credentials);assert.equal(restored.snapshot.ownCards[0].text,'میلاد');assert.equal(restored.snapshot.players.length,2);
  assert.equal((await f.state(a.credentials)).snapshot.phase,'writing');
});
test('independent HTTP requests preserve concurrent joins, ready flags and authors',async t=>{
  const f=await fixture(t),a=await f.create();
  const guests=await Promise.all(['امین','میلاد','مهسا','حبیب','مریم','رضا','علی','ندا','الهام','سارا','آرش'].map(name=>f.post({type:'join',code:a.credentials.code,name})));
  const people=[a,...guests];await Promise.all(people.map(p=>f.action(p.credentials,'readyLobby',{ready:true})));
  const all=await f.state(a.credentials);assert.equal(all.snapshot.players.length,12);assert.ok(all.snapshot.players.every(p=>p.ready));
  await f.action(a.credentials,'startWriting');
  await Promise.all(people.map(async p=>{const s=(await f.state(p.credentials)).snapshot;await f.action(p.credentials,'saveCard',{cardId:s.ownCards[0].id,text:p.credentials.playerId});}));
  for(const p of people)assert.equal((await f.state(p.credentials)).snapshot.ownCards[0].text,p.credentials.playerId);
});
test('private HTTP photos survive server restart and future photos are hidden from other authors',async t=>{
  const f=await fixture(t),[a,b]=await writing(f),card=(await f.state(b.credentials)).snapshot.ownCards[0];
  const bytes=Buffer.from([137,80,78,71,13,10,26,10,1]);
  const photo=await f.post({type:'upload',...b.credentials,cardId:card.id,base64:bytes.toString('base64'),requestId:randomUUID()});
  const url=photo.snapshot.ownCards[0].imageUrl;assert.ok(url.startsWith('/api/photo?'));await f.restart();
  const response=await fetch(f.base()+url);assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'image/png');assert.deepEqual(Buffer.from(await response.arrayBuffer()),bytes);
  const params=new URL(url,'http://localhost').searchParams;params.set('playerId',a.credentials.playerId);params.set('token',a.credentials.token);
  const hidden=await fetch(f.base()+'/api/photo?'+params);assert.equal(hidden.status,403);assert.equal((await hidden.json()).code,'PHOTO_HIDDEN');
});
test('creator can leave a lobby without closing it; the remaining manager can admit another guest',async t=>{
  const f=await fixture(t),a=await f.create(),b=await f.post({type:'join',code:a.credentials.code,name:'امین'});
  assert.equal((await f.action(a.credentials,'leave')).left,true);
  const remaining=(await f.state(b.credentials)).snapshot;assert.equal(remaining.players.length,1);assert.equal(remaining.hostId,b.credentials.playerId);
  const c=await f.post({type:'join',code:a.credentials.code,name:'میلاد'});assert.equal(c.snapshot.players.length,2);
});
test('closed HTTP rooms and invalid session/photo credentials stay rejected after a new server',async t=>{
  const f=await fixture(t),a=await f.create();
  await f.post({type:'state',...a.credentials,token:'invalid'},401);
  await f.action(a.credentials,'closeRoom');await f.restart();
  assert.equal((await f.post({type:'state',...a.credentials},410)).code,'ROOM_CLOSED');
  assert.equal((await f.post({type:'join',code:a.credentials.code,name:'امین'},410)).code,'ROOM_CLOSED');
});
test('a lost room-upload response does not delete the committed lobby code',async t=>{
  const directory=await mkdtemp(join(tmpdir(),'forehead-lost-response-'));t.after(()=>rm(directory,{recursive:true,force:true}));
  const disk=fileBlob(directory);let dropped=false;
  const sdk={...disk,put:async(path,bytes,options)=>{const result=await disk.put(path,bytes,options);if(path.includes('/rooms/')&&!dropped){dropped=true;throw Error('Room committed; response lost');}return result;}};
  const input={name:'رامین',cardsPerPlayer:1,roomId:randomUUID(),playerId:randomUUID(),token:'a'.repeat(32)};
  await assert.rejects(()=>new GameService(new BlobStore({sdk})).create(input),/response lost/);
  const service=new GameService(new BlobStore({sdk:disk})),restored=await service.create(input);
  const guest=await service.join({name:'امین',code:restored.credentials.code});assert.equal(guest.snapshot.players.length,2);
});
