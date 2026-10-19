import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {applyAction,createRoom,joinRoom,roomSettings,snapshot} from '../lib/game.mjs';
import {GameService} from '../lib/service.mjs';
import {BlobStore,PHOTO_PREFIX} from '../lib/blob-store.mjs';
import {fileBlob} from '../scripts/file-blob.mjs';
import {localServer} from '../scripts/server.mjs';
import {photoLink} from '../lib/security.mjs';

const BASE=1900000000000;
const clone=value=>structuredClone(value);
const act=(room,actor,action,data={},now=BASE)=>applyAction(room,actor,action,data,{now,requestId:randomUUID(),random:()=>0.4}).room;
function prepared(remotePlay=true){
  const first=createRoom({name:'author a',cardsPerPlayer:1,settings:{questions:5},now:BASE});
  let room=first.room;const credentials=[first.credentials];
  // Set the new flag directly so a pre-fix run exercises answer visibility,
  // independently of whether creation already understands the new setting.
  room.settings.remotePlay=remotePlay;
  for(const name of ['author b','author c']){const joined=joinRoom(room,name,BASE);room=joined.room;credentials.push(joined.credentials);}
  for(const p of room.players)room=act(room,p.id,'readyLobby',{ready:true});
  room=act(room,room.hostId,'startWriting');
  for(const [i,p]of room.players.entries()){
    const card=room.cards.find(c=>c.authorId===p.id),path=`${room.id}/${p.id}/${card.id}-fixture.png`;
    room=act(room,p.id,'saveCard',{cardId:card.id,text:`private answer ${i}`});
    room=act(room,p.id,'_attachImage',{cardId:card.id,imagePath:path,imageUrl:PHOTO_PREFIX+path});
  }
  for(const p of room.players)room=act(room,p.id,'readyWriting',{ready:true});
  return {room,credentials};
}
function assertHidden(room,view){
  assert.equal(view.turn.card,null,'remote guesser must receive no active card');
  assert.deepEqual(view.ownCards,[]);assert.deepEqual(view.completedCards,[]);
  const body=JSON.stringify(view);
  for(const card of room.cards){assert.ok(!body.includes(card.text));assert.ok(!body.includes(card.imagePath));}
  for(const p of room.players)assert.ok(!body.includes(p.tokenHash));
}

test('remote play is opt-in for new, legacy and existing three-setting rooms',()=>{
  const room=createRoom({name:'host'}).room;
  assert.equal(room.settings.remotePlay,false);assert.equal(snapshot(room,room.hostId).settings.remotePlay,false);
  delete room.settings.remotePlay;assert.equal(roomSettings(room).remotePlay,false);
  delete room.settings;assert.equal(snapshot(room,room.hostId).settings.remotePlay,false);
  assert.equal(Object.hasOwn(room,'settings'),false);
  assert.equal(createRoom({name:'host',settings:{remotePlay:true}}).room.settings.remotePlay,true);
});

test('remote settings are strict, host/lobby-only, atomic, readiness-resetting and preserved by replay',()=>{
  for(const remotePlay of[0,1,'true','false',null,undefined,[],{}])assert.throws(()=>createRoom({name:'host',settings:{remotePlay}}),{code:'BAD_SETTINGS'});
  let room=createRoom({name:'host'}).room;room=joinRoom(room,'guest').room;
  for(const p of room.players)room=act(room,p.id,'readyLobby',{ready:true});
  const original=clone(room),guest=room.players[1].id;
  assert.throws(()=>act(room,guest,'setSettings',{settings:{remotePlay:true}}),{code:'HOST_ONLY'});
  assert.throws(()=>act(room,room.hostId,'setSettings',{settings:{remotePlay:true},cardsPerPlayer:21}),{code:'BAD_COUNT'});
  assert.throws(()=>act(room,room.hostId,'setSettings',{settings:{remotePlay:'true'}}),{code:'BAD_SETTINGS'});
  assert.deepEqual(room,original);
  room=act(room,room.hostId,'setSettings',{settings:{remotePlay:true},cardsPerPlayer:2});
  assert.equal(room.settings.remotePlay,true);assert.equal(room.settings.questions,20);assert.equal(room.cardsPerPlayer,2);assert.ok(room.players.every(p=>!p.ready));
  let active=prepared().room;
  assert.throws(()=>act(active,active.hostId,'setSettings',{settings:{remotePlay:false}}),{code:'ROOM_LOCKED'});
  active=act(active,active.hostId,'reset',{confirm:true});
  assert.equal(active.settings.remotePlay,true);assert.equal(active.phase,'lobby');assert.ok(active.players.every(p=>!p.ready));
});

