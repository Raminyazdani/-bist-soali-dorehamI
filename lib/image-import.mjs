import { lookup as dnsLookup } from 'node:dns/promises';
import { request as httpsRequest } from 'node:https';
import { isIP } from 'node:net';
import { Buffer } from 'node:buffer';
import { GameError } from './game.mjs';

const MAX_BYTES=5*1024*1024,MAX_TIME=10000,MAX_REDIRECTS=3;
const ERRORS={
  INVALID_IMAGE_URL:['نشانی مستقیم عکس را با https وارد کن؛ نشانی نامعتبر است.',400],
  IMAGE_IMPORT_BLOCKED:['این نشانی برای واردکردن عکس مجاز نیست.',403],
  IMAGE_IMPORT_TIMEOUT:['دریافت عکس طول کشید؛ یک نشانی دیگر امتحان کن.',504],
  IMAGE_IMPORT_TOO_LARGE:['حجم عکس بیش از حد مجاز است؛ عکس کوچک‌تری انتخاب کن.',413],
  IMAGE_IMPORT_TYPE:['این نشانی یک عکس معتبر JPG، PNG، WebP، GIF یا AVIF نیست.',415],
  IMAGE_IMPORT_FAILED:['عکس از این نشانی دریافت نشد؛ نشانی مستقیم عکس را بررسی کن.',502]
};
const error=code=>new GameError(ERRORS[code][0],ERRORS[code][1],code);

// IANA special-purpose ranges are conservatively excluded, including globally
// reachable protocol/tunnel anycast. This importer needs ordinary image hosts.
const IPV4_DENY=[['0.0.0.0',8],['10.0.0.0',8],['100.64.0.0',10],['127.0.0.0',8],
  ['169.254.0.0',16],['172.16.0.0',12],['192.0.0.0',24],['192.0.2.0',24],
  ['192.31.196.0',24],['192.52.193.0',24],['192.88.99.0',24],['192.168.0.0',16],
  ['192.175.48.0',24],['198.18.0.0',15],['198.51.100.0',24],['203.0.113.0',24],
  ['224.0.0.0',4],['240.0.0.0',4],['168.63.129.16',32]];
const ipv4Number=address=>address.split('.').reduce((n,part)=>n*256+Number(part),0);
function publicAddress(address) {
  const family=isIP(address);
  if(family===4){
    const value=ipv4Number(address);
    return !IPV4_DENY.some(([base,prefix])=>Math.floor(value/2**(32-prefix))===Math.floor(ipv4Number(base)/2**(32-prefix)));
  }
  if(family!==6||address.includes('%'))return false;
  let normalized=address.toLowerCase();
  const tail=normalized.match(/\d+\.\d+\.\d+\.\d+$/);
  if(tail){const n=ipv4Number(tail[0]);normalized=normalized.slice(0,-tail[0].length)+Math.floor(n/65536).toString(16)+':'+(n%65536).toString(16);}
  const sides=normalized.split('::'),left=sides[0]?sides[0].split(':'):[],right=sides[1]?sides[1].split(':'):[];
  const words=(sides.length===1?left:[...left,...Array(8-left.length-right.length).fill('0'),...right]).map(x=>parseInt(x,16));
  if(words.length!==8||(words[0]&0xe000)!==0x2000)return false;
  // Excludes protocol assignments/Teredo, documentation, 6to4 and AS112.
  // Mapped/compatible IPs, NAT64, local, multicast and other reserved prefixes
  // are outside ordinary 2000::/3 global unicast and already fail above.
  if(words[0]===0x2001&&(words[1]<0x0200||words[1]===0x0db8))return false;
  if(words[0]===0x2002)return false;
  if((words[4]&0xfcff)===0&&words[5]===0x5efe)return false; // ISATAP interface identifier (RFC 5214).
  if(words[0]===0x2620&&words[1]===0x004f&&words[2]===0x8000)return false;
  if(words[0]===0x3fff&&words[1]<0x1000)return false;
  return true;
}

