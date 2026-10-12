import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, createRoom, joinRoom } from '../lib/game.mjs';
import { GameService } from '../lib/service.mjs';

const BASE=1900000000000,NOW=BASE+100000;
const clone=value=>structuredClone(value);

function gameFixture() {
  const first=createRoom({name:'author a',cardsPerPlayer:2,settings:{autoPause:true},now:BASE});
  let room=first.room;const credentials=[first.credentials];
  for(const name of ['author b','author c']){const joined=joinRoom(room,name,BASE);room=joined.room;credentials.push(joined.credentials);}
  let sequence=0;
  const act=(actor,action,data={},now=BASE)=>{
    room=applyAction(room,actor,action,data,{now,requestId:`poll_fixture_${++sequence}`,random:()=>0.4}).room;
  };
  for(const player of room.players)act(player.id,'readyLobby',{ready:true});
  act(room.hostId,'startWriting');
  for(const player of room.players){
    const own=room.cards.filter(c=>c.authorId===player.id).map((c,i)=>({id:c.id,text:`private future text ${player.name} ${i}`}));
    act(player.id,'readyWriting',{ready:true,cards:own});
  }
  act(room.turn.refereeId,'start');act(room.turn.refereeId,'question',{},BASE+4000);
  act(room.turn.refereeId,'correct',{},BASE+5000);act(room.turn.refereeId,'next',{},BASE+6000);
  act(room.turn.refereeId,'start',{},BASE+6000);
  const row={id:room.id,revision:41,state:room};
  const spectator=credentials.find(c=>c.playerId!==room.turn.playerId&&c.playerId!==room.turn.refereeId);
  const data={roomId:row.id,playerId:spectator.playerId,token:spectator.token,knownRevision:41};
  return {row,data,credentials};
}

// This explicit server-only fixture deliberately cannot be passed to a reducer:
// card bodies, request history, assignments and results do not exist in it.
function compactFixture(row) {
  return {id:row.id,revision:row.revision,compact:true,state:{
    expiresAt:row.state.expiresAt,phase:row.state.phase,generation:row.state.generation,settings:clone(row.state.settings),
    players:row.state.players.map(p=>({id:p.id,tokenHash:p.tokenHash,joinedAt:p.joinedAt})),
    turn:{status:row.state.turn.status,playerId:row.state.turn.playerId,refereeId:row.state.turn.refereeId}
  }};
}

class PollStore {
  constructor(row,pollAnswer=compactFixture(row)) {
    this.current=clone(row);this.pollAnswer=clone(pollAnswer);this.events=[];
    this.people=Object.fromEntries(row.state.players.map(p=>[p.id,NOW]));
  }
  async getPoll(id,revision){this.events.push({kind:'getPoll',id,revision});return clone(this.pollAnswer);}
  async get(id){this.events.push({kind:'get',id});if(this.onGet)await this.onGet();return clone(this.current);}
  async ping(id,player,now){this.events.push({kind:'ping',id,player,now});this.people[player]=now;if(this.onPing)await this.onPing();}
  async presence(id){this.events.push({kind:'presence',id});return {...this.people};}
  async cas(row,state){
    this.events.push({kind:'cas',row:clone(row),state:clone(state)});
    assert.notEqual(row.compact,true,'compact rows must never authorize a write');
    for(const field of ['cards','assignments','results','requests'])assert.ok(Object.hasOwn(state,field),`CAS lost full ${field}`);
    this.current={id:row.id,revision:row.revision+1,state:clone(state)};return true;
  }
}

function finishedFixture(row) {
  let room=clone(row.state),now=NOW-60000,sequence=0;
  const act=action=>{room=applyAction(room,room.turn.refereeId,action,{}, {now,requestId:`finished_poll_${++sequence}`}).room;};
  while(room.phase==='playing'){
    if(room.turn.status==='waiting'){act('start');now+=4000;}
    act('correct');if(room.phase==='playing')act('next');now+=5000;
  }
  return {id:row.id,revision:row.revision+1,state:room};
}

test('unchanged compact polls still authenticate, refresh presence and expose only public online metadata',async()=>{
  const {row,data}=gameFixture(),store=new PollStore(row),service=new GameService(store,{clock:()=>NOW});
  store.people[data.playerId]=NOW-30000;
  const result=await service.state(data);
  assert.equal(result.snapshot,undefined);assert.equal(result.unchanged.revision,41);
  assert.equal(result.unchanged.players.find(p=>p.id===data.playerId).online,true);
  assert.deepEqual(store.events.map(e=>e.kind),['getPoll','ping','presence']);
  assert.equal(store.events[1].now,NOW);
  assert.deepEqual(Object.keys(result.unchanged).sort(),['generation','id','players','refereeOnline','revision','serverNow','you']);
  assert.equal(result.unchanged.refereeOnline,true);
  for(const player of result.unchanged.players)assert.deepEqual(Object.keys(player).sort(),['id','online']);
  const body=JSON.stringify(result);
  for(const player of row.state.players)assert.ok(!body.includes(player.tokenHash));
  for(const card of row.state.cards)assert.ok(!body.includes(card.text)&&!body.includes(card.id));
  for(const field of ['assignments','requests','results','tokenHash','imagePath'])assert.ok(!body.includes(field));
  assert.ok(Buffer.byteLength(body)<1000);
});

