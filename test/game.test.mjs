import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { applyAction, authenticate, createRoom, dealCards, elapsedTime, joinRoom, leaderboard, shuffle, snapshot } from '../lib/game.mjs';

const baseTime = 1900000000000;
let sequence = 0;
function cmd(room, actor, name, data={}, now=baseTime, random=()=>0.4) {
  return applyAction(room,actor,name,data,{now,requestId:`test_request_${++sequence}`,random}).room;
}
function prepared(players=4, count=3, random=()=>0.4) {
  let {room}=createRoom({name:'رامین',cardsPerPlayer:count,now:baseTime});
  for(let i=1;i<players;i++) room=joinRoom(room,`دوست ${i}`,baseTime).room;
  for(const p of room.players) room=cmd(room,p.id,'readyLobby',{ready:true});
  room=cmd(room,room.hostId,'startWriting');
  for(const p of room.players) {
    const cards=room.cards.filter(c=>c.authorId===p.id).map((c,i)=>({id:c.id,text:`${p.name} کارت ${i}`}));
    room=cmd(room,p.id,'readyWriting',{ready:true,cards},baseTime,random);
  }
  return room;
}

test('dealing stays balanced, unique and never self-authored for every 2–12 player and 1–20 card setting',()=>{
  for(let p=2;p<=12;p++)for(let n=1;n<=20;n++)for(let seed=1;seed<=20;seed++){
    let x=seed;const rng=()=>{x=(x*1664525+1013904223)>>>0;return x/4294967296;};
    const players=Array.from({length:p},(_,i)=>({id:String(i)}));
    const cards=players.flatMap(author=>Array.from({length:n},(_,i)=>({id:`${author.id}-${i}`,authorId:author.id,text:'x'})));
    const original=structuredClone({players,cards}),byId=new Map(cards.map(c=>[c.id,c]));
    const dealt=dealCards(players,cards,n,rng),all=Object.values(dealt).flat();
    assert.equal(all.length,p*n);assert.equal(new Set(all).size,p*n);
    for(const player of players){
      assert.equal(dealt[player.id].length,n);
      const counts=new Map(players.filter(p=>p.id!==player.id).map(p=>[p.id,0]));
      for(const id of dealt[player.id]){
        const author=byId.get(id).authorId;
        assert.notEqual(author,player.id);counts.set(author,counts.get(author)+1);
      }
      assert.equal([...counts.values()].every(value=>value===Math.floor(n/(p-1))||value===Math.ceil(n/(p-1))),true);
      assert.ok(Math.max(...counts.values())-Math.min(...counts.values())<=1);
    }
    assert.deepEqual({players,cards},original);
  }
});

test('Fisher–Yates gives each three-item permutation once across all equally likely choice pairs',()=>{
  const source=['a','b','c'],outcomes=new Map();
  for(let first=0;first<3;first++)for(let second=0;second<2;second++){
    const choices=[(first+0.5)/3,(second+0.5)/2];
    const result=shuffle(source,()=>choices.shift()).join('');
    outcomes.set(result,(outcomes.get(result)??0)+1);
  }
  assert.equal(outcomes.size,6);assert.ok([...outcomes.values()].every(count=>count===1));
  assert.deepEqual(source,['a','b','c']);
});

