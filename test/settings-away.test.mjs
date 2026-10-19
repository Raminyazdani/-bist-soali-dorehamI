import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction,createRoom,elapsedTime,joinRoom,roomSettings,snapshot} from '../lib/game.mjs';

const BASE=1900000000000;
let sequence=0;
const action=(room,actor,name,data={},now=BASE,presence={})=>applyAction(room,actor,name,data,{now,presence,requestId:`settings_fixture_${++sequence}`,random:()=>0.4}).room;
function lobby(settings={},players=4){
  let room=createRoom({name:'مدیر',cardsPerPlayer:1,settings,now:BASE}).room;
  for(let i=1;i<players;i++)room=joinRoom(room,`دوست ${i}`,BASE).room;
  return room;
}
function playing(settings={},players=4){
  let room=lobby(settings,players);
  for(const p of room.players)room=action(room,p.id,'readyLobby',{ready:true});
  room=action(room,room.hostId,'startWriting');
  for(const p of room.players)room=action(room,p.id,'readyWriting',{ready:true,cards:room.cards.filter(c=>c.authorId===p.id).map(c=>({id:c.id,text:'کارت'}))});
  return room;
}
function finished(room){
  let now=BASE;
  while(room.phase==='playing'){
    room=action(room,room.turn.refereeId,'start',{},now);
    room=action(room,room.turn.refereeId,'correct',{},now+4000);
    if(room.phase==='playing')room=action(room,room.turn.refereeId,'next',{},now+5000);
    now+=6000;
  }
  return room;
}
const guest=room=>room.players.find(p=>p.id!==room.hostId).id;
const spectator=room=>room.players.find(p=>![room.hostId,room.turn.playerId,room.turn.refereeId].includes(p.id)).id;

test('new rooms use party defaults while legacy rooms retain their original settings',()=>{
  const room=lobby(),other=lobby();
  assert.deepEqual(roomSettings(room),{questions:20,autoPause:false,sharedControls:true,remotePlay:false});
  assert.deepEqual(snapshot(room,room.hostId).settings,roomSettings(room));
  room.settings.questions=10;assert.equal(other.settings.questions,20);
  delete room.settings;
  assert.deepEqual(snapshot(room,room.hostId).settings,{questions:20,autoPause:true,sharedControls:false,remotePlay:false});
  assert.equal(Object.hasOwn(room,'settings'),false,'reading legacy settings must not migrate the room');
});

test('question counts accept only integers5 through30 and settings booleans are strict',()=>{
  for(let questions=5;questions<=30;questions++)assert.equal(lobby({questions}).settings.questions,questions);
  for(const questions of [4,31,5.5,'10','۱۰',true,null,Number.NaN,Infinity])assert.throws(()=>lobby({questions}),{code:'BAD_SETTINGS'});
  for(const key of ['autoPause','sharedControls','remotePlay'])for(const value of [0,1,'false','true',null,undefined])assert.throws(()=>lobby({[key]:value}),{code:'BAD_SETTINGS'});
  for(const settings of [null,[],false,'settings',{unknown:true}])assert.throws(()=>createRoom({name:'مدیر',settings}),{code:'BAD_SETTINGS'});
});

test('host settings changes are atomic, lobby-only, readiness-resetting and retry-idempotent',()=>{
  let room=lobby();for(const p of room.players)room=action(room,p.id,'readyLobby',{ready:true});
  const original=JSON.stringify(room);
  assert.throws(()=>action(room,guest(room),'setSettings',{settings:{questions:10}}),{code:'HOST_ONLY'});
  assert.throws(()=>action(room,room.hostId,'setSettings',{settings:{questions:30},cardsPerPlayer:21}),{code:'BAD_COUNT'});
  assert.equal(JSON.stringify(room),original);
  const context={now:BASE,requestId:'same_settings_request'};
  const saved=applyAction(room,room.hostId,'setSettings',{settings:{questions:10},cardsPerPlayer:2},context).room;
  assert.deepEqual(saved.settings,{questions:10,autoPause:false,sharedControls:true,remotePlay:false});
  assert.equal(saved.cardsPerPlayer,2);assert.ok(saved.players.every(p=>!p.ready));
  assert.equal(applyAction(saved,saved.hostId,'setSettings',{settings:{questions:30}},context).changed,false);
  room=action(saved,saved.hostId,'setCount',{count:3});assert.equal(room.settings.questions,10);assert.equal(room.cardsPerPlayer,3);
  const active=playing();assert.throws(()=>action(active,active.hostId,'setSettings',{settings:{questions:30}}),{code:'ROOM_LOCKED'});
});

