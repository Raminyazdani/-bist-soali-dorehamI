import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough, Readable } from 'node:stream';
import { setImmediate as yieldTurn } from 'node:timers/promises';
import { importImageUrl } from '../lib/image-import.mjs';
import { GameError } from '../lib/game.mjs';

const PUBLIC='93.184.216.34',PUBLIC6='2606:4700:4700::1111';
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZPmcAAAAASUVORK5CYII=','base64');
const GIF=Buffer.from('R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==','base64');
const JPEG=Buffer.from([0xff,0xd8,0xff,0xe0,0,2,0xff,0xd9]);
const WEBP=Buffer.concat([Buffer.from('RIFF'),Buffer.from([16,0,0,0]),Buffer.from('WEBPVP8L'),Buffer.from([4,0,0,0,0x2f,0,0,0])]);
const AVIF=Buffer.concat([Buffer.from([0,0,0,24]),Buffer.from('ftypavif'),Buffer.alloc(4),Buffer.from('avifmif1'),Buffer.from([0,0,0,9]),Buffer.from('mdat'),Buffer.from([0])]);

function transport(plans=[{}]) {
  const calls=[],resources=[];
  const request=(options,callback)=>{
    const plan=plans[calls.length];if(!plan)throw new Error('unexpected request');
    const req=new EventEmitter();req.destroyed=false;req.destroy=()=>{req.destroyed=true;};
    calls.push(options);resources.push({req});
    req.end=()=>queueMicrotask(()=>{
      if(req.destroyed)return;
      options.lookup(options.hostname,{all:true},(failure,addresses)=>{
        if(failure){req.emit('error',failure);return;}
        resources.at(-1).addresses=addresses;
        if(plan.error){req.emit('error',plan.error);return;}
        if(plan.noHeaders)return;
        const res=plan.hang?new PassThrough():Readable.from(plan.chunks??[plan.body??PNG]);
        res.statusCode=plan.status??200;res.headers={'content-type':'image/png',...plan.headers};res.complete=plan.complete??true;
        resources.at(-1).res=res;callback(res);
        if(plan.afterResponse)plan.afterResponse(res);
      });
    });
    return req;
  };
  return {request,calls,resources};
}
const dns=async()=>[{address:PUBLIC,family:4}];
function deps(transport,extra={}){return {lookup:dns,request:transport.request,...extra};}
const rejectsCode=(promise,code)=>assert.rejects(promise,error=>error instanceof GameError&&error.code===code&&/[\u0600-\u06ff]/.test(error.message));

test('only direct HTTPS URLs on port 443 without userinfo or controls can reach DNS',async()=>{
  for(const url of ['http://example.com/x','ftp://example.com/x','file:///tmp/x','data:image/png;base64,a',
    'https://example.com:444/x','https://user:password@example.com/x','https://@example.com/x',
    'https://example.com/x\nheader','https://example.com/'+ 'a'.repeat(2048),[],null]){
    let lookups=0;
    await rejectsCode(importImageUrl(url,{lookup:async()=>{lookups++;return dns();},request:()=>{throw new Error('must not request');}}),'INVALID_IMAGE_URL');
    assert.equal(lookups,0);
  }
});

test('private, reserved, metadata and alternate-notation IPv4 literals are rejected without DNS or requests',async()=>{
  for(const host of ['0.0.0.0','10.4.3.2','100.64.0.1','127.0.0.1','169.254.169.254','172.16.0.1',
    '192.0.0.9','192.168.1.1','198.18.0.1','198.51.100.1','203.0.113.1','224.0.0.1','240.0.0.1',
    '255.255.255.255','168.63.129.16','2130706433','0x7f000001','0177.0.0.1']){
    await rejectsCode(importImageUrl(`https://${host}/photo`,{lookup:()=>{throw new Error('must not resolve');},request:()=>{throw new Error('must not connect');}}),'IMAGE_IMPORT_BLOCKED');
  }
  for(const host of ['localhost','localhost.','a.localhost','metadata.google.internal','host.docker.internal','a.local','a.localdomain']){
    await rejectsCode(importImageUrl(`https://${host}/photo`,{lookup:()=>{throw new Error('must not resolve');},request:()=>{throw new Error('must not connect');}}),'IMAGE_IMPORT_BLOCKED');
  }
});

test('IPv6 local, mapped, NAT64, tunnel, documentation and multicast targets are rejected',async()=>{
  for(const host of ['::','::1','::ffff:127.0.0.1','::ffff:8.8.8.8','::8.8.8.8','fc00::1','fd00:ec2::254',
    'fe80::1','fec0::1','ff02::1','64:ff9b::a9fe:a9fe','64:ff9b:1::a00:1','2001::1',
    '2001:2::1','2001:db8::1','2002:7f00:1::','2001:4860:4860:0:0:5efe:127.0.0.1',
    '2001:4860:4860:0:200:5efe:10.0.0.1','3fff::1','5f00::1']){
    await rejectsCode(importImageUrl(`https://[${host}]/photo`,{lookup:()=>{throw new Error('must not resolve');},request:()=>{throw new Error('must not connect');}}),'IMAGE_IMPORT_BLOCKED');
  }
});