test('default dealing and game start use crypto randomness rather than Math.random',t=>{
  t.mock.method(Math,'random',()=>{throw new Error('non-crypto random source used');});
  const players=['a','b','c'].map(id=>({id})),cards=players.map(p=>({id:p.id,authorId:p.id,text:'x'}));
  const dealt=dealCards(players,cards,1);
  assert.equal(new Set(Object.values(dealt).flat()).size,3);
  let room=prepared(3,2);room=cmd(room,room.hostId,'reset',{confirm:true});
  for(const p of room.players)room=cmd(room,p.id,'readyLobby',{ready:true});room=cmd(room,room.hostId,'startWriting');
  for(const p of room.players){
    const own=room.cards.filter(c=>c.authorId===p.id).map(c=>({id:c.id,text:'crypto default'}));
    room=applyAction(room,p.id,'readyWriting',{ready:true,cards:own},{now:baseTime,requestId:`crypto_start_${p.id}`}).room;
  }
  assert.equal(room.phase,'playing');assert.equal(new Set(room.order).size,3);
  assert.equal(Math.random.mock.callCount(),0);
});
test('diverse dealing terminates even with a degenerate random generator',()=>{
  const players=['a','b','c','d'].map(id=>({id}));
  const cards=players.map(p=>({id:p.id,authorId:p.id,text:'x'}));
  const result=dealCards(players,cards,1,()=>0.999999);
  for(const p of players)assert.notEqual(result[p.id][0],p.id);
});
test('four-player three-card games vary between seeds and spread every author across the other three players',()=>{
  const players=['رامین','میلاد','امین','مهسا'].map(id=>({id}));
  const cards=players.flatMap(p=>Array.from({length:3},(_,i)=>({id:`${p.id}-${i}`,authorId:p.id,text:'x'})));
  const outcomes=new Set();
  for(let seed=1;seed<=20;seed++){
    let x=seed;const random=()=>{x=(x*1664525+1013904223)>>>0;return x/4294967296;};
    const hands=dealCards(players,cards,3,random);outcomes.add(JSON.stringify(hands));
    for(const player of players){
      const authors=hands[player.id].map(id=>cards.find(card=>card.id===id).authorId);
      assert.deepEqual(new Set(authors),new Set(players.filter(p=>p.id!==player.id).map(p=>p.id)));
    }
  }
  assert.ok(outcomes.size>1);
});
test('lobby does not begin early, locks joining at writing, and requires mandatory text',()=>{
  let {room}=createRoom({name:'رامین',now:baseTime});
  assert.throws(()=>cmd(room,room.hostId,'startWriting'),{code:'NOT_READY'});
  room=joinRoom(room,'میلاد',baseTime).room;
  for(const p of room.players)room=cmd(room,p.id,'readyLobby',{ready:true});
  assert.equal(room.phase,'lobby');
  room=cmd(room,room.hostId,'startWriting');
  assert.throws(()=>joinRoom(room,'امین',baseTime),{code:'ROOM_LOCKED'});
  assert.throws(()=>cmd(room,room.hostId,'readyWriting',{ready:true}),{code:'INCOMPLETE'});
});
test('only the author may edit a card; ready authors must unready before editing',()=>{
  let {room}=createRoom({name:'a',cardsPerPlayer:1,now:baseTime});room=joinRoom(room,'b',baseTime).room;
  for(const p of room.players)room=cmd(room,p.id,'readyLobby',{ready:true});room=cmd(room,room.hostId,'startWriting');
  const card=room.cards[0],other=room.players[1].id;
  assert.throws(()=>cmd(room,other,'saveCard',{cardId:card.id,text:'x'}),{code:'NOT_YOUR_CARD'});
  room=cmd(room,room.hostId,'saveCard',{cardId:card.id,text:'شرلوک'});
  room=cmd(room,room.hostId,'readyWriting',{ready:true});
  assert.throws(()=>cmd(room,room.hostId,'saveCard',{cardId:card.id,text:'x'}),{code:'CARDS_LOCKED'});
});