test('configured question budgets drive each new turn, exhaustion, undo and successful or failed results',()=>{
  for(const questions of [5,10,20,30]){
    let room=playing({questions},2);assert.equal(room.turn.remaining,questions);
    room=action(room,room.turn.refereeId,'start');
    for(let i=0;i<questions;i++)room=action(room,room.turn.refereeId,'question',{},BASE+4000+i);
    assert.equal(room.turn.status,'running');assert.equal(room.turn.remaining,0);assert.equal(room.results.length,0);
    assert.throws(()=>action(room,room.turn.refereeId,'question',{},BASE+5000),error=>error.code==='NO_QUESTIONS'&&error.message.includes(questions.toLocaleString('fa')));
    room=action(room,room.turn.refereeId,'undoQuestion',{},BASE+5000);assert.equal(room.turn.remaining,1);
    room=action(room,room.turn.refereeId,'correct',{},BASE+6000);
    assert.equal(room.results[0].questionsUsed,questions-1);assert.equal(room.results[0].score,1);
    room=action(room,room.turn.refereeId,'next');assert.equal(room.turn.remaining,questions);
    room=action(room,room.turn.refereeId,'start');
    assert.throws(()=>action(room,room.turn.refereeId,'failed',{},BASE+4000),{code:'QUESTIONS_LEFT'});
    for(let i=0;i<questions;i++)room=action(room,room.turn.refereeId,'question',{},BASE+4000+i);
    room=action(room,room.turn.refereeId,'failed',{},BASE+6000);
    assert.equal(room.results[1].questionsUsed,questions);assert.equal(room.results[1].score,0);assert.equal(room.phase,'finished');
  }
});

test('shared controls let any ready participant progress and replay while safeguards remain',()=>{
  let room=lobby(),participant=guest(room);
  assert.throws(()=>action(room,participant,'startWriting'),{code:'NOT_READY'});
  for(const p of room.players)room=action(room,p.id,'readyLobby',{ready:true});
  assert.equal(action(room,participant,'startWriting').phase,'writing');
  room=playing();participant=spectator(room);
  assert.throws(()=>action(room,participant,'next'),{code:'NOT_FINISHED'});
  assert.throws(()=>action(room,participant,'reset',{confirm:true}),{code:'HOST_ONLY'});
  assert.throws(()=>action(room,participant,'kick',{playerId:room.hostId,confirm:true}),{code:'HOST_ONLY'});
  assert.throws(()=>action(room,participant,'closeRoom'),{code:'HOST_ONLY'});
  room=action(room,room.turn.refereeId,'start');room=action(room,room.turn.refereeId,'correct',{},BASE+4000);
  room=action(room,participant,'next');assert.equal(room.turn.status,'waiting');assert.equal(room.results.length,1);
  room=finished(room);const generation=room.generation,settings=JSON.stringify(room.settings);
  room=action(room,participant,'reset');assert.equal(room.phase,'lobby');assert.equal(room.generation,generation+1);
  assert.ok(room.players.every(p=>!p.ready));assert.deepEqual(room.cards,[]);assert.deepEqual(room.results,[]);
  assert.equal(JSON.stringify(room.settings),settings);
});

test('disabled shared controls and old rooms keep manager/referee progression authority',()=>{
  for(const legacy of [false,true]){
    let room=lobby({sharedControls:false});if(legacy)delete room.settings;
    for(const p of room.players)room=action(room,p.id,'readyLobby',{ready:true});
    assert.throws(()=>action(room,guest(room),'startWriting'),{code:'HOST_ONLY'});
    room=playing({sharedControls:false});if(legacy)delete room.settings;
    const actor=spectator(room);room=action(room,room.turn.refereeId,'start');room=action(room,room.turn.refereeId,'correct',{},BASE+4000);
    assert.throws(()=>action(room,actor,'next'),{code:'REFEREE_ONLY'});
    room=action(room,room.hostId,'next');room=finished(room);
    assert.throws(()=>action(room,guest(room),'reset'),{code:'HOST_ONLY'});
  }
});

