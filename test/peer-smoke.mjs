import {createServer} from 'vite';
import {chromium} from 'playwright';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
const server = await createServer({configFile:false, server:{host:'127.0.0.1',port:5190,strictPort:true}});
await server.listen();
const proxy = process.env.HTTPS_PROXY;
const browser = await chromium.launch({args:['--no-sandbox','--allow-loopback-in-peer-connection','--force-webrtc-ip-handling-policy=default','--disable-features=WebRtcHideLocalIpsWithMdns',...(proxy?['--ignore-certificate-errors']:[])], ...(proxy ? {proxy:{server:proxy}} : {})});
try {
  // In this runner the only network interface is loopback. Chromium includes
  // that non-default interface only with media permission (test setup only).
  const a = await browser.newPage({permissions:['camera','microphone']}); const b = await browser.newPage({permissions:['camera','microphone']});
  const library=await readFile('node_modules/peerjs/dist/peerjs.min.js','utf8');
  const helpers=(await readFile('test/peer-smoke.html','utf8')).split('<script type="module">')[1].split('</script>')[0].replace("import Peer from 'peerjs';",'const Peer=window.Peer;');
  for (const p of [a,b]) {p.on('console',m=>{if(m.type()==='error')console.log(m.text());});await p.goto('https://bist-soali-dorehami.vercel.app/',{waitUntil:'domcontentloaded',timeout:25000});await p.addScriptTag({content:library});await p.addScriptTag({content:helpers});console.log('HTTPS secure origin',await p.evaluate(()=>isSecureContext));}
  const id = 'bist-smoke-'+randomUUID();
  console.log('Opening real public signaling peers');
  console.log(await a.evaluate(id=>window.makePeer(id),id));
  console.log(await b.evaluate(id=>window.makePeer(id),id+'-guest'));
  try { console.log(await b.evaluate(id=>window.echo(id),id)); }
  catch(error){
    for(const p of [a,b]) console.log(await p.evaluate(()=>Object.values(window.peer.connections).flat().map(c=>({open:c.open,ice:c.peerConnection?.iceConnectionState,connection:c.peerConnection?.connectionState,local:!!c.peerConnection?.localDescription,remote:!!c.peerConnection?.remoteDescription,candidateTypes:c.peerConnection?.localDescription?.sdp.match(/ typ \w+/g)}))));
    throw error;
  }
  console.log('PUBLIC_PEER_AND_500KB_DATA_OK');
} finally {await browser.close();await server.close();}