test('an already-ready author cannot bypass the card lock using a fresh readyWriting payload',()=>{
  let {room}=createRoom({name:'a',cardsPerPlayer:1,now:baseTime});room=joinRoom(room,'b',baseTime).room;
  for(const p of room.players)room=cmd(room,p.id,'readyLobby',{ready:true});
  room=cmd(room,room.hostId,'startWriting');
  const cardId=room.cards.find(c=>c.authorId===room.hostId).id;
  const readyData={ready:true,cards:[{id:cardId,text:'original'}]},readyContext={now:baseTime,requestId:'locked_author_ready'};
  room=applyAction(room,room.hostId,'readyWriting',readyData,readyContext).room;
  const duplicate=applyAction(room,room.hostId,'readyWriting',readyData,readyContext);
  assert.equal(duplicate.changed,false);assert.equal(duplicate.room,room);
  assert.throws(()=>cmd(room,room.hostId,'readyWriting',{ready:true,cards:[{id:cardId,text:'changed while ready'}]}),{code:'CARDS_LOCKED'});
  assert.equal(room.cards.find(c=>c.id===cardId).text,'original');
  room=cmd(room,room.hostId,'readyWriting',{ready:false});
  room=cmd(room,room.hostId,'readyWriting',{ready:true,cards:[{id:cardId,text:'changed after unready'}]});
  assert.equal(room.cards.find(c=>c.id===cardId).text,'changed after unready');
});
test('snapshots do not expose tokens, assignments or future cards',()=>{
  const room=prepared();const actor=room.players[0].id;
  const view=snapshot(room,actor,7,baseTime);
  assert.equal(view.turn.card,null);assert.equal(view.ownCards.length,0);assert.equal(view.completedCards.length,0);
  assert.equal(view.assignments,undefined);assert.equal(view.players[0].tokenHash,undefined);
  const running=cmd(room,room.turn.refereeId,'start');
  const visible=snapshot(running,actor,8,baseTime+4000);
  assert.equal(visible.turn.card.id,running.turn.cardId);
  for(const card of running.cards.filter(c=>c.id!==running.turn.cardId))assert.ok(!JSON.stringify(visible).includes(card.text));
});
test('wrong tokens fail, valid stable participant credentials work, expired rooms fail',()=>{
  const {room,credentials}=createRoom({name:'a',now:baseTime});
  assert.equal(authenticate(room,credentials.playerId,credentials.token,baseTime).name,'a');
  assert.throws(()=>authenticate(room,credentials.playerId,'wrong',baseTime),{code:'UNAUTHORIZED'});
  assert.throws(()=>authenticate(room,credentials.playerId,credentials.token,room.expiresAt+1),{code:'EXPIRED'});
});

test('uppercase room and participant UUIDs produce canonical identities and accept case-equivalent authentication',()=>{
  const roomId='ABCDEF12-3456-4789-ABCD-EF1234567890',playerId='123456AB-CDEF-4789-ABCD-EF1234567890',token='u'.repeat(32);
  const {room,credentials}=createRoom({name:'canonical author',roomId,playerId,token,now:baseTime});
  assert.equal(room.id,roomId.toLowerCase());assert.equal(credentials.roomId,room.id);
  assert.equal(room.players[0].id,playerId.toLowerCase());assert.equal(credentials.playerId,room.players[0].id);
  assert.equal(room.creatorId,credentials.playerId);assert.equal(room.hostId,credentials.playerId);
  assert.equal(authenticate(room,playerId,token,baseTime).id,credentials.playerId);
  assert.equal(snapshot(room,playerId,0,baseTime).you,credentials.playerId);
  const secondId='ABCDEFAB-1234-4567-8ABC-ABCDEFABCDEF';
  const joined=joinRoom(room,'canonical guest',baseTime,{playerId:secondId,token:'v'.repeat(32)});
  assert.equal(joined.credentials.playerId,secondId.toLowerCase());
  assert.throws(()=>joinRoom(room,'duplicate identity',baseTime,{playerId,token}),{code:'BAD_ID'});
});

test('malformed 36-character room identifiers are rejected instead of being persisted as UUIDs',()=>{
  for(const roomId of ['-'.repeat(36),'a'.repeat(36)]){
    assert.equal(roomId.length,36);
    assert.throws(()=>createRoom({name:'a',roomId,now:baseTime}),{code:'BAD_ID'});
  }
  const uuid='123456ab-cdef-4789-abcd-ef1234567890';
  assert.throws(()=>createRoom({name:'a',roomId:[uuid],now:baseTime}),{code:'BAD_ID'});
  assert.throws(()=>createRoom({name:'a',playerId:[uuid],now:baseTime}),{code:'BAD_ID'});
});

test('case-equivalent actor UUIDs share authorization and request idempotency',()=>{
  const playerId='ABCDEF12-3456-4789-ABCD-EF1234567890',token='w'.repeat(32);
  const {room}=createRoom({name:'canonical manager',playerId,token,now:baseTime}),context={now:baseTime,requestId:'same_case_identity'};
  const first=applyAction(room,playerId,'readyLobby',{ready:true},context);
  assert.equal(first.room.players[0].ready,true);
  const duplicate=applyAction(first.room,playerId.toLowerCase(),'readyLobby',{ready:true},context);
  assert.equal(duplicate.changed,false);assert.equal(duplicate.room,first.room);
});