test('bad credentials, removed players and expired compact polls fail before heartbeat or writes',async()=>{
  for(const scenario of ['wrong-token','removed','expired','closed']){
    const {row,data}=gameFixture(),compact=compactFixture(row);
    if(scenario==='wrong-token')data.token='wrong-token';
    if(scenario==='removed')compact.state.players=compact.state.players.filter(p=>p.id!==data.playerId);
    if(scenario==='expired')compact.state.expiresAt=NOW;
    if(scenario==='closed')compact.state.phase='closed';
    const store=new PollStore(row,compact),service=new GameService(store,{clock:()=>NOW});
    await assert.rejects(service.state(data),{code:scenario==='expired'?'EXPIRED':scenario==='closed'?'ROOM_CLOSED':'UNAUTHORIZED'});
    assert.deepEqual(store.events.map(e=>e.kind),['getPoll']);
  }
});

test('a changed revision returns a full visible snapshot rather than unchanged metadata',async()=>{
  const {row,data}=gameFixture();data.knownRevision=40;
  const store=new PollStore(row,row),service=new GameService(store,{clock:()=>NOW}),result=await service.state(data);
  assert.equal(result.unchanged,undefined);assert.equal(result.snapshot.revision,41);
  assert.equal(result.snapshot.turn.card.id,row.state.turn.cardId);assert.equal(result.snapshot.scores.reduce((n,p)=>n+p.completed,0),1);
  assert.equal(store.events[0].revision,40);
});

test('a disconnected compact turn loads and authenticates a complete body before auto-pause CAS',async()=>{
  const {row,data}=gameFixture(),store=new PollStore(row),service=new GameService(store,{clock:()=>NOW});
  store.people[row.state.turn.playerId]=NOW-20001;
  const result=await service.state(data),write=store.events.find(e=>e.kind==='cas');
  assert.deepEqual(store.events.map(e=>e.kind),['getPoll','ping','presence','get','presence','cas']);
  assert.ok(write);assert.equal(result.snapshot.turn.status,'paused');assert.equal(result.snapshot.turn.pauseReason,'connection');
  assert.equal(result.snapshot.revision,42);assert.equal(result.unchanged,undefined);
  assert.deepEqual(write.state.cards,row.state.cards);assert.deepEqual(write.state.assignments,row.state.assignments);
  assert.deepEqual(write.state.results,row.state.results);assert.deepEqual(write.state.requests.slice(0,-1),row.state.requests);
  assert.deepEqual(write.state.order,row.state.order);assert.equal(write.state.generation,row.state.generation);
});

test('a game ending between compact and full reads returns the finished game without an invalid auto-pause',async()=>{
  const {row,data}=gameFixture(),finished=finishedFixture(row),store=new PollStore(row),service=new GameService(store,{clock:()=>NOW});
  store.people[row.state.turn.refereeId]=NOW-20001;store.onGet=()=>{store.current=clone(finished);};
  const result=await service.state(data);
  assert.equal(result.snapshot.phase,'finished');assert.equal(result.snapshot.revision,42);
  assert.equal(result.snapshot.completedCards.length,6);assert.equal(store.events.filter(e=>e.kind==='cas').length,0);
  assert.equal(store.events.filter(e=>e.kind==='get').length,1);
});

test('membership is rechecked after a compact disconnect poll loads the fresh full room',async()=>{
  const {row,data}=gameFixture(),store=new PollStore(row),service=new GameService(store,{clock:()=>NOW});
  store.people[row.state.turn.playerId]=NOW-20001;
  store.onGet=()=>{store.current.state.players=store.current.state.players.filter(p=>p.id!==data.playerId);};
  await assert.rejects(service.state(data),{code:'UNAUTHORIZED'});
  assert.equal(store.events.filter(e=>e.kind==='get').length,1);assert.equal(store.events.filter(e=>e.kind==='cas').length,0);
});