function imageUrl(input,base) {
  if(typeof input!=='string'||!input||input.length>2048||/[\u0000-\u0020\u007f\\]/.test(input))throw error('INVALID_IMAGE_URL');
  let url;try{url=base?new URL(input,base):new URL(input);}catch{throw error('INVALID_IMAGE_URL');}
  const authority=input.match(/^[a-z][a-z0-9+.-]*:\/\/([^/?#]*)/i)?.[1]??(input.startsWith('//')?input.slice(2).split(/[/?#]/)[0]:'');
  if(url.protocol!=='https:'||(url.port&&url.port!=='443')||url.username||url.password||authority.includes('@')||url.href.length>2048)throw error('INVALID_IMAGE_URL');
  const hostname=url.hostname.replace(/^\[|\]$/g,'').replace(/\.$/,'').toLowerCase();
  if(!hostname||(!isIP(hostname)&&(!hostname.includes('.')||/(?:^|\.)(?:localhost|local|localdomain|internal)$/.test(hostname))))throw error('IMAGE_IMPORT_BLOCKED');
  if(isIP(hostname)&&!publicAddress(hostname))throw error('IMAGE_IMPORT_BLOCKED');
  return {url,hostname};
}

function deadlineTask(task,signal) {
  return new Promise((resolve,reject)=>{
    if(signal.aborted){reject(signal.reason);return;}
    const abort=()=>reject(signal.reason);signal.addEventListener('abort',abort,{once:true});
    Promise.resolve().then(task).then(resolve,reject).finally(()=>signal.removeEventListener('abort',abort));
  });
}
async function addressFor(hostname,lookup,signal) {
  if(isIP(hostname))return {address:hostname,family:isIP(hostname)};
  const records=await deadlineTask(()=>lookup(hostname,{all:true,verbatim:true}),signal);
  if(!Array.isArray(records)||!records.length)throw error('IMAGE_IMPORT_FAILED');
  if(records.some(record=>typeof record?.address!=='string'||!publicAddress(record.address)||isIP(record.address)!==record.family))throw error('IMAGE_IMPORT_BLOCKED');
  return records.find(record=>record.family===4)??records[0];
}

function fetchOnce(target,address,{request,signal,maxBytes}) {
  return new Promise((resolve,reject)=>{
    let req,res,settled=false;
    const destroy=()=>{res?.destroy();req?.destroy();};
    const finish=(failure,value)=>{if(settled)return;settled=true;signal.removeEventListener('abort',abort);destroy();failure?reject(failure):resolve(value);};
    const abort=()=>finish(signal.reason??error('IMAGE_IMPORT_TIMEOUT'));
    const pinnedLookup=(hostname,options,callback)=>{
      if(typeof options==='function'){callback=options;options={};}
      if(hostname.toLowerCase().replace(/\.$/,'')!==target.hostname){callback(error('IMAGE_IMPORT_BLOCKED'));return;}
      if(options?.all)callback(null,[{address:address.address,family:address.family}]);
      else callback(null,address.address,address.family);
    };
    const response=response=>{
      res=response;res.on('error',()=>finish(error('IMAGE_IMPORT_FAILED')));
      res.on('aborted',()=>finish(error('IMAGE_IMPORT_FAILED')));
      if(settled){res.destroy();return;}
      if([301,302,303,307,308].includes(res.statusCode)){
        if(typeof res.headers.location!=='string'){finish(error('IMAGE_IMPORT_FAILED'));return;}
        finish(null,{redirect:res.headers.location});return;
      }
      if(res.statusCode!==200){finish(error('IMAGE_IMPORT_FAILED'));return;}
      const encoding=res.headers['content-encoding'];
      if(encoding&&String(encoding).trim().toLowerCase()!=='identity'){finish(error('IMAGE_IMPORT_TYPE'));return;}
      const type=typeof res.headers['content-type']==='string'?res.headers['content-type'].split(';')[0].trim().toLowerCase():'';
      if(!['image/jpeg','image/png','image/webp','image/gif','image/avif'].includes(type)){finish(error('IMAGE_IMPORT_TYPE'));return;}
      const length=res.headers['content-length'];
      if(length!==undefined&&(!/^\d+$/.test(String(length))||Number(length)>maxBytes)){finish(error(/^\d+$/.test(String(length))?'IMAGE_IMPORT_TOO_LARGE':'IMAGE_IMPORT_FAILED'));return;}
      const chunks=[];let received=0;
      res.on('data',chunk=>{
        if(settled)return;const bytes=Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk);received+=bytes.length;
        if(received>maxBytes){finish(error('IMAGE_IMPORT_TOO_LARGE'));return;}chunks.push(bytes);
      });
      res.on('end',()=>{
        if(settled)return;
        if(res.complete===false){finish(error('IMAGE_IMPORT_FAILED'));return;}
        finish(null,{bytes:Buffer.concat(chunks,received),contentType:type});
      });
    };
    try{
      req=request({protocol:'https:',hostname:target.hostname,port:443,path:target.url.pathname+target.url.search,
        method:'GET',headers:{Accept:'image/jpeg, image/png, image/webp, image/gif, image/avif','Accept-Encoding':'identity',Connection:'close'},
        lookup:pinnedLookup,family:address.family,autoSelectFamily:false,agent:false,rejectUnauthorized:true,
        ...(isIP(target.hostname)?{}:{servername:target.hostname}),maxHeaderSize:16384,signal},response);
      req.on('error',()=>finish(signal.aborted?signal.reason:error('IMAGE_IMPORT_FAILED')));
      if(settled){req.destroy();return;}
      signal.addEventListener('abort',abort,{once:true});
      if(signal.aborted){abort();return;}req.end();
    }catch{finish(signal.aborted?signal.reason:error('IMAGE_IMPORT_FAILED'));}
  });
}

function rasterType(bytes) {
  if(bytes.length>=5&&bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff&&bytes[bytes.length-2]===0xff&&bytes[bytes.length-1]===0xd9)return 'image/jpeg';
  if(bytes.length>=33&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))&&bytes.readUInt32BE(8)===13&&bytes.toString('ascii',12,16)==='IHDR'&&bytes.readUInt32BE(16)>0&&bytes.readUInt32BE(20)>0)return 'image/png';
  if(bytes.length>=20&&bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP'&&['VP8 ','VP8L','VP8X'].includes(bytes.toString('ascii',12,16))&&bytes.readUInt32LE(4)+8===bytes.length)return 'image/webp';
  if(bytes.length>=14&&['GIF87a','GIF89a'].includes(bytes.toString('ascii',0,6))&&bytes.readUInt16LE(6)>0&&bytes.readUInt16LE(8)>0&&bytes[bytes.length-1]===0x3b)return 'image/gif';
  if(bytes.length>=24&&bytes.toString('ascii',4,8)==='ftyp'){
    const size=bytes.readUInt32BE(0);
    if(size>=16&&size%4===0&&size+8<=bytes.length){
      const brands=[bytes.toString('ascii',8,12)];for(let i=16;i+4<=size;i+=4)brands.push(bytes.toString('ascii',i,i+4));
      if(brands.some(brand=>brand==='avif'||brand==='avis'))return 'image/avif';
    }
  }
  return null;
}

// Called only after the API authenticates membership, ownership and quotas.
// Limits may be reduced by an integrator/test but cannot exceed these caps.
export async function importImageUrl(input,{lookup=dnsLookup,request=httpsRequest,timeoutMs=MAX_TIME,maxBytes=MAX_BYTES,maxRedirects=MAX_REDIRECTS}={}) {
  if(typeof lookup!=='function'||typeof request!=='function'||!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>MAX_TIME||!Number.isInteger(maxBytes)||maxBytes<1||maxBytes>MAX_BYTES||!Number.isInteger(maxRedirects)||maxRedirects<0||maxRedirects>MAX_REDIRECTS)throw error('IMAGE_IMPORT_FAILED');
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(error('IMAGE_IMPORT_TIMEOUT')),timeoutMs);
  try{
    let target=imageUrl(input);
    for(let redirects=0;;redirects++){
      if(controller.signal.aborted)throw controller.signal.reason;
      const address=await addressFor(target.hostname,lookup,controller.signal);
      const result=await fetchOnce(target,address,{request,signal:controller.signal,maxBytes});
      if(result.redirect!==undefined){
        if(redirects>=maxRedirects)throw error('IMAGE_IMPORT_FAILED');
        target=imageUrl(result.redirect,target.url);continue;
      }
      if(!result.bytes.length||rasterType(result.bytes)!==result.contentType)throw error('IMAGE_IMPORT_TYPE');
      return result;
    }
  }catch(caught){throw error(Object.hasOwn(ERRORS,caught?.code)?caught.code:'IMAGE_IMPORT_FAILED');}
  finally{clearTimeout(timer);}
}