test('an uppercase original creator context retains closure authority after manager transfer',()=>{
  const creatorId='ABCDEF12-3456-4789-ABCD-EF1234567890';
  let {room}=createRoom({name:'creator',playerId:creatorId,now:baseTime});
  const joined=joinRoom(room,'next manager',baseTime);room=joined.room;
  room=cmd(room,creatorId,'transferHost',{playerId:joined.credentials.playerId});delete room.creatorId;
  room=applyAction(room,creatorId,'closeRoom',{}, {now:baseTime,creatorId,requestId:'canonical_creator_close'}).room;
  assert.equal(room.phase,'closed');
});
test('referee-only mutations and preparation countdown are enforced on the server',()=>{
  let room=prepared(3,1);
  assert.throws(()=>cmd(room,room.turn.playerId,'start'),{code:'REFEREE_ONLY'});
  room=cmd(room,room.turn.refereeId,'start');
  assert.throws(()=>cmd(room,room.turn.refereeId,'question',{},baseTime+1000),{code:'NOT_RUNNING'});
  room=cmd(room,room.turn.refereeId,'question',{},baseTime+3100);assert.equal(room.turn.remaining,19);
  assert.throws(()=>cmd(room,room.turn.refereeId,'failed',{},baseTime+3200),{code:'QUESTIONS_LEFT'});
});
test('duplicate question and result requests never double count',()=>{
  let room=prepared(2,1);room=cmd(room,room.turn.refereeId,'start');
  const ctx={now:baseTime+4000,requestId:'same_question_request'};
  room=applyAction(room,room.turn.refereeId,'question',{},ctx).room;
  const duplicate=applyAction(room,room.turn.refereeId,'question',{},ctx);
  assert.equal(duplicate.changed,false);assert.equal(duplicate.room.turn.remaining,19);
  const correct={now:baseTime+6000,requestId:'same_correct_request'};
  room=applyAction(room,room.turn.refereeId,'correct',{},correct).room;
  room=applyAction(room,room.turn.refereeId,'correct',{},correct).room;
  assert.equal(room.results.length,1);assert.equal(room.results[0].score,19);
});
test('question 20 allows a correct final answer; zero does not automatically fail',()=>{
  let room=prepared(2,1);room=cmd(room,room.turn.refereeId,'start');
  for(let i=0;i<20;i++)room=cmd(room,room.turn.refereeId,'question',{},baseTime+4000+i*1000);
  assert.equal(room.turn.remaining,0);assert.equal(room.turn.status,'running');assert.equal(room.results.length,0);
  room=cmd(room,room.turn.refereeId,'correct',{},baseTime+26000);
  assert.equal(room.results[0].success,true);assert.equal(room.results[0].score,0);
});
test('question limit, undo, failure and frozen result time behave correctly',()=>{
  let room=prepared(2,1);room=cmd(room,room.turn.refereeId,'start');
  for(let i=0;i<20;i++)room=cmd(room,room.turn.refereeId,'question',{},baseTime+4000+i*1000);
  assert.throws(()=>cmd(room,room.turn.refereeId,'question',{},baseTime+25000),{code:'NO_QUESTIONS'});
  room=cmd(room,room.turn.refereeId,'undoQuestion',{},baseTime+26000);assert.equal(room.turn.remaining,1);
  room=cmd(room,room.turn.refereeId,'question',{},baseTime+27000);
  room=cmd(room,room.turn.refereeId,'failed',{},baseTime+28000);
  assert.equal(room.results[0].score,0);assert.equal(elapsedTime(room.turn,baseTime+999999),25000);
});
test('pause/resume excludes pause duration, and stale turn commands are rejected',()=>{
  let room=prepared(2,1);room=cmd(room,room.turn.refereeId,'start');
  room=cmd(room,room.turn.refereeId,'pause',{},baseTime+8000);assert.equal(room.turn.elapsedMs,5000);
  room=cmd(room,room.turn.refereeId,'resume',{},baseTime+20000);
  room=cmd(room,room.turn.refereeId,'correct',{},baseTime+24000);assert.equal(room.results[0].elapsedMs,8000);
  const oldTurn=room.turn.id;room=cmd(room,room.turn.refereeId,'next',{},baseTime+25000);
  assert.throws(()=>cmd(room,room.turn.refereeId,'start',{turnId:oldTurn},baseTime+26000),{code:'STALE_TURN'});
});
test('a disconnected guesser/referee pauses from durable server presence',()=>{
  let room=prepared(2,1);delete room.settings;room=cmd(room,room.turn.refereeId,'start');
  const presence=Object.fromEntries(room.players.map(p=>[p.id,baseTime+25000]));presence[room.turn.playerId]=baseTime;
  room=applyAction(room,room.turn.refereeId,'autoPause',{}, {now:baseTime+25000,presence,requestId:'offline_pause'}).room;
  assert.equal(room.turn.status,'paused');assert.equal(room.turn.pauseReason,'connection');
});
test('all N cycles finish, each card is used once, and replay preserves the group',()=>{
  let room=prepared(4,3);let now=baseTime;
  for(let i=0;i<12;i++){
    assert.equal(room.turn.playerId,room.order[i%4]);
    room=cmd(room,room.turn.refereeId,'start',{},now);
    room=cmd(room,room.turn.refereeId,'question',{},now+4000);
    room=cmd(room,room.turn.refereeId,'correct',{},now+5000);
    if(i<11)room=cmd(room,room.turn.refereeId,'next',{},now+6000);
    now+=7000;
  }
  assert.equal(room.phase,'finished');assert.equal(new Set(room.results.map(r=>r.cardId)).size,12);
  assert.ok(leaderboard(room).every(r=>r.completed===3&&r.score===57));
  assert.equal(snapshot(room,room.hostId,42,now).completedCards.length,12);
  const players=room.players.map(p=>p.id);room=cmd(room,room.hostId,'reset',{},now);
  assert.equal(room.phase,'lobby');assert.deepEqual(room.players.map(p=>p.id),players);assert.equal(room.cards.length,0);assert.equal(room.results.length,0);assert.equal(room.generation,2);
});
test('rank sorts by score then total time; exact ties share rank',()=>{
  const room=prepared(4,1),ids=room.players.map(p=>p.id);
  room.results=[{playerId:ids[0],score:15,elapsedMs:10000,success:true},{playerId:ids[1],score:15,elapsedMs:5000,success:true},{playerId:ids[2],score:15,elapsedMs:5000,success:true},{playerId:ids[3],score:16,elapsedMs:50000,success:true}];
  const rows=leaderboard(room);assert.equal(rows[0].playerId,ids[3]);assert.equal(rows[1].rank,2);assert.equal(rows[2].rank,2);assert.equal(rows[3].rank,4);
});

