// Test observer uses the same real, authenticated public peer protocol as the UI.
// It never accesses the host's private room or replaces the network/backend.
(()=>{
let connection=null,peer=null,opening=null;
const waiting=new Map();
function closed(){connection=null;for(const item of waiting.values()){clearTimeout(item.timer);item.reject(Error('Reader disconnected'));}waiting.clear();}
async function connect(code){
  if(connection?.open)return connection;
  if(opening)return opening;
  opening=(async()=>{
    peer?.destroy();peer=new window.Peer('e2e-reader-'+crypto.randomUUID(),{debug:0});
    await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Reader signaling timeout')),20000);peer.once('open',()=>{clearTimeout(timer);resolve();});peer.once('error',e=>{clearTimeout(timer);reject(e);});});
    connection=peer.connect('forehead-v2-room-'+code,{reliable:true});
    connection.on('data',e=>{if(e.kind!=='response')return;const item=waiting.get(e.id);if(!item)return;clearTimeout(item.timer);waiting.delete(e.id);e.error?item.reject(Error(e.error.message)):item.resolve(e.payload.snapshot);});
    connection.on('close',closed);connection.on('error',closed);
    await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Reader WebRTC timeout')),20000);connection.once('open',()=>{clearTimeout(timer);resolve();});peer.on('error',e=>{clearTimeout(timer);reject(e);});});
    return connection;
  })();
  try{return await opening;}finally{opening=null;}
}
window.readPeerState=async()=>{
  const credentials=JSON.parse(localStorage.getItem('forehead-session-v2'));
  if(!credentials)throw Error('No test participant session');
  const c=await connect(credentials.code),id=crypto.randomUUID();
  return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{waiting.delete(id);reject(Error('Reader request timeout'));},20000);waiting.set(id,{resolve,reject,timer});c.send({kind:'request',id,body:{type:'state',...credentials}});});
};
})();
