import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { GameService } from '../lib/service.mjs';
import { GameError } from '../lib/game.mjs';

// This adapter is a test fixture; production persists the authoritative phone room in IndexedDB.
class TestStore {
  constructor(){this.rows=new Map();this.people={};this.uploads=new Set();this.deleted=[];this.conflicts=0;}
  async insert(room){await new Promise(resolve=>setImmediate(resolve));if(this.rows.has(room.id))return null;const row={id:room.id,revision:0,state:structuredClone(room)};this.rows.set(room.id,row);return structuredClone(row);}
  async get(id){await new Promise(resolve=>setImmediate(resolve));const row=this.rows.get(id);if(!row)throw new GameError('not found',404,'NOT_FOUND');return structuredClone(row);}
  async byCode(code){const row=[...this.rows.values()].find(r=>r.state.code===code);if(!row)throw new GameError('not found',404,'NOT_FOUND');return this.get(row.id);}
  async cas(row,state){await new Promise(resolve=>setImmediate(resolve));const existing=this.rows.get(row.id);if(existing.revision!==row.revision){this.conflicts++;return false;}this.rows.set(row.id,{id:row.id,revision:row.revision+1,state:structuredClone(state)});return true;}
  async ping(room,player,now){this.people[room]??={};this.people[room][player]=now;}
  async presence(room){return {...this.people[room]};}
  async upload(path){this.uploads.add(path);return `https://test.invalid/${path}`;}
  async removeImages(paths){for(const p of paths){this.uploads.delete(p);this.deleted.push(p);}}
}
const auth=c=>({roomId:c.roomId,playerId:c.playerId,token:c.token});
const identity=()=>({roomId:randomUUID(),playerId:randomUUID(),token:'x'.repeat(32)});
const command=(service,c,action,data={})=>service.action({...auth(c),action,data,requestId:randomUUID().replaceAll('-','')});

test('create and join survive retry after a lost response without duplicate players',async()=>{
  const storage=new TestStore(),service=new GameService(storage);
  const first={name:'رامین',cardsPerPlayer:1,...identity()};
  const a=await service.create(first),again=await service.create(first);assert.equal(a.credentials.roomId,again.credentials.roomId);assert.equal(storage.rows.size,1);
  const second={name:'میلاد',code:a.credentials.code,...identity()};delete second.roomId;
  const b=await service.join(second),retry=await service.join(second);assert.equal(b.credentials.playerId,retry.credentials.playerId);
  assert.equal(retry.snapshot.players.length,2);
});
test('simultaneous joins and ready commands preserve every participant via CAS',async()=>{
  const storage=new TestStore(),service=new GameService(storage);const created=await service.create({name:'رامین',cardsPerPlayer:1});
  const joined=await Promise.all(['مهسا','میلاد','امین'].map(name=>service.join({name,code:created.credentials.code,...identity()})));
  const people=[created,...joined];await Promise.all(people.map(p=>command(service,p.credentials,'readyLobby',{ready:true})));
  const latest=await service.state(auth(created.credentials));assert.equal(latest.snapshot.players.length,4);assert.ok(latest.snapshot.players.every(p=>p.ready));assert.ok(storage.conflicts>0);
});
test('simultaneous duplicate scoring requests commit one result and authoritative score',async()=>{
  const storage=new TestStore();let now=Date.now();const service=new GameService(storage,{clock:()=>now});
  const a=await service.create({name:'a',cardsPerPlayer:1});const b=await service.join({name:'b',code:a.credentials.code});
  const players=[a,b];for(const p of players)await command(service,p.credentials,'readyLobby',{ready:true});await command(service,a.credentials,'startWriting');
  for(const p of players){const snap=(await service.state(auth(p.credentials))).snapshot;await command(service,p.credentials,'readyWriting',{ready:true,cards:snap.ownCards.map(c=>({id:c.id,text:`card ${p.credentials.playerId}`}))});}
  const snap=(await service.state(auth(a.credentials))).snapshot;const ref=players.find(p=>p.credentials.playerId===snap.turn.refereeId).credentials;
  await command(service,ref,'start');now+=4000;await command(service,ref,'question');
  const request={...auth(ref),action:'correct',data:{turnId:snap.turn.id},requestId:'exactly_once_scoring'};
  await Promise.all([service.action(request),service.action(request),service.action(request)]);
  const row=await storage.get(a.credentials.roomId);assert.equal(row.state.results.length,1);assert.equal(row.state.results[0].score,19);
});
test('image retry keeps the committed photo and reset cleans uploaded images',async()=>{
  const storage=new TestStore(),service=new GameService(storage);const a=await service.create({name:'a',cardsPerPlayer:1});const b=await service.join({name:'b',code:a.credentials.code});
  for(const p of [a,b])await command(service,p.credentials,'readyLobby',{ready:true});const writing=await command(service,a.credentials,'startWriting');
  const data={...auth(a.credentials),cardId:writing.snapshot.ownCards[0].id,requestId:'same_upload_request',base64:Buffer.from([137,80,78,71,13,10,26,10,1]).toString('base64')};
  await Promise.all([service.upload(data),service.upload(data)]);await service.upload(data);
  assert.equal(storage.uploads.size,1);
  const current=await storage.get(a.credentials.roomId);
  assert.ok(storage.uploads.has(current.state.cards.find(c=>c.id===data.cardId).imagePath));
  await command(service,a.credentials,'reset',{confirm:true});assert.equal(storage.uploads.size,0);
});
test('invalid credentials cannot change a real service room',async()=>{
  const service=new GameService(new TestStore());const a=await service.create({name:'a'});
  await assert.rejects(()=>service.action({...auth(a.credentials),token:'wrong',action:'setCount',data:{count:20},requestId:'invalid_credentials'}),{code:'UNAUTHORIZED'});
  const current=await service.state(auth(a.credentials));assert.equal(current.snapshot.cardsPerPlayer,3);
});