test('any private or malformed DNS answer blocks a mixed public/private hostname before connecting',async()=>{
  for(const bad of [{address:'127.0.0.1',family:4},{address:'169.254.169.254',family:4},
    {address:'::ffff:10.0.0.1',family:6},{address:PUBLIC6,family:4},{address:'not-an-ip',family:4}]){
    const wire=transport();
    await rejectsCode(importImageUrl('https://example.com/photo',deps(wire,{lookup:async()=>[{address:PUBLIC,family:4},bad]})),'IMAGE_IMPORT_BLOCKED');
    assert.equal(wire.calls.length,0);
  }
});

test('a DNS-rebinding hostname is pinned to its validated address with original TLS hostname and no credentials',async()=>{
  const wire=transport();let lookups=0;
  const result=await importImageUrl('https://example.com:443/photo?size=1#ignored',deps(wire,{lookup:async()=>{
    lookups++;return [{address:lookups===1?PUBLIC:'127.0.0.1',family:4}];
  },headers:{Authorization:'never-forward',Cookie:'never-forward'}}));
  assert.equal(lookups,1);assert.deepEqual(result.bytes,PNG);assert.equal(result.contentType,'image/png');
  const options=wire.calls[0];assert.equal(options.hostname,'example.com');assert.equal(options.servername,'example.com');
  assert.equal(options.rejectUnauthorized,true);assert.equal(options.agent,false);assert.equal(options.autoSelectFamily,false);
  assert.equal(options.path,'/photo?size=1');assert.equal(options.headers['Accept-Encoding'],'identity');assert.equal(options.headers.Connection,'close');
  assert.deepEqual(Object.keys(options.headers).sort(),['Accept','Accept-Encoding','Connection']);
  assert.deepEqual(wire.resources[0].addresses,[{address:PUBLIC,family:4}]);
  assert.equal(wire.resources[0].req.destroyed,true);assert.equal(wire.resources[0].res.destroyed,true);
});

test('ordinary public IPv4 and IPv6 literals work without an unpinned DNS resolution',async()=>{
  for(const host of [PUBLIC,`[${PUBLIC6}]`]){
    const wire=transport();
    assert.deepEqual((await importImageUrl(`https://${host}/photo`,deps(wire,{lookup:()=>{throw new Error('literal needs no DNS');}}))).bytes,PNG);
  }
});

test('each redirect revalidates scheme, credentials, port and every DNS answer',async()=>{
  for(const location of ['http://example.com/photo','https://user:pass@example.com/photo','https://example.com:444/photo',
    'https://127.0.0.1/photo','https://[64:ff9b::a9fe:a9fe]/photo','https://private.example/photo']){
    const wire=transport([{status:302,headers:{location}}]);
    const expected=location.includes('http:')||location.includes('user:')||location.includes(':444')?'INVALID_IMAGE_URL':'IMAGE_IMPORT_BLOCKED';
    await rejectsCode(importImageUrl('https://example.com/photo',deps(wire,{lookup:async host=>[{address:host==='private.example'?'10.0.0.1':PUBLIC,family:4}]})),expected);
    assert.equal(wire.calls.length,1);assert.equal(wire.resources[0].req.destroyed,true);assert.equal(wire.resources[0].res.destroyed,true);
  }
});

test('three redirects are allowed but a fourth is bounded and every connection is closed',async()=>{
  const allowed=transport([{status:301,headers:{location:'/one'}},{status:307,headers:{location:'/two'}},{status:308,headers:{location:'/three'}},{}]);
  assert.equal((await importImageUrl('https://example.com/photo',deps(allowed))).contentType,'image/png');assert.equal(allowed.calls.length,4);
  const loop=transport(Array.from({length:4},()=>({status:302,headers:{location:'/again'}})));
  await rejectsCode(importImageUrl('https://example.com/photo',deps(loop)),'IMAGE_IMPORT_FAILED');assert.equal(loop.calls.length,4);
  for(const item of [...allowed.resources,...loop.resources]){assert.equal(item.req.destroyed,true);assert.equal(item.res.destroyed,true);}
});

