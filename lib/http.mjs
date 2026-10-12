import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {GameService} from './service.mjs';
import {authenticate,GameError,snapshot} from './game.mjs';
import {PHOTO_PREFIX} from './blob-store.mjs';
import {clientAddress,photoLink,requestGuard,verifyPhoto} from './security.mjs';

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
function fail(res,error) {
  if(error.retryAfter)res.setHeader('Retry-After',String(error.retryAfter));
  if(error instanceof GameError)return json(res,error.status||400,{error:error.message,code:error.code});
  const identifier=value=>typeof value==='string'&&/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(value)?value:'';
  const status=typeof error?.message==='string'?error.message.match(/^(?:Vercel Blob: )?Failed to fetch blob: ([1-5]\d{2})(?: |$)/)?.[1]:undefined;
  console.error('Game backend:',{kind:identifier(error?.constructor?.name),code:identifier(error?.code),causeCode:identifier(error?.cause?.code),...(status?{httpStatus:Number(status)}:{})});
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
    const credentials=result.credentials??data;
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
export async function cleanupRequest(req,res,storage,secret=process.env.CRON_SECRET) {
  if(req.method!=='GET')return json(res,405,{error:'درخواست نامعتبر است.',code:'METHOD'});
  if(!secret||req.headers.authorization!==`Bearer ${secret}`)return json(res,401,{error:'دسترسی مجاز نیست.',code:'UNAUTHORIZED'});
  try{json(res,200,await storage.cleanup());}catch(error){fail(res,error);}
}