test('remote snapshots hide every active answer across countdown, questions, pause, resume and referee handoff',()=>{
  let {room}=prepared();
  for(const p of room.players)assert.equal(snapshot(room,p.id).turn.card,null,'waiting stays hidden for everyone');
  const check=now=>{
    const view=snapshot(room,room.turn.playerId,7,now);
    assertHidden(room,view);assert.equal(view.turn.remaining,room.turn.remaining);assert.equal(view.turn.status,room.turn.status);
    for(const p of room.players.filter(p=>p.id!==room.turn.playerId))assert.equal(snapshot(room,p.id,7,now).turn.card.id,room.turn.cardId);
  };
  room=act(room,room.turn.refereeId,'start');check(BASE+1000); // countdown
  room=act(room,room.turn.refereeId,'question',{},BASE+4000);check(BASE+4000);
  room=act(room,room.turn.refereeId,'undoQuestion',{},BASE+4500);check(BASE+4500);
  room=act(room,room.turn.refereeId,'pause',{},BASE+5000);check(BASE+15000);
  room=act(room,room.turn.refereeId,'resume',{},BASE+16000);check(BASE+20000);
  const nextReferee=room.players.find(p=>![room.turn.playerId,room.turn.refereeId].includes(p.id)).id;
  room=act(room,room.turn.refereeId,'setReferee',{playerId:nextReferee},BASE+21000);check(BASE+22000);
});

test('remote success/failure reveals the completed turn, hides the next answer and preserves final scoreboard photos',()=>{
  let {room}=prepared();let now=BASE;
  for(let turn=0;turn<3;turn++){
    assertHidden(room,snapshot(room,room.turn.playerId,turn,now));
    room=act(room,room.turn.refereeId,'start',{},now);
    if(turn===1){for(let i=0;i<5;i++)room=act(room,room.turn.refereeId,'question',{},now+4000+i);}
    room=act(room,room.turn.refereeId,turn===1?'failed':'correct',{},now+5000);
    for(const p of room.players){const view=snapshot(room,p.id,turn,now+5000);assert.equal(view.turn.card.id,room.turn.cardId);assert.ok(view.turn.card.imageUrl);}
    assert.equal(room.results.at(-1).score,turn===1?0:5);
    if(turn<2)room=act(room,room.turn.refereeId,'next',{},now+6000);
    now+=10000;
  }
  for(const p of room.players){const view=snapshot(room,p.id);assert.equal(view.phase,'finished');assert.equal(view.completedCards.length,3);assert.ok(view.completedCards.every(item=>item.card.text&&item.card.imageUrl));}
  room=act(room,room.players[1].id,'reset');assert.equal(room.settings.remotePlay,true);assert.equal(room.generation,2);assert.equal(room.turn,null);
});

test('physical and legacy modes keep the active card visible to the guesser',()=>{
  for(const mode of['false','missing-flag','legacy']){
    let {room}=prepared(false);
    if(mode==='missing-flag')delete room.settings.remotePlay;
    if(mode==='legacy')delete room.settings;
    for(const p of room.players)assert.equal(snapshot(room,p.id).turn.card,null);
    room=act(room,room.turn.refereeId,'start');
    assert.equal(snapshot(room,room.turn.playerId).turn.card.id,room.turn.cardId);
  }
});

class PollStore{
  constructor(room){this.current={id:room.id,revision:8,state:clone(room)};this.people=Object.fromEntries(room.players.map(p=>[p.id,BASE+4000]));}
  async get(){return clone(this.current);}
  async getPoll(id,revision){
    if(revision!==this.current.revision)return this.get();
    const state=clone(this.current.state);for(const field of['cards','assignments','results','requests'])delete state[field];
    return {...clone(this.current),state,compact:true};
  }
  async ping(id,player,now){this.people[player]=now;}
  async presence(){return {...this.people};}
  async cas(row,state){assert.notEqual(row.compact,true);this.current={...row,state:clone(state),revision:row.revision+1};return true;}
}
test('authenticated full, changed-revision, action and compact service responses never leak a remote active answer',async()=>{
  let {room,credentials}=prepared();room=act(room,room.turn.refereeId,'start');
  const store=new PollStore(room),service=new GameService(store,{clock:()=>BASE+4000});
  const guesser=credentials.find(c=>c.playerId===room.turn.playerId);
  assertHidden(room,(await service.state(guesser)).snapshot);
  assertHidden(room,(await service.state({...guesser,knownRevision:7})).snapshot);
  const unchanged=await service.state({...guesser,knownRevision:8});assert.ok(unchanged.unchanged);assert.equal(unchanged.snapshot,undefined);
  for(const card of room.cards){assert.ok(!JSON.stringify(unchanged).includes(card.text));assert.ok(!JSON.stringify(unchanged).includes(card.imagePath));}
  // A guesser who also manages the room still receives a redacted action reply,
  // including a duplicate request that returns the existing committed state.
  store.current.state.hostId=guesser.playerId;
  const request={...guesser,action:'setReferee',data:{playerId:room.turn.refereeId},requestId:randomUUID()};
  assertHidden(room,(await service.action(request)).snapshot);
  assertHidden(room,(await service.action(request)).snapshot);
  await assert.rejects(service.state({...guesser,token:'invalid'}),{code:'UNAUTHORIZED'});
});