test('only the manager can kick; creator is protected; lobby readiness is reset',()=>{
  let {room}=createRoom({name:'رامین',now:baseTime});
  room=joinRoom(room,'امین',baseTime).room;room=joinRoom(room,'میلاد',baseTime).room;
  const [a,b,c]=room.players.map(p=>p.id);
  for(const p of room.players)room=cmd(room,p.id,'readyLobby',{ready:true});
  assert.throws(()=>cmd(room,b,'kick',{playerId:c}),{code:'HOST_ONLY'});
  assert.throws(()=>cmd(room,a,'kick',{playerId:a}),{code:'CREATOR_REQUIRED'});
  room=cmd(room,a,'kick',{playerId:c});
  assert.equal(room.players.length,2);assert.ok(room.players.every(p=>!p.ready));
  room=cmd(room,a,'transferHost',{playerId:b});
  assert.throws(()=>cmd(room,b,'kick',{playerId:a}),{code:'CREATOR_REQUIRED'});
});
test('kick during play requires confirmation and resets the remaining group cleanly',()=>{
  let room=prepared(3,1);const target=room.players.find(p=>p.id!==room.hostId).id;
  assert.throws(()=>cmd(room,room.hostId,'kick',{playerId:target}),{code:'CONFIRM_KICK'});
  room=cmd(room,room.hostId,'kick',{playerId:target,confirm:true});
  assert.equal(room.phase,'lobby');assert.equal(room.generation,2);assert.equal(room.players.length,2);
  assert.deepEqual(room.cards,[]);assert.deepEqual(room.assignments,{});assert.equal(room.turn,null);assert.deepEqual(room.results,[]);
  assert.ok(room.players.every(p=>!p.ready));assert.ok(leaderboard(room).every(p=>p.score===0));
});
test('manager or original creator may close; closed rooms reject join, state and reset',()=>{
  let {room,credentials}=createRoom({name:'رامین',now:baseTime});
  room=joinRoom(room,'امین',baseTime).room;room=joinRoom(room,'میلاد',baseTime).room;
  const [a,b,c]=room.players.map(p=>p.id);
  assert.throws(()=>cmd(room,c,'closeRoom'),{code:'HOST_ONLY'});
  room=cmd(room,a,'transferHost',{playerId:b});delete room.creatorId;
  room=applyAction(room,a,'closeRoom',{}, {now:baseTime,creatorId:a,requestId:'close_request_01'}).room;
  assert.equal(room.phase,'closed');assert.equal(room.expiresAt,baseTime);
  assert.throws(()=>authenticate(room,a,credentials.token,baseTime),{code:'ROOM_CLOSED'});
  assert.throws(()=>joinRoom(room,'دیگر',baseTime),{code:'ROOM_CLOSED'});
  assert.throws(()=>cmd(room,b,'reset',{confirm:true}),{code:'ROOM_CLOSED'});
});
test('leaderboard sums all completed turn times including failures before tie-breaking',()=>{
  const room=prepared(3,2),[a,b,c]=room.players.map(p=>p.id);
  room.results=[{playerId:a,score:10,elapsedMs:5000,success:true},{playerId:a,score:0,elapsedMs:40000,success:false},
    {playerId:b,score:10,elapsedMs:20000,success:true},{playerId:b,score:0,elapsedMs:10000,success:false},
    {playerId:c,score:11,elapsedMs:90000,success:true}];
  const rows=leaderboard(room);assert.equal(rows[0].playerId,c);assert.equal(rows[1].playerId,b);
  assert.equal(rows.find(p=>p.playerId===a).elapsedMs,45000);assert.equal(rows.find(p=>p.playerId===b).elapsedMs,30000);
});