test('default absence never auto-pauses but optional and legacy pause behavior remains',()=>{
  for(const role of ['hostId','playerId','refereeId']){
    let room=playing();room=action(room,room.turn.refereeId,'start');
    const presence=Object.fromEntries(room.players.map(p=>[p.id,BASE+60000]));
    presence[role==='hostId'?room.hostId:room.turn[role]]=BASE;
    const result=applyAction(room,guest(room),'autoPause',{}, {now:BASE+60000,presence,requestId:`absence_${role}`});
    assert.equal(result.changed,false);assert.equal(result.room.turn.status,'running');assert.equal(elapsedTime(result.room.turn,BASE+60000),57000);
  }
  for(const legacy of [false,true]){
    let room=playing({autoPause:true});if(legacy)delete room.settings;
    room=action(room,room.turn.refereeId,'start');
    const presence=Object.fromEntries(room.players.map(p=>[p.id,BASE+30000]));presence[room.turn.playerId]=BASE;
    room=action(room,room.turn.refereeId,'autoPause',{},BASE+30000,presence);
    assert.equal(room.turn.status,'paused');assert.equal(room.turn.pauseReason,'connection');
  }
});

test('manual pause and resume still exclude elapsed pause time when automatic pause is disabled',()=>{
  let room=playing({questions:30});room=action(room,room.turn.refereeId,'start');
  room=action(room,room.turn.refereeId,'question',{},BASE+4000);room=action(room,room.turn.refereeId,'pause',{},BASE+8000);
  assert.equal(room.turn.pauseReason,'manual');room=action(room,room.turn.refereeId,'resume',{},BASE+20000);
  room=action(room,room.turn.refereeId,'correct',{},BASE+24000);
  assert.equal(room.results[0].questionsUsed,1);assert.equal(room.results[0].score,29);assert.equal(room.results[0].elapsedMs,8000);
});

test('referee takeover requires confirmed absence over20 seconds and never permits self-judging',()=>{
  const room=playing(),actor=spectator(room),referee=room.turn.refereeId,presence={[referee]:BASE};
  for(const observed of [{}, {[referee]:Number.NaN}])assert.throws(()=>action(room,actor,'claimReferee',{},BASE+90000,observed),{code:'REFEREE_ONLINE'});
  assert.throws(()=>action(room,actor,'claimReferee',{},BASE+20000,presence),{code:'REFEREE_ONLINE'});
  assert.throws(()=>action(room,room.turn.playerId,'claimReferee',{},BASE+20001,presence),{code:'BAD_REFEREE'});
  assert.equal(snapshot(room,actor,0,BASE+20000,presence).turn.refereeOnline,true);
  assert.equal(snapshot(room,actor,0,BASE+20001,presence).turn.refereeOnline,false);
  assert.equal(snapshot(room,actor,0,BASE+90000,{}).turn.refereeOnline,true);
  const claimed=action(room,actor,'claimReferee',{turnId:room.turn.id,generation:room.generation},BASE+20001,presence);
  assert.equal(claimed.turn.refereeId,actor);assert.equal(claimed.hostId,room.hostId);assert.equal(claimed.creatorId,room.creatorId);
  const preserved={...claimed,turn:{...claimed.turn,refereeId:referee},requests:room.requests};
  assert.equal(JSON.stringify(preserved),JSON.stringify(room),'takeover preserves the complete game except referee/request history');
});

test('referee takeover preserves active timing and card state, and voluntary handoff is authorized',()=>{
  let room=playing({sharedControls:false}),actor=spectator(room),oldReferee=room.turn.refereeId;
  room=action(room,oldReferee,'start');room=action(room,oldReferee,'question',{},BASE+4000);
  const before=JSON.stringify({...room.turn,refereeId:actor});
  room=action(room,actor,'claimReferee',{},BASE+30000,{[oldReferee]:BASE});
  assert.equal(JSON.stringify(room.turn),before);assert.equal(room.turn.status,'running');
  assert.throws(()=>action(room,oldReferee,'question',{},BASE+31000),{code:'REFEREE_ONLY'});
  room=action(room,actor,'question',{},BASE+31000);assert.equal(room.turn.remaining,18);
  room=action(room,actor,'setReferee',{playerId:oldReferee.toUpperCase()},BASE+32000);assert.equal(room.turn.refereeId,oldReferee);
  assert.throws(()=>action(room,actor,'setReferee',{playerId:oldReferee}),{code:'REFEREE_ONLY'});
  assert.throws(()=>action(room,oldReferee,'setReferee',{playerId:room.turn.playerId}),{code:'BAD_REFEREE'});
  room=action(room,room.hostId,'setReferee',{playerId:actor});assert.equal(room.turn.refereeId,actor);
  assert.throws(()=>action(room,actor,'claimReferee',{turnId:'old-turn'},BASE+60000,{[actor]:BASE}),{code:'STALE_TURN'});
});