test('the total deadline includes DNS and a stalled body and aborts all open streams',async()=>{
  const noRequest=transport();
  await rejectsCode(importImageUrl('https://example.com/photo',deps(noRequest,{lookup:()=>new Promise(()=>{}),timeoutMs:15})),'IMAGE_IMPORT_TIMEOUT');
  assert.equal(noRequest.calls.length,0);
  const stalled=transport([{hang:true}]);
  await rejectsCode(importImageUrl('https://example.com/photo',deps(stalled,{timeoutMs:15})),'IMAGE_IMPORT_TIMEOUT');
  assert.equal(stalled.resources[0].req.destroyed,true);assert.equal(stalled.resources[0].res.destroyed,true);
  const noHeaders=transport([{noHeaders:true}]);
  await rejectsCode(importImageUrl('https://example.com/photo',deps(noHeaders,{timeoutMs:15})),'IMAGE_IMPORT_TIMEOUT');
  assert.equal(noHeaders.resources[0].req.destroyed,true);
});

test('redirects share the original deadline instead of starting a fresh DNS timeout',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  const wire=transport([{status:302,headers:{location:'https://other.example/photo'}}]);let lookups=0,failure;
  const operation=importImageUrl('https://example.com/photo',deps(wire,{timeoutMs:100,lookup:async()=>{
    lookups++;
    if(lookups===1){await new Promise(resolve=>setTimeout(resolve,80));return [{address:PUBLIC,family:4}];}
    return new Promise(()=>{});
  }}));
  operation.catch(caught=>{failure=caught;});
  await yieldTurn();t.mock.timers.tick(80);await yieldTurn();
  assert.equal(lookups,2);t.mock.timers.tick(19);await yieldTurn();assert.equal(failure,undefined);
  t.mock.timers.tick(1);await yieldTurn();assert.equal(failure?.code,'IMAGE_IMPORT_TIMEOUT');
  await rejectsCode(operation,'IMAGE_IMPORT_TIMEOUT');
  assert.equal(lookups,2);assert.equal(wire.calls.length,1);assert.equal(wire.resources[0].req.destroyed,true);
});

test('declared and streamed body limits reject oversized input and close the response immediately',async()=>{
  for(const plan of [{headers:{'content-length':'65'}},{chunks:[Buffer.alloc(40),Buffer.alloc(25)]}]){
    const wire=transport([plan]);
    await rejectsCode(importImageUrl('https://example.com/photo',deps(wire,{maxBytes:64})),'IMAGE_IMPORT_TOO_LARGE');
    assert.equal(wire.resources[0].req.destroyed,true);assert.equal(wire.resources[0].res.destroyed,true);
  }
  const wire=transport([{chunks:[Buffer.alloc(5*1024*1024),Buffer.alloc(1)]}]);
  await rejectsCode(importImageUrl('https://example.com/photo',deps(wire)),'IMAGE_IMPORT_TOO_LARGE');
});

test('raster magic must match the declared allowed type; HTML, SVG, compression, empty and truncated data fail',async()=>{
  for(const plan of [{headers:{'content-type':'image/svg+xml'},body:Buffer.from('<svg/>')},
    {headers:{'content-type':'text/html'},body:Buffer.from('<html/>')},{body:Buffer.from('<html/>')},
    {headers:{'content-type':'image/jpeg'},body:PNG},{body:Buffer.alloc(0)},
    {body:PNG.subarray(0,8)},{headers:{'content-encoding':'gzip'}},{headers:{'content-type':'application/octet-stream'}}]){
    const wire=transport([plan]);await rejectsCode(importImageUrl('https://example.com/photo',deps(wire)),'IMAGE_IMPORT_TYPE');
    assert.equal(wire.resources[0].req.destroyed,true);assert.equal(wire.resources[0].res.destroyed,true);
  }
});

test('supported raster signatures agree with their MIME and mixed public DNS remains usable',async()=>{
  for(const [body,type] of [[PNG,'image/png'],[JPEG,'image/jpeg'],[WEBP,'image/webp'],[GIF,'image/gif'],[AVIF,'image/avif']]){
    const wire=transport([{body,headers:{'content-type':type}}]);
    const result=await importImageUrl('https://example.com/photo',deps(wire,{lookup:async()=>[{address:PUBLIC6,family:6},{address:PUBLIC,family:4}]}));
    assert.deepEqual(result.bytes,body);assert.equal(result.contentType,type);
  }
});

test('upstream errors are closed Persian GameErrors without the raw URL or credentials',async()=>{
  const input='https://example.com/photo?secret=do-not-log';
  for(const plan of [{status:404},{error:new Error(input)},{complete:false}]){
    const wire=transport([plan]);
    await assert.rejects(importImageUrl(input,deps(wire)),failure=>failure instanceof GameError&&failure.code==='IMAGE_IMPORT_FAILED'&&!failure.message.includes(input)&&!failure.message.includes('do-not-log'));
    assert.equal(wire.resources[0].req.destroyed,true);
  }
});