test('seeded full games vary player positions without changing each players number of turns',()=>{
  const orders=new Set(),positions=Array.from({length:4},()=>new Set());
  for(let seed=1;seed<=64;seed++){
    let x=seed;const random=()=>{x=(x*1664525+1013904223)>>>0;return x/4294967296;};
    const room=prepared(4,3,random),ids=room.players.map(p=>p.id);
    const order=room.order.map(id=>ids.indexOf(id));orders.add(order.join(','));
    order.forEach((playerIndex,position)=>positions[playerIndex].add(position));
    assert.deepEqual([...order].sort(),[0,1,2,3]);
  }
  assert.ok(orders.size>1);assert.ok(positions.every(seen=>seen.size===4));
});

test('all legal question counts score correctly and undo restores every question without exceeding twenty',()=>{
  let initial=prepared(2,1);initial=cmd(initial,initial.turn.refereeId,'start');
  for(let used=0;used<=20;used++){
    let room=structuredClone(initial);
    for(let i=0;i<used;i++)room=cmd(room,room.turn.refereeId,'question',{},baseTime+4000);
    assert.equal(room.turn.remaining,20-used);assert.equal(room.results.length,0);
    const scored=cmd(room,room.turn.refereeId,'correct',{},baseTime+5000);
    assert.equal(scored.results[0].score,20-used);assert.equal(scored.results[0].elapsedMs,2000);
    assert.equal(elapsedTime(scored.turn,baseTime+100000),2000);
    if(used<20)assert.throws(()=>cmd(room,room.turn.refereeId,'failed',{},baseTime+5000),{code:'QUESTIONS_LEFT'});
    else assert.equal(cmd(room,room.turn.refereeId,'failed',{},baseTime+5000).results[0].score,0);
    for(let i=0;i<used;i++){
      room=cmd(room,room.turn.refereeId,'undoQuestion',{},baseTime+6000);
      assert.equal(room.turn.remaining,20-used+i+1);
    }
    assert.equal(room.turn.remaining,20);
    assert.throws(()=>cmd(room,room.turn.refereeId,'undoQuestion',{},baseTime+6000),{code:'NOTHING_TO_UNDO'});
  }
});

