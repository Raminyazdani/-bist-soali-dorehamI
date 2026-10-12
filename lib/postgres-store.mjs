import {neon} from '@neondatabase/serverless';
import {GameError} from './game.mjs';
import {hash} from './crypto.mjs';

const PHOTO_PREFIX='cloud-photo:';
const uuid=id=>typeof id==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
const missing=()=>new GameError('این لابی پیدا نشد؛ کد را بررسی کن.',404,'NOT_FOUND');
const columns=(state='r.state',compact='false')=>`r.id,r.revision,r.version,${state} AS state,${compact} AS compact,r.creator_id AS "creatorId",
  COALESCE((SELECT jsonb_object_agg(p.player_id::text,p.last_seen) FROM forehead_v3_presence p WHERE p.room_id=r.id),'{}'::jsonb) AS people`;

// One instance per HTTP request. SQL is authoritative; this map only avoids
// repeated reads within the same request, never between requests or instances.
export class PostgresStore {
  constructor(options={}) {
    this.connection=options.connection??process.env.DATABASE_URL;
    this.sql=options.sql??(this.connection?neon(this.connection):null);
    this.rows=new Map();
  }
  configured() { return Boolean(this.sql); }
  query(text,params=[]) {
    if(!this.sql)throw new GameError('بازی هنوز آماده نیست؛ کمی بعد دوباره امتحان کن.',503,'SERVICE_NOT_CONFIGURED');
    return this.sql.query(text,params);
  }
  remember(row) {
    const value={...row,revision:Number(row.revision),etag:String(row.version),compact:Boolean(row.compact),people:row.people??{}};
    this.rows.set(value.id,value);return value;
  }
  async insert(room) {
    // A unique room ID and code are reserved in the same statement. A lost
    // response can therefore recover the existing room without a dangling code.
    const rows=await this.query(`INSERT INTO forehead_v3_rooms(id,code,revision,state,creator_id,expires_at)
      VALUES($1::uuid,$2,0,$3::jsonb,$4::uuid,$5)
      ON CONFLICT DO NOTHING RETURNING id,revision,version,state,creator_id AS "creatorId"`,
    [room.id,room.code,JSON.stringify(room),room.creatorId,room.expiresAt]);
    return rows[0]?this.remember(rows[0]):null;
  }
  async get(id) { return this.getPoll(id); }
  async getPoll(id,knownRevision) {
    if(!uuid(id))throw new GameError('شناسهٔ لابی نامعتبر است.',400,'BAD_ID');
    const known=Number.isSafeInteger(knownRevision)&&knownRevision>=0?knownRevision:null;
    const unchanged='$2::bigint IS NOT NULL AND r.revision=$2';
    // Projection happens in SQL, so unchanged polls never transfer the deck,
    // assignments, results or request history from the database to the function.
    const state=`CASE WHEN ${unchanged} THEN r.state-ARRAY['cards','assignments','results','requests']::text[] ELSE r.state END`;
    const rows=await this.query(`SELECT ${columns(state,unchanged)} FROM forehead_v3_rooms r WHERE r.id=$1::uuid`,[id,known]);
    if(!rows[0])throw missing();return this.remember(rows[0]);
  }
  async byCode(code) {
    const rows=await this.query(`SELECT ${columns()} FROM forehead_v3_rooms r WHERE r.code=$1`,[code]);
    if(!rows[0])throw missing();return this.remember(rows[0]);
  }
  async cas(row,state) {
    if(row.compact)throw new TypeError('Cannot write compact room state');
    // The opaque version covers both game state and presence from the same read.
    // PostgreSQL rechecks it after a concurrent updater / heartbeat commits.
    const rows=await this.query(`UPDATE forehead_v3_rooms SET state=$1::jsonb,revision=revision+1,version=version+1,expires_at=$2
      WHERE id=$3::uuid AND revision=$4 AND version=$5
      RETURNING id,revision,version,state,creator_id AS "creatorId"`,
    [JSON.stringify(state),state.expiresAt,row.id,row.revision,row.etag]);
    if(!rows[0])return false;
    this.remember({...rows[0],people:this.rows.get(row.id)?.people??row.people});return true;
  }
  async ping(id,player,now) {
    let row=this.rows.get(id)??await this.get(id);
    for(let tries=0;tries<24;tries++){
      if(now-(row.people[player]??0)<8000)return;
      // Both writes commit together. If our body version lost a race, neither
      // write happens; reread before retrying instead of blessing an old body.
      const values=await this.query(`WITH updated AS (
        UPDATE forehead_v3_rooms SET version=version+1 WHERE id=$1::uuid AND version=$4 RETURNING version
      ), heartbeat AS (
        INSERT INTO forehead_v3_presence(room_id,player_id,last_seen)
        SELECT $1::uuid,$2::uuid,$3 FROM updated ON CONFLICT(room_id,player_id) DO UPDATE
        SET last_seen=GREATEST(forehead_v3_presence.last_seen,EXCLUDED.last_seen) RETURNING last_seen
      ) SELECT version,last_seen FROM updated,heartbeat`,[id,player,now,row.etag]);
      if(values[0]){
        this.remember({...row,version:values[0].version,people:{...row.people,[player]:Number(values[0].last_seen)}});return;
      }
      row=row.compact?await this.getPoll(id,row.revision):await this.get(id);
    }
    // A redundant heartbeat can retry on the next poll; committed commands
    // must not be reported as failed because another heartbeat won contention.
  }
  async presence(id) { return {...(this.rows.get(id)??await this.get(id)).people}; }
  async upload(path,bytes,mime) {
    await this.query(`INSERT INTO forehead_v3_photos(path,room_id,bytes,mime,created_at)
      VALUES($1,$2::uuid,$3::bytea,$4,$5)`,[path,path.split('/')[0],bytes,mime,Date.now()]);
    return PHOTO_PREFIX+path;
  }
  async photo(path) {
    const rows=await this.query('SELECT bytes,mime FROM forehead_v3_photos WHERE path=$1',[path]);
    if(!rows[0])return null;
    return {stream:new Response(rows[0].bytes).body,blob:{contentType:rows[0].mime}};
  }
  async removeImages(paths) {
    if(paths.length)await this.query('DELETE FROM forehead_v3_photos WHERE path=ANY($1::text[])',[paths]);
  }
  async limit(key,maximum,windowMs,requestId,now=Date.now()) {
    const start=Math.floor(now/windowMs)*windowMs,request=requestId||null;
    // The row lock and conditional UPSERT jointly enforce the quota and retry
    // deduplication. A rejected request neither increments nor consumes a slot.
    const rows=await this.query(`INSERT INTO forehead_v3_limits(key,window_start,count,requests,expires_at)
      VALUES($1,$2,1,CASE WHEN $3::text IS NULL THEN '{}'::text[] ELSE ARRAY[$3::text] END,$4)
      ON CONFLICT(key,window_start) DO UPDATE SET
        count=CASE WHEN $3::text IS NOT NULL AND $3=ANY(forehead_v3_limits.requests)
          THEN forehead_v3_limits.count ELSE forehead_v3_limits.count+1 END,
        requests=CASE WHEN $3::text IS NULL OR $3=ANY(forehead_v3_limits.requests)
          THEN forehead_v3_limits.requests ELSE array_append(forehead_v3_limits.requests,$3) END
      WHERE ($3::text IS NOT NULL AND $3=ANY(forehead_v3_limits.requests)) OR forehead_v3_limits.count<$5
      RETURNING count`,[hash(key),start,request,start+windowMs,maximum]);
    if(rows.length)return;
    const error=new GameError('کمی صبر کن؛ تعداد درخواست‌ها زیاد شده است.',429,'RATE_LIMIT');
    error.retryAfter=Math.max(1,Math.ceil((start+windowMs-now)/1000));throw error;
  }
  async cleanup(now=Date.now(),scope) {
    // Optional maintenance scope lets verification clean only its own fixtures.
    // The public cron supplies no scope and handles every expired game.
    if(scope&&(!Array.isArray(scope.roomIds)||!Array.isArray(scope.limitKeys)))throw new TypeError('Invalid cleanup scope');
    const rooms=scope?scope.roomIds:null,keys=scope?scope.limitKeys.map(hash):null;
    const counts=await this.query(`SELECT
      (SELECT count(*) FROM forehead_v3_rooms WHERE $1::uuid[] IS NULL OR id=ANY($1))+
      (SELECT count(*) FROM forehead_v3_photos WHERE $1::uuid[] IS NULL OR room_id=ANY($1))+
      (SELECT count(*) FROM forehead_v3_limits WHERE $2::text[] IS NULL OR key=ANY($2)) AS scanned`,[rooms,keys]);
    // A conditional DELETE rechecks expires_at if a concurrent CAS extends it.
    // Foreign keys remove the deleted room's presence and photos atomically.
    const expired=await this.query(`DELETE FROM forehead_v3_rooms WHERE expires_at<=$1
      AND ($2::uuid[] IS NULL OR id=ANY($2)) RETURNING id`,[now,rooms]);
    const photos=await this.query(`DELETE FROM forehead_v3_photos p WHERE created_at<$1
      AND ($2::uuid[] IS NULL OR room_id=ANY($2)) AND NOT EXISTS
      (SELECT 1 FROM forehead_v3_rooms r,jsonb_array_elements(r.state->'cards') c
       WHERE r.id=p.room_id AND c->>'imagePath'=p.path) RETURNING path`,[now-900000,rooms]);
    const limits=await this.query(`DELETE FROM forehead_v3_limits WHERE expires_at<=$1
      AND ($2::text[] IS NULL OR key=ANY($2)) RETURNING key`,[now,keys]);
    for(const row of expired)this.rows.delete(row.id);
    return {removed:expired.length+photos.length+limits.length,scanned:Number(counts[0].scanned)};
  }
}
