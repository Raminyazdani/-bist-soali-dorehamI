import Peer from 'peerjs';
import {GameService} from '../lib/service.mjs';
import {GameError,authenticate,applyAction,normalizeDigits} from '../lib/game.mjs';
import {readRecord,writeRecord,deleteRecords} from './persistence.js';

const PREFIX='forehead-v2-', PHOTO='peer-photo:';
const hostId=code=>`${PREFIX}room-${code}`;
const timeoutError=()=>new GameError('اتصال به صاحب لابی قطع شد؛ صفحهٔ بازی را روی گوشی او باز نگه دارید و دوباره بزنید.',503,'HOST_OFFLINE');
const photoCards=s=>[...(s.ownCards??[]),s.turn?.card,...(s.completedCards??[]).map(r=>r.card)].filter(Boolean);

class PhoneStore {
  constructor(transport){this.transport=transport;this.row=null;this.people={};}
  async restore(id){
    if(this.row?.id===id)return;
    const row=await readRecord('rooms',id);
    if(!row)return;
    if(row.state.expiresAt<=Date.now())throw new GameError('این لابی بسته شده است؛ یک لابی تازه بساز.',410,'EXPIRED');
    this.row=row;this.people={...(row.people??{})};
    if(row.state.turn?.status==='running'){
      let ended=Date.now();
      try{ended=Math.min(ended,Number(localStorage.getItem('forehead-hidden-'+id))||ended);}catch{}
      const paused=applyAction(row.state,row.state.hostId,'pause',{}, {now:Math.max(row.savedAt??0,ended)});
      if(paused.changed){paused.room.turn.pauseReason='connection';this.row={...row,state:paused.room,revision:row.revision+1};await this.persist();}
    }
  }
  async persist(row=this.row){await writeRecord('rooms',{...row,people:this.people,savedAt:Date.now()});}
  async insert(room){
    if(this.row?.id===room.id)return null;
    try{await this.transport.openHost(room.code);}catch(e){if(e.code==='CODE_TAKEN')return null;throw e;}
    const row={id:room.id,revision:0,state:room,creatorId:room.players[0].id};
    await this.persist(row);this.row=row;return structuredClone(row);
  }
  async get(id){if(!this.row||this.row.id!==id)throw new GameError('این لابی روی گوشی صاحب لابی پیدا نشد.',404,'NOT_FOUND');return structuredClone(this.row);}
  async byCode(code){if(this.row?.state.code!==code)throw new GameError('کد لابی را بررسی کن.',404,'NOT_FOUND');return this.get(this.row.id);}
  async cas(row,state){
    if(this.row?.revision!==row.revision)return false;
    const next={...this.row,state:structuredClone(state),revision:row.revision+1};
    await this.persist(next);this.row=next;return true;
  }
  async ping(id,player,now){this.people[player]=now;}
  async presence(){return {...this.people};}
  async upload(path,bytes,mime){
    const uri=`data:${mime};base64,${bytes.toString('base64')}`;
    await writeRecord('photos',uri,path);this.transport.photos.set(path,uri);return PHOTO+path;
  }
  async removeImages(paths){await deleteRecords('photos',paths);for(const path of paths)this.transport.photos.delete(path);}
}