test('countdown and repeated pause/resume gaps are excluded from authoritative completed-turn time',()=>{
  let room=prepared(2,1);room=cmd(room,room.turn.refereeId,'start');
  assert.equal(elapsedTime(room.turn,baseTime+2999),0);
  assert.throws(()=>cmd(room,room.turn.refereeId,'correct',{},baseTime+2999),{code:'NOT_RUNNING'});
  room=cmd(room,room.turn.refereeId,'pause',{},baseTime+2000);
  assert.equal(elapsedTime(room.turn,baseTime+9999),0);
  room=cmd(room,room.turn.refereeId,'resume',{},baseTime+10000);
  assert.throws(()=>cmd(room,room.turn.refereeId,'question',{},baseTime+10999),{code:'NOT_RUNNING'});
  room=cmd(room,room.turn.refereeId,'pause',{},baseTime+12000);
  assert.equal(room.turn.elapsedMs,1000);
  assert.throws(()=>cmd(room,room.turn.refereeId,'question',{},baseTime+19000),{code:'NOT_RUNNING'});
  room=cmd(room,room.turn.refereeId,'resume',{},baseTime+20000);
  room=cmd(room,room.turn.refereeId,'question',{},baseTime+24000);
  room=cmd(room,room.turn.refereeId,'pause',{},baseTime+24000);
  assert.equal(room.turn.elapsedMs,4000);
  room=cmd(room,room.turn.refereeId,'resume',{},baseTime+30000);
  room=cmd(room,room.turn.refereeId,'correct',{},baseTime+35000);
  assert.equal(room.results[0].elapsedMs,8000);assert.equal(room.results[0].score,19);
  assert.equal(leaderboard(room).find(p=>p.playerId===room.turn.playerId).elapsedMs,8000);
});

test('complete games at boundary sizes consume every card once and rank actual successful and failed turn totals',()=>{
  for(const [players,count] of [[2,1],[2,20],[3,4],[4,3],[7,6],[12,1],[12,20]]){
    let room=prepared(players,count),now=baseTime;
    const expected=new Map(room.players.map(p=>[p.id,{score:0,elapsedMs:0,completed:0,correct:0}]));
    const byCard=new Map(room.cards.map(c=>[c.id,c])),seen=new Set();
    for(let i=0;i<players*count;i++){
      const {playerId,refereeId,cardId}=room.turn;
      assert.equal(playerId,room.order[i%players]);assert.notEqual(refereeId,playerId);
      assert.notEqual(byCard.get(cardId).authorId,playerId);assert.equal(seen.has(cardId),false);seen.add(cardId);
      const success=i%4!==0,used=success?i%21:20,elapsedMs=1000+(i%3)*1000;
      room=cmd(room,refereeId,'start',{},now);
      for(let q=0;q<used;q++)room=cmd(room,refereeId,'question',{},now+3000);
      room=cmd(room,refereeId,success?'correct':'failed',{},now+3000+elapsedMs);
      const total=expected.get(playerId);total.score+=success?20-used:0;total.elapsedMs+=elapsedMs;total.completed++;total.correct+=Number(success);
      if(i<players*count-1){assert.equal(room.phase,'playing');room=cmd(room,refereeId,'next',{},now+7000);}
      now+=10000;
    }
    assert.equal(room.phase,'finished');assert.equal(seen.size,players*count);
    for(const row of leaderboard(room)){
      const total=expected.get(row.playerId);
      assert.deepEqual({score:row.score,elapsedMs:row.elapsedMs,completed:row.completed,correct:row.correct},total);
      assert.equal(row.completed,count);
    }
    assert.throws(()=>cmd(room,room.turn.refereeId,'next',{},now),{code:'NO_TURN'});
  }
});