test('private HTTP photos reject even valid guesser proofs while active, then reveal completed cards',async t=>{
  const directory=await mkdtemp(join(tmpdir(),'forehead-remote-'));
  const server=localServer({directory});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  t.after(async()=>{await new Promise(resolve=>server.close(resolve));await rm(directory,{recursive:true,force:true});});
  async function post(input,status=200){const response=await fetch(base+'/api/game',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});const result=await response.json();assert.equal(response.status,status);return result;}
  const command=(c,action,data={})=>post({type:'action',...c,action,data,requestId:randomUUID()});
  const first=await post({type:'create',name:'author a',cardsPerPlayer:1,settings:{remotePlay:true}});
  const second=await post({type:'join',name:'author b',code:first.credentials.code}),people=[first,second];
  for(const p of people)await command(p.credentials,'readyLobby',{ready:true});
  await command(first.credentials,'startWriting');
  const bytes=Buffer.from([137,80,78,71,13,10,26,10,1]);
  for(const [i,p]of people.entries()){
    const card=(await post({type:'state',...p.credentials})).snapshot.ownCards[0];
    await command(p.credentials,'saveCard',{cardId:card.id,text:`private HTTP answer ${i}`});
    await post({type:'upload',...p.credentials,cardId:card.id,base64:bytes.toString('base64'),requestId:randomUUID()});
  }
  for(const p of people)await command(p.credentials,'readyWriting',{ready:true});
  const store=new BlobStore({sdk:fileBlob(directory)});let row=await store.get(first.credentials.roomId);
  const guesser=people.find(p=>p.credentials.playerId===row.state.turn.playerId).credentials;
  const referee=people.find(p=>p.credentials.playerId===row.state.turn.refereeId).credentials;
  const path=row.state.cards.find(c=>c.id===row.state.turn.cardId).imagePath;
  const proof=photoLink(row.state,guesser.playerId,path);
  async function photo(url,status,code){const response=await fetch(base+url);assert.equal(response.status,status);if(code)assert.equal((await response.json()).code,code);else assert.deepEqual(Buffer.from(await response.arrayBuffer()),bytes);}
  await photo(proof,403,'PHOTO_HIDDEN'); // waiting
  await command(referee,'start');
  const hidden=(await post({type:'state',...guesser})).snapshot;assert.equal(hidden.turn.card,null);assert.ok(!JSON.stringify(hidden).includes('private HTTP answer'));
  await photo(proof,403,'PHOTO_HIDDEN'); // countdown is already running
  const visible=(await post({type:'state',...referee})).snapshot;assert.ok(visible.turn.card.imageUrl.startsWith('/api/photo?'));await photo(visible.turn.card.imageUrl,200);
  const tampered=new URL(proof,base);tampered.searchParams.set('signature','0'.repeat(64));await photo(tampered.pathname+tampered.search,403,'INVALID_PHOTO');
  await post({type:'state',...guesser,token:'invalid'},401);
  // Move the fixture's server start into the past rather than sleeping. This
  // preserves the real reducer's countdown and photo authorization checks.
  row=await store.get(first.credentials.roomId);const started=clone(row.state);started.turn.startedAt=Date.now()-4000;assert.equal(await store.cas(row,started),true);
  await photo(proof,403,'PHOTO_HIDDEN'); // running after countdown
  await command(referee,'pause');await photo(proof,403,'PHOTO_HIDDEN');
  await command(referee,'resume');await photo(proof,403,'PHOTO_HIDDEN');
  const early=await post({type:'action',...referee,action:'correct',data:{},requestId:randomUUID()},400);assert.equal(early.code,'NOT_RUNNING');
  await new Promise(resolve=>setTimeout(resolve,1100));
  await command(referee,'correct');
  const result=(await post({type:'state',...guesser})).snapshot;assert.ok(result.turn.card.imageUrl);await photo(proof,200);await photo(result.turn.card.imageUrl,200);
  await command(referee,'next');
  row=await store.get(first.credentials.roomId);const nextReferee=people.find(p=>p.credentials.playerId===row.state.turn.refereeId).credentials;
  await command(nextReferee,'start');
  row=await store.get(first.credentials.roomId);const finalTurn=clone(row.state);finalTurn.turn.startedAt=Date.now()-4000;assert.equal(await store.cas(row,finalTurn),true);
  await command(nextReferee,'correct');
  const finished=(await post({type:'state',...guesser})).snapshot;assert.equal(finished.phase,'finished');assert.equal(finished.completedCards.length,2);
  for(const item of finished.completedCards)await photo(item.card.imageUrl,200);
});
