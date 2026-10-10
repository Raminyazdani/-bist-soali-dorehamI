import * as blob from '@vercel/blob';
import {GameError} from './game.mjs';

export const PHOTO_PREFIX='cloud-photo:';
const PREFIX='forehead-v3/';
const uuid=id=>typeof id==='string'&&/^[0-9a-f-]{36}$/i.test(id);
const exists=error=>error?.code==='EXISTS'||/already exists/i.test(error?.message??'');
const conflict=error=>error instanceof blob.BlobPreconditionFailedError||error?.code==='PRECONDITION';

// One instance per HTTP request. Blob is authoritative; these cached rows
// avoid rereading within one request, never between requests or instances.
export class BlobStore {
  constructor(options={}) { this.sdk=options.sdk??blob; this.token=options.token??process.env.BLOB_READ_WRITE_TOKEN; this.rows=new Map(); }
  options(extra={}) { return {access:'private',...(this.token?{token:this.token}:{}),...extra}; }
  async read(path) {
    const result=await this.sdk.get(PREFIX+path,this.options({useCache:false}));
    if(!result)return null;
    return {...await new Response(result.stream).json(),etag:result.blob.etag};
  }
  async write(path,value,extra={}) {
    const {etag,...data}=value;
    const result=await this.sdk.put(PREFIX+path,JSON.stringify(data),this.options({addRandomSuffix:false,contentType:'application/json',...extra}));
    return {...data,etag:result.etag};
  }
  async insert(room) {
    let reservation;
    try { reservation=await this.write(`codes/${room.code}.json`,{id:room.id}); }
    catch(error) { if(exists(error))return null; throw error; }
    try {
      const row=await this.write(`rooms/${room.id}.json`,{id:room.id,revision:0,state:room,creatorId:room.creatorId,people:{}});
      this.rows.set(row.id,row); return row;
    } catch(error) {
      // An unknown upload error can mean the room committed but its response
      // was lost. Keep its code so the idempotent create retry can recover it.
      if(!exists(error))throw error;
      // A retried create may reserve a second code before finding the same UUID.
      await this.sdk.del(PREFIX+`codes/${room.code}.json`,this.options({ifMatch:reservation.etag}));
      return null;
    }
  }
  async get(id) {
    if(!uuid(id))throw new GameError('شناسهٔ لابی نامعتبر است.',400,'BAD_ID');
    const row=await this.read(`rooms/${id}.json`);
    if(!row)throw new GameError('این لابی پیدا نشد؛ کد را بررسی کن.',404,'NOT_FOUND');
    this.rows.set(id,row); return row;
  }
  async byCode(code) {
    const index=await this.read(`codes/${code}.json`);
    if(!index)throw new GameError('این لابی پیدا نشد؛ کد را بررسی کن.',404,'NOT_FOUND');
    return this.get(index.id);
  }
  async cas(row,state) {
    try {
      const next=await this.write(`rooms/${row.id}.json`,{...row,state,revision:Number(row.revision)+1},{allowOverwrite:true,ifMatch:row.etag});
      this.rows.set(row.id,next); return true;
    } catch(error) {
      if(conflict(error)){await new Promise(resolve=>setTimeout(resolve,10+Math.floor(Math.random()*45)));return false;}
      throw error;
    }
  }
  async ping(id,player,now) {
    let row=this.rows.get(id)??await this.get(id);
    // Heartbeats do not change the game revision. ETags still prevent lost
    // updates when a heartbeat overlaps another heartbeat or a game command.
    for(let tries=0;tries<8;tries++){
      if(now-(row.people?.[player]??0)<8000)return;
      try {
        const next=await this.write(`rooms/${id}.json`,{...row,people:{...row.people,[player]:now}},{allowOverwrite:true,ifMatch:row.etag});
        this.rows.set(id,next); return;
      } catch(error) { if(!conflict(error))throw error; row=await this.get(id); }
    }
    // Do not report an already-committed command as failed because a redundant
    // heartbeat lost contention; the next poll retries it.
  }
  async presence(id) { return {...(this.rows.get(id)??await this.get(id)).people}; }
  async upload(path,bytes,mime) {
    await this.sdk.put(PREFIX+'photos/'+path,bytes,this.options({contentType:mime,addRandomSuffix:false}));
    return PHOTO_PREFIX+path;
  }
  async photo(path) { return this.sdk.get(PREFIX+'photos/'+path,this.options()); }
  async removeImages(paths) { if(paths.length)await this.sdk.del(paths.map(path=>PREFIX+'photos/'+path),this.options()); }
}
