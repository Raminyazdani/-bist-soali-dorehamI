import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {neon} from '@neondatabase/serverless';
import {PostgresStore} from '../lib/postgres-store.mjs';
import {GameService} from '../lib/service.mjs';
import {createRoom} from '../lib/game.mjs';
import {hash} from '../lib/crypto.mjs';

test('Postgres reports missing configuration and rejects malformed IDs before querying',async()=>{
  const unconfigured=new PostgresStore({connection:''});assert.equal(unconfigured.configured(),false);
  await assert.rejects(()=>unconfigured.get('bad-id'),{code:'BAD_ID'});
  await assert.rejects(()=>unconfigured.getPoll('bad-id',0),{code:'BAD_ID'});
  await assert.rejects(()=>unconfigured.get(randomUUID()),{code:'SERVICE_NOT_CONFIGURED'});
});

test('Postgres keeps user text bound to parameters and request caches independent',async()=>{
  const text="'); DROP TABLE forehead_v3_rooms; -- فارسی",{room}=createRoom({name:'رامین'});
  room.requests.push(text);let captured;
  const sql={query:async(query,params)=>{captured={query,params};return [{id:room.id,revision:'0',version:'0',state:room,creatorId:room.creatorId}];}};
  const first=new PostgresStore({sql}),second=new PostgresStore({sql});
  await first.insert(room);assert.ok(!captured.query.includes(text));assert.ok(captured.params.includes(JSON.stringify(room)));
  assert.equal(first.rows.size,1);assert.equal(second.rows.size,0);
});

test('Postgres propagates unrelated provider failures and does not report them as CAS conflicts',async()=>{
  const error=Object.assign(new Error('provider failure'),{code:'TEST_FAILURE'});
  const store=new PostgresStore({sql:{query:async()=>{throw error;}}});
  const {room}=createRoom({name:'رامین'});
  await assert.rejects(()=>store.cas({id:room.id,revision:0},room),value=>value===error);
  await assert.rejects(()=>store.cas({id:room.id,revision:0,compact:true},room),TypeError);
});

class FixtureFailure extends Error {}
const identity=()=>({roomId:randomUUID(),playerId:randomUUID(),token:randomUUID().replaceAll('-','')});
const auth=credentials=>({roomId:credentials.roomId,playerId:credentials.playerId,token:credentials.token});
const safeError=error=>{
  if(error instanceof FixtureFailure)return error;
  const safe=value=>typeof value==='string'&&/^[A-Za-z0-9_]{1,64}$/.test(value)?value:'UNAVAILABLE';
  return new Error(`Live Postgres check failed: ${safe(error?.constructor?.name)} ${safe(error?.code)}`);
};