export class PeerTransport {
  constructor(){
    this.peer=null;this.peerOpening=null;this.client=null;this.connecting=null;this.connections=new Set();
    this.pending=new Map();this.photos=new Map();this.listeners=new Set();this.statusListeners=new Set();
    this.phone=new PhoneStore(this);this.service=new GameService(this.phone);this.queue=Promise.resolve();
    this.identity=null;this.online=false;this.creator=false;this.closed=false;this.notifyTimer=null;
  }
  onSnapshot(callback){this.listeners.add(callback);return()=>this.listeners.delete(callback);}
  onStatus(callback){this.statusListeners.add(callback);callback(this.online);return()=>this.statusListeners.delete(callback);}
  status(online){this.online=online;for(const callback of this.statusListeners)callback(online);}
  serial(callback){const result=this.queue.then(callback);this.queue=result.catch(()=>{});return result;}
  async makePeer(id){
    const peer=new Peer(id,{debug:0});this.peer=peer;this.closed=false;
    peer.on('connection',c=>this.receiveConnection(c));
    peer.on('disconnected',()=>{if(!this.closed)setTimeout(()=>{if(peer.disconnected&&!peer.destroyed)peer.reconnect();},1200);});
    peer.on('close',()=>this.status(false));
    // Keep a listener after initial connection; PeerJS emits transport errors here.
    peer.on('error',()=>{});
    await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{peer.destroy();reject(timeoutError());},20000);
      const done=()=>{clearTimeout(timer);peer.off('error',failed);resolve();};
      const failed=e=>{clearTimeout(timer);peer.off('open',done);peer.destroy();reject(e.type==='unavailable-id'?new GameError('این لابی در یک صفحهٔ دیگر باز است؛ به همان صفحه برگرد.',409,'CODE_TAKEN'):timeoutError());};
      peer.once('open',done);peer.once('error',failed);
    });
    return peer;
  }
  async openHost(code){
    if(this.peer?.id===hostId(code)&&!this.peer.destroyed)return;
    this.peer?.destroy();this.creator=true;
    await this.makePeer(hostId(code));this.status(true);
  }
  async initializeCreator(body){
    this.creator=true;this.identity={roomId:body.roomId,playerId:body.playerId,token:body.token,code:body.code,creator:true};
    await this.phone.restore(body.roomId);
    if(this.phone.row){authenticate(this.phone.row.state,body.playerId,body.token);if(this.phone.row.creatorId!==body.playerId)throw new GameError('سازندهٔ لابی باید این صفحه را باز کند.',401,'UNAUTHORIZED');await this.openHost(this.phone.row.state.code);}
  }
  async clientConnection(code){
    code=normalizeDigits(code).replace(/\s/g,'');
    if(!/^\d{6}$/.test(code))throw new GameError('کد لابی شش رقم است.',400,'BAD_CODE');
    if(this.client?.open&&this.client.peer===hostId(code))return this.client;
    if(this.connecting)return this.connecting;
    this.connecting=(async()=>{
      this.creator=false;
      if(!this.peer||this.peer.destroyed)await this.makePeer(PREFIX+'guest-'+crypto.randomUUID());
      const peer=this.peer;
      const connection=peer.connect(hostId(code),{reliable:true});this.client=connection;
      connection.on('data',envelope=>this.receive(envelope));
      connection.on('close',()=>{if(this.client===connection){this.status(false);this.rejectPending();}});
      connection.on('error',()=>{this.status(false);this.rejectPending();});
      await new Promise((resolve,reject)=>{
        const timer=setTimeout(failed,20000);
        function cleanup(){clearTimeout(timer);peer.off('error',failed);connection.off('error',failed);connection.off('close',failed);}
        function failed(){cleanup();connection.close();reject(timeoutError());}
        connection.once('open',()=>{cleanup();resolve();});
        connection.once('error',failed);connection.once('close',failed);peer.on('error',failed);
      });
      this.status(true);return connection;
    })();
    try{return await this.connecting;}finally{this.connecting=null;}
  }
  rejectPending(){for(const item of this.pending.values()){clearTimeout(item.timer);item.reject(timeoutError());}this.pending.clear();}
  async receive(envelope){
    if(!envelope||!['response','snapshot'].includes(envelope.kind))return;
    for(const [key,value] of Object.entries(envelope.photos??{}))this.photos.set(key,value);
    const data=envelope.payload;
    if(data?.snapshot)this.inflate(data.snapshot);
    if(envelope.kind==='snapshot'){for(const cb of this.listeners)cb(data.snapshot);return;}
    const pending=this.pending.get(envelope.id);if(!pending)return;
    clearTimeout(pending.timer);this.pending.delete(envelope.id);
    if(envelope.error){const e=new Error(envelope.error.message);e.code=envelope.error.code;pending.reject(e);}
    else pending.resolve(data);
  }
  inflate(snapshot){for(const card of photoCards(snapshot)){if(card.imageUrl?.startsWith(PHOTO))card.imageUrl=this.photos.get(card.imageUrl.slice(PHOTO.length))??null;}return snapshot;}
  async envelope(kind,payload,known=new Set(),id){
    const photos={};
    for(const card of photoCards(payload?.snapshot??{})){
      if(!card.imageUrl?.startsWith(PHOTO))continue;
      const key=card.imageUrl.slice(PHOTO.length);
      if(known.has(key))continue;
      const uri=this.photos.get(key)??await readRecord('photos',key);
      if(uri){this.photos.set(key,uri);photos[key]=uri;known.add(key);}
    }
    return {kind,id,payload,photos};
  }
  decorate(result,playerId){
    if(result.snapshot)result.snapshot.creatorId=this.phone.row.creatorId;
    if(result.credentials)result.credentials.creator=this.phone.row.creatorId===playerId;
    return result;
  }
  async execute(body){
    if(!['create','join','state','action','upload'].includes(body.type))throw new GameError('درخواست نامعتبر است.',400,'UNKNOWN_ACTION');
    if(body.type==='action'&&body.action==='leave'&&body.playerId===this.phone.row?.creatorId&&this.phone.row.state.players.length>1)
      throw new GameError('گوشی سازنده لابی را وصل نگه می‌دارد؛ برای بازی صفحه‌ات را باز نگه دار.',400,'CREATOR_REQUIRED');
    const before=this.phone.row?.revision;
    const result=this.decorate(await this.service[body.type](body),body.playerId);
    if(before!==this.phone.row?.revision||body.type==='join')this.notifySoon();
    return result;
  }
  receiveConnection(connection){
    if(!this.creator){connection.close();return;}
    const info={connection,actor:null,known:new Set(),sending:Promise.resolve()};this.connections.add(info);
    connection.on('close',()=>{this.connections.delete(info);this.notifySoon();});
    connection.on('error',()=>this.connections.delete(info));
    connection.on('data',message=>{
      if(message?.kind!=='request'||typeof message.id!=='string'||!message.body)return;
      this.serial(async()=>{
        try{
          const body=message.body;
          if(body.type==='create'||(info.actor&&info.actor!==body.playerId))throw new GameError('ورود نامعتبر است.',401,'UNAUTHORIZED');
          const result=await this.execute(body);
          if(result.left){info.actor=null;}
          else info.actor=body.playerId;
          this.send(info,'response',result,message.id);
        }catch(e){if(connection.open)connection.send({kind:'response',id:message.id,error:{message:e.message,code:e.code??'NETWORK_ERROR'}});}
      });
    });
  }
  send(info,kind,payload,id){
    info.sending=info.sending.then(async()=>{if(info.connection.open)info.connection.send(await this.envelope(kind,payload,info.known,id));}).catch(()=>{});
  }
  notifySoon(){clearTimeout(this.notifyTimer);this.notifyTimer=setTimeout(()=>this.broadcast(),30);}
  async broadcast(){
    const row=this.phone.row;if(!row||!this.creator)return;
    for(const info of this.connections){
      if(!info.actor||!info.connection.open)continue;
      try{this.send(info,'snapshot',this.decorate(await this.service.respond(row,info.actor),info.actor));}catch{}
    }
    if(this.identity&&row.state.players.some(p=>p.id===this.identity.playerId)){
      const payload=this.decorate(await this.service.respond(row,this.identity.playerId),this.identity.playerId);
      const envelope=await this.envelope('snapshot',payload);
      for(const [key,value] of Object.entries(envelope.photos))this.photos.set(key,value);
      this.inflate(payload.snapshot);for(const cb of this.listeners)cb(payload.snapshot);
    }
  }
  async request(body){
    if(body.type==='create'||body.creator===true){
      if(!this.creator||!this.phone.row||this.phone.row.id!==body.roomId)await this.initializeCreator(body);
      if(this.phone.row)await this.openHost(this.phone.row.state.code);
      const result=await this.serial(()=>this.execute(body));
      if(result.credentials)this.identity=result.credentials;
      const envelope=await this.envelope('response',result);
      for(const [key,value] of Object.entries(envelope.photos))this.photos.set(key,value);
      if(result.snapshot)this.inflate(result.snapshot);
      return result;
    }
    const connection=await this.clientConnection(body.code??this.identity?.code);
    const id=crypto.randomUUID();
    const result=await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{this.pending.delete(id);reject(timeoutError());},20000);
      this.pending.set(id,{resolve,reject,timer});
      try{connection.send({kind:'request',id,body});}catch{clearTimeout(timer);this.pending.delete(id);reject(timeoutError());}
    });
    if(result.credentials)this.identity=result.credentials;
    return result;
  }
  suspend(){
    if(!this.creator||!this.phone.row)return;
    const row=this.phone.row;
    try{localStorage.setItem('forehead-hidden-'+row.id,String(Date.now()));}catch{}
    if(row.state.turn?.status==='running')this.serial(async()=>{
      const current=this.phone.row;
      const paused=applyAction(current.state,current.state.hostId,'pause',{}, {now:Date.now()});
      if(paused.changed){paused.room.turn.pauseReason='connection';await this.phone.cas(current,paused.room);this.notifySoon();}
    }).catch(()=>{});
  }
  close(){
    this.closed=true;clearTimeout(this.notifyTimer);this.rejectPending();this.peer?.destroy();this.peer=null;this.client=null;
    this.connecting=null;this.connections.clear();this.photos.clear();this.identity=null;this.creator=false;this.phone=new PhoneStore(this);this.service=new GameService(this.phone);this.status(false);
  }
}
export const transport=new PeerTransport();
