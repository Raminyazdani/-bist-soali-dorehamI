import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {GameService} from './service.mjs';
import {authenticate,GameError,snapshot} from './game.mjs';
import {PHOTO_PREFIX} from './blob-store.mjs';
import {clientAddress,photoLink,requestGuard,verifyPhoto} from './security.mjs';
import {BlobError} from '@vercel/blob';
import {importImageUrl} from './image-import.mjs';

const visibleCards=s=>[...(s.ownCards??[]),s.turn?.card,...(s.completedCards??[]).map(r=>r.card)].filter(Boolean);
function json(res,status,value) { res.statusCode=status; res.setHeader('Content-Type','application/json; charset=utf-8'); res.setHeader('Cache-Control','no-store'); res.end(JSON.stringify(value)); }
async function body(req) {
  if(req.body&&typeof req.body==='object'){
    if(Buffer.byteLength(JSON.stringify(req.body))>1000000)throw new GameError('درخواست بیش از حد بزرگ است.',413,'TOO_LARGE');
    return req.body;
  }
  let size=0,parts=[];
  for await(const chunk of req){size+=chunk.length;if(size>1000000)throw new GameError('درخواست بیش از حد بزرگ است.',413,'TOO_LARGE');parts.push(chunk);}
  try{return JSON.parse(Buffer.concat(parts).toString());}catch{throw new GameError('درخواست نامعتبر است.',400,'BAD_JSON');}
}
function sdkReason(error) {
  if(!(error instanceof BlobError)||typeof error.message!=='string')return undefined;
  let reason=error.message;
  for(const value of [process.env.BLOB_READ_WRITE_TOKEN,process.env.CRON_SECRET,process.env.VERCEL_OIDC_TOKEN]){
    if(value)for(const encoded of [value,encodeURIComponent(value),JSON.stringify(value).slice(1,-1)])reason=reason.split(encoded).join('[redacted]');
  }
  return reason
    .replace(/https?:\/\/[^\s<>"'()[\]{}]+/gi,'[redacted URL]')
    .replace(/\bBearer\s+(?:"[^"]*"|'[^']*'|[^\s,;"'<>()[\]{}]+)/gi,'Bearer [redacted]')
    .replace(/\b([\w-]*(?:token|secret|signature)[\w-]*)["']?\s*[:=]\s*(?:"[^"]*"|'[^']*'|[^\s,;<>()[\]{}]+)/gi,'$1=[redacted]')
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,'[redacted ID]')
    .replace(/\b[A-Za-z0-9_-]{2,}(?:\.[A-Za-z0-9_-]{2,}){2,4}\b/g,'[redacted JWT]')
    .replace(/[A-Za-z0-9_+/=-]{32,}/g,'[redacted identifier]')
    .replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,200);
}
function fail(res,error) {
  if(error.retryAfter)res.setHeader('Retry-After',String(error.retryAfter));
  if(error instanceof GameError)return json(res,error.status||400,{error:error.message,code:error.code});
  const identifier=value=>typeof value==='string'&&/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(value)?value:'';
  const status=typeof error?.message==='string'?error.message.match(/^(?:Vercel Blob: )?Failed to fetch blob: ([1-5]\d{2})(?: |$)/)?.[1]:undefined;
  const reason=sdkReason(error);
  console.error('Game backend:',{kind:identifier(error?.constructor?.name),code:identifier(error?.code),causeCode:identifier(error?.cause?.code),...(status?{httpStatus:Number(status)}:{}),...(reason?{reason}:{})});
  json(res,503,{error:'اتصال بازی برقرار نشد؛ کمی بعد دوباره امتحان کن.',code:'SERVICE_UNAVAILABLE'});
}
export async function gameRequest(req,res,storage) {
  if(req.method!=='POST'){res.setHeader('Allow','POST');return json(res,405,{error:'درخواست نامعتبر است.',code:'METHOD'});}
  try {
    requestGuard(req);
    const data=await body(req);
    if(!data||typeof data!=='object'||Array.isArray(data))throw new GameError('درخواست نامعتبر است.',400,'BAD_JSON');
    if(storage.configured&&!storage.configured())throw new GameError('بازی هنوز آماده نیست؛ کمی بعد دوباره امتحان کن.',503,'SERVICE_NOT_CONFIGURED');
    if(data.type==='config')return json(res,200,{transport:'server'});
    const service=new GameService(storage);
    if(!['create','join','state','action','upload'].includes(data.type))throw new GameError('درخواست نامعتبر است.',400,'UNKNOWN_ACTION');
    if(data.type==='create')await storage.limit('create:'+clientAddress(req),8,600000,data.roomId);
    if(data.type==='join')await storage.limit('join:'+clientAddress(req),80,600000,data.playerId?data.code+':'+data.playerId:undefined);
    if(data.type==='upload'){
      const row=await storage.get(data.roomId);authenticate(row.state,data.playerId,data.token);
      await storage.limit('upload:'+data.roomId+':'+data.playerId,50,600000,data.requestId);
    }
    const result=await service[data.type](data);
    const credentials=result.credentials??{...data,roomId:result.snapshot?.id??data.roomId,playerId:result.snapshot?.you??data.playerId};
    if(result.snapshot)for(const card of visibleCards(result.snapshot))if(card.imageUrl?.startsWith(PHOTO_PREFIX)){
      const row=storage.rows?.get(credentials.roomId)??await storage.get(credentials.roomId);
      card.imageUrl=photoLink(row.state,credentials.playerId,card.imageUrl.slice(PHOTO_PREFIX.length),result.snapshot.serverNow);
    }
    json(res,200,result);
  } catch(error) { fail(res,error); }
}
export async function photoRequest(req,res,storage) {
  if(req.method!=='GET')return json(res,405,{error:'درخواست نامعتبر است.',code:'METHOD'});
  try {
    const params=new URL(req.url,'http://localhost').searchParams;
    const row=await storage.get(params.get('roomId'));
    const playerId=verifyPhoto(row.state,params);
    const path=params.get('path'),view=snapshot(row.state,playerId,row.revision);
    if(!path||!visibleCards(view).some(card=>card.imageUrl===PHOTO_PREFIX+path))throw new GameError('این عکس هنوز برای تو نمایش داده نمی‌شود.',403,'PHOTO_HIDDEN');
    const image=await storage.photo(path);
    if(!image)throw new GameError('عکس پیدا نشد.',404,'NOT_FOUND');
    res.setHeader('Content-Type',image.blob.contentType);res.setHeader('Cache-Control','private, no-store');res.setHeader('X-Content-Type-Options','nosniff');
    await pipeline(Readable.fromWeb(image.stream),res);
  } catch(error) { if(!res.headersSent)fail(res,error);else res.destroy(error); }
}
export async function imageImportRequest(req,res,storage,importer=importImageUrl) {
  if(req.method!=='POST'){res.setHeader('Allow','POST');return json(res,405,{error:'درخواست نامعتبر است.',code:'METHOD'});}
  try {
    requestGuard(req);
    const data=await body(req);
    if(!data||typeof data!=='object'||Array.isArray(data))throw new GameError('درخواست نامعتبر است.',400,'BAD_JSON');
    if(storage.configured&&!storage.configured())throw new GameError('بازی هنوز آماده نیست.',503,'SERVICE_NOT_CONFIGURED');
    const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if(typeof data.roomId!=='string'||!uuid.test(data.roomId)||typeof data.playerId!=='string'||!uuid.test(data.playerId))throw new GameError('شناسهٔ لابی یا بازیکن نامعتبر است.',400,'BAD_ID');
    if(typeof data.requestId!=='string'||!/^[a-zA-Z0-9_-]{8,100}$/.test(data.requestId))throw new GameError('شناسهٔ درخواست نامعتبر است.',400,'BAD_REQUEST_ID');
    const roomId=data.roomId.toLowerCase(),playerId=data.playerId.toLowerCase();
    const editable=async()=>{
      const row=await storage.get(roomId),actor=authenticate(row.state,playerId,data.token);
      if(data.generation!==undefined&&data.generation!==row.state.generation)throw new GameError('بازی تازه شروع شده؛ صفحه را به‌روز کن.',400,'STALE_GAME');
      if(row.state.phase!=='writing'||actor.ready)throw new GameError('برای ویرایش، آمادگی‌ات را بردار.',400,'CARDS_LOCKED');
      if(!row.state.cards.some(card=>card.id===data.cardId&&card.authorId===actor.id))throw new GameError('این کارت متعلق به تو نیست.',400,'NOT_YOUR_CARD');
    };
    await editable();
    // Each outbound fetch consumes a slot, even if a caller repeats its ID.
    // Import is read-only; idempotency is applied by the existing final upload.
    await storage.limit('image-import:'+roomId+':'+playerId,20,600000);
    const image=await importer(data.url,{maxBytes:3*1024*1024});
    await editable();
    res.setHeader('Content-Type',image.contentType);res.setHeader('Content-Length',image.bytes.length);
    res.setHeader('Cache-Control','private, no-store');res.setHeader('X-Content-Type-Options','nosniff');
    res.statusCode=200;res.end(image.bytes);
  } catch(error) { fail(res,error); }
}
export async function cleanupRequest(req,res,storage,secret=process.env.CRON_SECRET) {
  if(req.method!=='GET')return json(res,405,{error:'درخواست نامعتبر است.',code:'METHOD'});
  if(!secret||req.headers.authorization!==`Bearer ${secret}`)return json(res,401,{error:'دسترسی مجاز نیست.',code:'UNAUTHORIZED'});
  try{json(res,200,await storage.cleanup());}catch(error){fail(res,error);}
}