test('manager transfer and a 45-second takeover preserve active cards, turn, order and scores',()=>{
  let room=prepared(4,2);room=cmd(room,room.turn.refereeId,'start');
  room=cmd(room,room.turn.refereeId,'question',{},baseTime+4000);
  const creator=room.creatorId,newHost=room.players.find(p=>p.id!==creator).id;
  const unchanged=({cards,assignments,order,turn,turnIndex,results,generation})=>({cards,assignments,order,turn,turnIndex,results,generation});
  const active=unchanged(room);room=cmd(room,creator,'transferHost',{playerId:newHost});
  assert.deepEqual(unchanged(room),active);
  assert.throws(()=>cmd(room,creator,'transferHost',{playerId:creator}),{code:'HOST_ONLY'});
  assert.throws(()=>cmd(room,newHost,'kick',{playerId:creator,confirm:true}),{code:'CREATOR_REQUIRED'});
  const claimant=room.players.find(p=>![creator,newHost].includes(p.id)).id,presence={[newHost]:baseTime+10000};
  assert.throws(()=>applyAction(room,claimant,'claimHost',{}, {now:baseTime+54999,presence,requestId:'early_takeover'}),{code:'HOST_ONLINE'});
  room=applyAction(room,claimant,'claimHost',{}, {now:baseTime+55000,presence,requestId:'on_time_takeover'}).room;
  assert.equal(room.hostId,claimant);assert.deepEqual(unchanged(room),active);
});

test('replay preserves members, requires fresh readiness and cards, and rejects previous-generation edits',()=>{
  let room=prepared(4,2);const oldGeneration=room.generation,oldCards=new Set(room.cards.map(c=>c.id)),members=room.players.map(p=>p.id);
  room=cmd(room,room.hostId,'reset',{confirm:true});
  assert.deepEqual(room.players.map(p=>p.id),members);assert.ok(room.players.every(p=>!p.ready));
  assert.ok(leaderboard(room).every(p=>p.score===0&&p.completed===0&&p.elapsedMs===0));
  assert.throws(()=>cmd(room,room.hostId,'startWriting'),{code:'NOT_READY'});
  for(const p of room.players)room=cmd(room,p.id,'readyLobby',{ready:true});
  room=cmd(room,room.hostId,'startWriting');
  assert.equal(room.generation,oldGeneration+1);assert.equal(room.cards.length,8);
  assert.ok(room.cards.every(c=>!oldCards.has(c.id)&&!c.text));
  const current=room.cards.find(c=>c.authorId===room.hostId);
  assert.throws(()=>cmd(room,room.hostId,'saveCard',{generation:oldGeneration,cardId:current.id,text:'previous game'}),{code:'STALE_GAME'});
});

test('confirmed removal during writing resets the remaining group and invalidates all pending cards',()=>{
  let {room}=createRoom({name:'a',cardsPerPlayer:2,now:baseTime});
  room=joinRoom(room,'b',baseTime).room;room=joinRoom(room,'c',baseTime).room;
  for(const p of room.players)room=cmd(room,p.id,'readyLobby',{ready:true});room=cmd(room,room.hostId,'startWriting');
  const pending=room.cards[0],target=room.players[2].id;
  room=cmd(room,pending.authorId,'saveCard',{cardId:pending.id,text:'unfinished game'});
  assert.throws(()=>cmd(room,room.hostId,'kick',{playerId:target}),{code:'CONFIRM_KICK'});
  room=cmd(room,room.hostId,'kick',{playerId:target,confirm:true});
  assert.equal(room.phase,'lobby');assert.equal(room.generation,2);assert.equal(room.players.length,2);
  assert.ok(room.players.every(p=>!p.ready));assert.deepEqual(room.cards,[]);assert.deepEqual(room.results,[]);
  assert.throws(()=>cmd(room,target,'readyLobby',{ready:true}),{code:'UNAUTHORIZED'});
});