test('live Postgres preserves concurrent game state, private photos, quotas and scoped cleanup',
  {skip:process.env.POSTGRES_LIVE_TESTS!=='1'},async()=>{
  const connection=process.env.DATABASE_URL;
  const fixtureIds=[],limitKeys=[],run=randomUUID();let checks=0;
  const check=(condition,label)=>{if(!condition)throw new FixtureFailure(`Fixture check failed: ${label}`);checks++;};
  const sql=neon(connection),store=()=>new PostgresStore({connection});
  const service=()=>new GameService(store());
  const create=async(name,cardsPerPlayer=1)=>{
    const owned=identity();fixtureIds.push(owned.roomId);
    return service().create({name,cardsPerPlayer,...owned});
  };
  const action=(credentials,name,data={},requestId=randomUUID().replaceAll('-',''))=>
    service().action({...auth(credentials),action:name,data,requestId});
  let finalFailure,targetVerified=false;
  try {
    const target=new URL(connection);
    check(target.protocol==='postgresql:'&&target.hostname.endsWith('.neon.tech')&&target.pathname==='/neondb','owned Neon target');
    targetVerified=true;
    const schema=await sql.query("SELECT to_regclass('forehead_v3_rooms') IS NOT NULL AS ready");
    check(schema[0].ready,'schema ready');
    const a=await create('آزمون همزمانی'),again=await service().create({name:'آزمون همزمانی',cardsPerPlayer:1,...a.credentials});
    check(a.credentials.roomId===again.credentials.roomId,'create retry keeps room');
    const duplicate=createRoom({name:'رزرو تکراری',code:a.credentials.code}).room;fixtureIds.push(duplicate.id);
    check(await store().insert(duplicate)===null,'unique code reservation');
    const guests=await Promise.all(Array.from({length:11},(_,i)=>service().join({name:`بازیکن ${i+2}`,code:a.credentials.code,...identity()})));
    const participants=[a,...guests];
    await Promise.all(participants.map(p=>action(p.credentials,'readyLobby',{ready:true})));
    let row=await store().get(a.credentials.roomId);
    check(row.state.players.length===12&&new Set(row.state.players.map(p=>p.id)).size===12,'all twelve joins persist');
    check(row.state.players.every(p=>p.ready)&&row.revision===23,'concurrent readiness keeps revision');
    const repeated='same_live_ready_request';
    await Promise.all(Array.from({length:4},()=>action(a.credentials,'readyLobby',{ready:true},repeated)));
    row=await store().get(a.credentials.roomId);
    check(row.state.requests.filter(id=>id.endsWith(':'+repeated)).length===1&&row.revision===24,'action retry commits once');

    const writer=store(),staleStore=store(),first=await writer.get(row.id),stale=await staleStore.get(row.id);
    check(await writer.cas(first,{...first.state,cardsPerPlayer:2}),'fresh CAS succeeds');
    check(await staleStore.cas(stale,{...stale.state,cardsPerPlayer:20})===false,'stale CAS rejected');
    const latest=await store().get(row.id),heartbeatAt=Date.now()+10000;
    await Promise.all(participants.map(p=>store().ping(row.id,p.credentials.playerId,heartbeatAt)));
    const afterHeartbeat=await store().get(row.id);
    check(afterHeartbeat.revision===latest.revision&&afterHeartbeat.state.cardsPerPlayer===2,'heartbeat leaves state revision intact');
    check(Object.keys(afterHeartbeat.people).length===12&&Object.values(afterHeartbeat.people).every(time=>Number(time)>=heartbeatAt),'all heartbeats persist');
    check(await writer.cas(latest,{...latest.state,players:latest.state.players.map(p=>({...p,ready:false}))})===false,'heartbeat invalidates stale presence CAS');
    const coherent=await store().get(row.id);
    check(coherent.state.players.every(p=>p.ready)&&coherent.etag!==latest.etag,'heartbeat conflict preserves readiness');
    check(await writer.cas(coherent,{...coherent.state,requests:[...coherent.state.requests,'ک'.repeat(10000)]}),'fresh presence CAS succeeds');
    const large=await store().get(row.id);
    check(large.state.requests.at(-1)==='ک'.repeat(10000),'large Persian JSON round trip');
    const polling=store(),compact=await polling.getPoll(row.id,large.revision);
    check(compact.compact&&['cards','assignments','results','requests'].every(key=>!Object.hasOwn(compact.state,key)),'unchanged poll excludes heavy fields');
    check(compact.state.players.length===12&&compact.state.generation===large.state.generation&&compact.etag===large.etag,'compact poll keeps authentication and version');
    check(Buffer.byteLength(JSON.stringify(compact))<Buffer.byteLength(JSON.stringify(large))/2,'compact poll reduces transfer');
    let compactError;try{await polling.cas(compact,compact.state);}catch(error){compactError=error;}
    check(compactError instanceof TypeError&&(await store().get(row.id)).revision===large.revision,'compact CAS cannot truncate stored state');
    const changedPoll=await store().getPoll(row.id,large.revision-1);
    check(!changedPoll.compact&&changedPoll.state.requests.at(-1)==='ک'.repeat(10000),'changed poll returns full room');
    const oldTag=compact.etag,pollHeartbeat=heartbeatAt+10000;
    await polling.ping(row.id,a.credentials.playerId,pollHeartbeat);
    const polledRow=polling.rows.get(row.id);
    check(polledRow.compact&&polledRow.etag!==oldTag&&polledRow.revision===large.revision&&polledRow.people[a.credentials.playerId]===pollHeartbeat,'heartbeat keeps compact body coherent');
    // Contention with another heartbeat keeps the projection compact. A game
    // change while ping retries must instead return the newly full state.
    const contender=store(),contended=await contender.getPoll(row.id,large.revision);
    await store().ping(row.id,guests[0].credentials.playerId,pollHeartbeat);
    await contender.ping(row.id,a.credentials.playerId,pollHeartbeat+10000);
    check(contender.rows.get(row.id).compact&&contender.rows.get(row.id).etag!==contended.etag,'heartbeat contention rereads compact state');
    const stalePoller=store(),stalePoll=await stalePoller.getPoll(row.id,large.revision),fullWriter=store(),fullRow=await fullWriter.get(row.id);
    check(await fullWriter.cas(fullRow,{...fullRow.state,cardsPerPlayer:3}),'game change during compact poll succeeds');
    await stalePoller.ping(row.id,a.credentials.playerId,pollHeartbeat+20000);
    const freshPoll=stalePoller.rows.get(row.id);
    check(!freshPoll.compact&&freshPoll.revision===stalePoll.revision+1&&freshPoll.state.cardsPerPlayer===3&&freshPoll.state.requests.at(-1)==='ک'.repeat(10000),'game change during heartbeat retry restores full state');

    // A manager heartbeat commits after the claim reads old presence, before
    // its conditional write. The service must reread and refuse the takeover.
    const claimIdentity=identity();fixtureIds.push(claimIdentity.roomId);
    const claimOwner=await new GameService(store(),{clock:()=>Date.now()-60000}).create({name:'آزمون مدیر',cardsPerPlayer:1,...claimIdentity});
    const claimant=await service().join({name:'آزمون درخواست مدیریت',code:claimOwner.credentials.code,...identity()});
    let heartbeatInjected=false;
    const racing=new PostgresStore({sql:{query:async(text,params)=>{
      if(!heartbeatInjected&&text.startsWith('UPDATE forehead_v3_rooms SET state=')){
        heartbeatInjected=true;await store().ping(claimOwner.credentials.roomId,claimOwner.credentials.playerId,Date.now());
      }
      return sql.query(text,params);
    }}});
    let claimError;
    try{await new GameService(racing).action({...auth(claimant.credentials),action:'claimHost',data:{},requestId:'heartbeat_racing_host_claim'});}
    catch(error){claimError=error;}
    check(heartbeatInjected&&claimError?.code==='HOST_ONLINE','heartbeat prevents stale manager takeover');
    const claimedRoom=await store().get(claimOwner.credentials.roomId);
    check(claimedRoom.state.hostId===claimOwner.credentials.playerId&&claimedRoom.state.players.length===2,'manager race preserves host and players');

    const key=`postgres-live:${run}:quota`;limitKeys.push(key);
    const now=Date.now(),limit=(id,time=now)=>store().limit(key,3,600000,id,time);
    const limits=await Promise.allSettled(Array.from({length:12},(_,i)=>limit(String(i))));
    check(limits.filter(r=>r.status==='fulfilled').length===3,'atomic quota allows exactly three');
    check(limits.filter(r=>r.status==='rejected').every(r=>r.reason.code==='RATE_LIMIT'&&r.reason.retryAfter===Math.max(1,Math.ceil((Math.floor(now/600000)*600000+600000-now)/1000))),'quota rejects with Retry After');
    const accepted=String(limits.findIndex(r=>r.status==='fulfilled'));await limit(accepted);
    const count=await sql.query('SELECT count FROM forehead_v3_limits WHERE key=$1 AND window_start=$2',[hash(key),Math.floor(now/600000)*600000]);
    check(count[0].count===3,'quota retry does not consume slot');
    await limit('next-window',Math.floor(now/600000)*600000+600000);checks++;

    const photoOwner=await create('آزمون عکس'),photoGuest=await service().join({name:'مهمان عکس',code:photoOwner.credentials.code,...identity()});
    for(const p of [photoOwner,photoGuest])await action(p.credentials,'readyLobby',{ready:true});
    const writing=await action(photoOwner.credentials,'startWriting');
    const bytes=Buffer.alloc(614400,17);Buffer.from([137,80,78,71,13,10,26,10]).copy(bytes);
    const upload={...auth(photoOwner.credentials),cardId:writing.snapshot.ownCards[0].id,requestId:'live_photo_retry',base64:bytes.toString('base64')};
    await Promise.all(Array.from({length:3},()=>service().upload(upload)));
    const photoRow=await store().get(photoOwner.credentials.roomId),card=photoRow.state.cards.find(c=>c.id===upload.cardId);
    check(card.imageUrl==='cloud-photo:'+card.imagePath,'photo stays a private marker');
    check(!JSON.stringify(photoRow.state).includes(upload.base64),'photo bytes stay outside room JSON');
    const photo=await store().photo(card.imagePath),received=Buffer.from(await new Response(photo.stream).arrayBuffer());
    check(photo.blob.contentType==='image/png'&&bytes.equals(received),'maximum photo bytes round trip');
    const photoCount=await sql.query('SELECT count(*) AS n FROM forehead_v3_photos WHERE room_id=$1::uuid',[photoRow.id]);
    check(Number(photoCount[0].n)===1,'concurrent upload retry retains one committed photo');
    await store().removeImages([]);check(await store().photo(`${photoRow.id}/missing.png`)===null,'missing photo is absent');

    const expiredRoom=createRoom({name:'آزمون منقضی',now:Date.now()-25*3600000}).room;fixtureIds.push(expiredRoom.id);
    await store().insert(expiredRoom);await store().ping(expiredRoom.id,expiredRoom.creatorId,expiredRoom.createdAt);
    const expiredPath=`${expiredRoom.id}/old.png`,orphanPath=`${photoRow.id}/orphan.png`;
    await store().upload(expiredPath,Buffer.from([137,80,78,71]),'image/png');
    await store().upload(orphanPath,Buffer.from([137,80,78,71]),'image/png');
    await sql.query('UPDATE forehead_v3_photos SET created_at=$1 WHERE path=ANY($2::text[])',[Date.now()-3600000,[card.imagePath,orphanPath]]);
    const oldKey=`postgres-live:${run}:expired-quota`;limitKeys.push(oldKey);
    await store().limit(oldKey,3,600000,'old',Date.now()-3600000);
    const extension=createRoom({name:'آزمون تمدید',now:Date.now()-25*3600000}).room;fixtureIds.push(extension.id);
    const cached=store(),beforeExtension=await cached.insert(extension);
    check(await store().cas(beforeExtension,{...beforeExtension.state,expiresAt:Date.now()+3600000}),'concurrent expiry extension persists');
    const cleanup=await cached.cleanup(Date.now(),{roomIds:fixtureIds,limitKeys});
    check(cleanup.removed>=3&&cleanup.scanned>=fixtureIds.length,'scoped cleanup reports work');
    const remaining=await sql.query('SELECT id FROM forehead_v3_rooms WHERE id=ANY($1::uuid[])',[fixtureIds]);
    check(!remaining.some(r=>r.id===expiredRoom.id)&&remaining.some(r=>r.id===photoRow.id)&&remaining.some(r=>r.id===extension.id),'cleanup preserves active and extended rooms');
    check(await store().photo(expiredPath)===null&&await store().photo(orphanPath)===null&&Boolean(await store().photo(card.imagePath)),'cleanup cascades expired and removes unused photos only');
    const expiredPresence=await sql.query('SELECT count(*) AS n FROM forehead_v3_presence WHERE room_id=$1::uuid',[expiredRoom.id]);
    check(Number(expiredPresence[0].n)===0,'expired presence cascades');
    const expiredQuota=await sql.query('SELECT count(*) AS n FROM forehead_v3_limits WHERE key=$1',[hash(oldKey)]);
    check(Number(expiredQuota[0].n)===0,'old quota removed');
    await action(photoOwner.credentials,'reset',{confirm:true});
    check(await store().photo(card.imagePath)===null,'replay removes prior photo');
  } catch(error) { finalFailure=safeError(error); }
  finally {
    try {
      // Every mutation is bound to UUIDs / quota hashes created by this run.
      if(!targetVerified)throw new FixtureFailure('Fixture check failed: no owned target verified');
      await sql.query('DELETE FROM forehead_v3_rooms WHERE id=ANY($1::uuid[])',[fixtureIds]);
      await sql.query('DELETE FROM forehead_v3_limits WHERE key=ANY($1::text[])',[limitKeys.map(hash)]);
      const leftovers=await sql.query(`SELECT (SELECT count(*) FROM forehead_v3_rooms WHERE id=ANY($1::uuid[]))+
        (SELECT count(*) FROM forehead_v3_photos WHERE room_id=ANY($1::uuid[]))+
        (SELECT count(*) FROM forehead_v3_presence WHERE room_id=ANY($1::uuid[]))+
        (SELECT count(*) FROM forehead_v3_limits WHERE key=ANY($2::text[])) AS n`,[fixtureIds,limitKeys.map(hash)]);
      check(Number(leftovers[0].n)===0,'owned fixtures fully removed');
    } catch(error) { finalFailure??=safeError(error); }
  }
  if(finalFailure)throw finalFailure;
  console.log(JSON.stringify({provider:'Neon Postgres',checks,concurrentPlayers:12,maxPhotoBytes:614400,ownedFixturesRemaining:0}));
});