test('an auto-pause CAS conflict returns the latest full finished room without overwriting it',async()=>{
  const {row,data}=gameFixture(),finished=finishedFixture(row),store=new PollStore(row),service=new GameService(store,{clock:()=>NOW});
  store.people[row.state.turn.playerId]=NOW-20001;
  store.cas=async(source,attempt)=>{
    assert.notEqual(source.compact,true);assert.deepEqual(attempt.cards,row.state.cards);
    store.events.push({kind:'cas-conflict'});store.current=clone(finished);return false;
  };
  const result=await service.state(data);
  assert.equal(result.snapshot.phase,'finished');assert.equal(result.snapshot.completedCards.length,6);
  assert.equal(result.snapshot.revision,finished.revision);assert.deepEqual(store.current,finished);
  assert.equal(store.events.filter(e=>e.kind==='get').length,2);assert.equal(store.events.filter(e=>e.kind==='cas-conflict').length,1);
});

test('legacy adapters and missing or invalid known revisions still use full state reads',async()=>{
  for(const knownRevision of [undefined,-1,1.5,'41',Number.NaN]){
    const {row,data}=gameFixture(),store=new PollStore(row),service=new GameService(store,{clock:()=>NOW});
    data.knownRevision=knownRevision;const result=await service.state(data);
    assert.ok(result.snapshot);assert.equal(store.events[0].kind,'get');
  }
  const {row,data}=gameFixture(),store=new PollStore(row);store.getPoll=undefined;
  assert.ok((await new GameService(store,{clock:()=>NOW}).state(data)).snapshot);
  assert.equal(store.events[0].kind,'get');
});

test('a heartbeat that yields a fresh complete revision returns its full snapshot',async()=>{
  const {row,data}=gameFixture(),store=new PollStore(row),service=new GameService(store,{clock:()=>NOW}),fresh=clone(row);
  fresh.revision=42;fresh.state.players.find(p=>p.id===data.playerId).name='fresh public name';
  store.rows=new Map();store.onPing=()=>store.rows.set(row.id,fresh);
  const result=await service.state(data);
  assert.equal(result.unchanged,undefined);assert.equal(result.snapshot.revision,42);
  assert.equal(result.snapshot.players.find(p=>p.id===data.playerId).name,'fresh public name');
  assert.equal(store.events.filter(e=>e.kind==='get').length,0);assert.equal(store.events.filter(e=>e.kind==='cas').length,0);
});

test('disabled auto-pause compact polling reports confirmed referee absence without reading or writing a full room',async()=>{
  const {row,data}=gameFixture();row.state.settings.autoPause=false;
  const store=new PollStore(row),service=new GameService(store,{clock:()=>NOW});
  store.people[row.state.turn.playerId]=NOW-60000;store.people[row.state.turn.refereeId]=NOW-20001;
  const result=await service.state(data);
  assert.equal(result.unchanged.refereeOnline,false);assert.equal(result.snapshot,undefined);
  assert.deepEqual(store.events.map(e=>e.kind),['getPoll','ping','presence']);
  assert.equal(store.current.state.turn.status,'running');assert.equal(store.current.revision,row.revision);
  delete store.people[row.state.turn.refereeId];
  assert.equal((await service.state(data)).unchanged.refereeOnline,true,'unknown presence cannot establish absence');
});

test('disabled auto-pause full polling keeps absent players turns running and exposes settings',async()=>{
  const {row,data}=gameFixture();row.state.settings.autoPause=false;delete data.knownRevision;
  const store=new PollStore(row),service=new GameService(store,{clock:()=>NOW});
  store.people[row.state.turn.playerId]=NOW-60000;store.people[row.state.turn.refereeId]=NOW-60000;
  const result=await service.state(data);
  assert.equal(result.snapshot.turn.status,'running');assert.equal(result.snapshot.turn.refereeOnline,false);
  assert.equal(result.snapshot.settings.autoPause,false);assert.equal(result.snapshot.revision,row.revision);
  assert.equal(store.events.filter(e=>e.kind==='cas').length,0);assert.equal(store.events.filter(e=>e.kind==='get').length,1);
});

test('legacy compact polling still auto-pauses and a settings revision change returns full settings',async()=>{
  const {row,data}=gameFixture();delete row.state.settings;
  const store=new PollStore(row),service=new GameService(store,{clock:()=>NOW});store.people[row.state.turn.playerId]=NOW-20001;
  const result=await service.state(data);
  assert.equal(result.snapshot.turn.status,'paused');assert.deepEqual(result.snapshot.settings,{questions:20,autoPause:true,sharedControls:false});
  const fresh=gameFixture();fresh.row.revision=42;fresh.row.state.settings={questions:30,autoPause:false,sharedControls:true};
  const changed=await new GameService(new PollStore(fresh.row,fresh.row),{clock:()=>NOW}).state(fresh.data);
  assert.equal(changed.unchanged,undefined);assert.equal(changed.snapshot.settings.questions,30);assert.equal(changed.snapshot.revision,42);
});
