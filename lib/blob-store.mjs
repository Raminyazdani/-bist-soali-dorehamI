import * as blob from '@vercel/blob';
import {GameError} from './game.mjs';
import {hash} from './crypto.mjs';

export const PHOTO_PREFIX='cloud-photo:';
const PREFIX='forehead-v3/';
const uuid=id=>typeof id==='string'&&/^[0-9a-f-]{36}$/i.test(id);
const exists=error=>error?.code==='EXISTS'||/already exists/i.test(error?.message??'');
// The provider also reports a concurrent conditional-write race as BlobError.
const conflict=error=>error instanceof blob.BlobPreconditionFailedError||error?.code==='PRECONDITION'||
  (error instanceof blob.BlobError&&error.message==='Vercel Blob: The conditional request cannot succeed due to a conflicting operation against this resource.');

// One instance per HTTP request. Blob is authoritative; these cached rows
// avoid rereading within one request, never between requests or instances.
export class BlobStore {
  constructor(options={}) { this.sdk=options.sdk??blob; this.token=options.token??process.env.BLOB_READ_WRITE_TOKEN; this.customSDK=Boolean(options.sdk); this.rows=new Map(); }
  configured() { return Boolean(this.customSDK||this.token||process.env.BLOB_STORE_ID); }
  options(extra={}) { return {access:'private',...(this.token?{token:this.token}:{}),...extra}; }
  async read(path) {
    // Compressed JSON responses carry weak ETags that cannot authorize CAS.
    // Read the uncoded body and its strong version together from origin.
    const result=await this.sdk.get(PREFIX+path,this.options({useCache:false,headers:{'accept-encoding':'identity'}}));
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
  async limit(key,maximum,windowMs,requestId,now=Date.now()) {
    const windowStart=Math.floor(now/windowMs)*windowMs,path=`limits/${hash(key)}-${windowStart}.json`;
    for(let attempt=0;attempt<24;attempt++){
      const old=await this.read(path),seen=old?.requests??[];
      if(requestId&&seen.includes(requestId))return;
      if((old?.count??0)>=maximum){
        const error=new GameError('کمی صبر کن؛ تعداد درخواست‌ها زیاد شده است.',429,'RATE_LIMIT');
        error.retryAfter=Math.max(1,Math.ceil((windowStart+windowMs-now)/1000));throw error;
      }
      try{
        await this.write(path,{count:(old?.count??0)+1,requests:requestId?[...seen,requestId]:seen,expiresAt:windowStart+windowMs},old?{allowOverwrite:true,ifMatch:old.etag}:{});return;
      }catch(error){if(!exists(error)&&!conflict(error))throw error;}
    }
    throw new GameError('درخواست‌های همزمان زیاد است؛ دوباره امتحان کن.',409,'BUSY');
  }
  async list(path,cursor) { return this.sdk.list(this.options({prefix:PREFIX+path,limit:200,...(cursor?{cursor}:{})})); }
  async cleanup(now=Date.now()) {
    let removed=0,scanned=0;const deletedRooms=new Set();
    for(const folder of ['rooms/','limits/','codes/','photos/']){
      let cursor;
      for(let page=0;page<5;page++){
        const listing=await this.list(folder,cursor);
        for(const item of listing.blobs){
          scanned++;
          const path=item.pathname.slice(PREFIX.length);
          if(folder==='photos/'){
            const roomId=path.split('/')[1];
            if(new Date(item.uploadedAt).getTime()<now-900000&&!await this.read(`rooms/${roomId}.json`)){
              await this.sdk.del(item.pathname,this.options());removed++;
            }
            continue;
          }
          const row=await this.read(path);if(!row)continue;
          if(folder==='rooms/'&&row.state.expiresAt<=now){
            try{await this.sdk.del(item.pathname,this.options({ifMatch:row.etag}));}
            catch(error){if(conflict(error))continue;throw error;}
            deletedRooms.add(row.id);
            let photosCursor;
            do{
              const photos=await this.list(`photos/${row.id}/`,photosCursor);
              const paths=photos.blobs.filter(photo=>new Date(photo.uploadedAt).getTime()<=now).map(photo=>photo.pathname);
              if(paths.length)await this.sdk.del(paths,this.options());
              photosCursor=photos.hasMore?photos.cursor:null;
            }while(photosCursor);
            removed++;
          }else if(folder==='limits/'&&row.expiresAt<=now){
            try{await this.sdk.del(item.pathname,this.options({ifMatch:row.etag}));removed++;}
            catch(error){if(!conflict(error))throw error;}
          }else if(folder==='codes/'&&(deletedRooms.has(row.id)||new Date(item.uploadedAt).getTime()<now-900000)&&!await this.read(`rooms/${row.id}.json`)){
            try{await this.sdk.del(item.pathname,this.options({ifMatch:row.etag}));removed++;}
            catch(error){if(!conflict(error))throw error;}
          }
        }
        if(!listing.hasMore)break;cursor=listing.cursor;
      }
    }
    return {removed,scanned};
  }
}
