// Every phone talks to the same durable server; no player hosts the room.
export class ServerTransport {
  constructor() { this.online=false; this.controllers=new Set(); this.statusListeners=new Set(); this.endedCode=null; }
  onSnapshot() { return ()=>{}; }
  onStatus(callback) { this.statusListeners.add(callback); callback(this.online); return ()=>this.statusListeners.delete(callback); }
  status(online) { this.online=online; for(const callback of this.statusListeners)callback(online); }
  async request(body) {
    const controller=new AbortController(); this.controllers.add(controller);
    const timer=setTimeout(()=>controller.abort(),20000);
    try {
      const response=await fetch('/api/game',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),cache:'no-store',signal:controller.signal});
      const data=await response.json();
      if(!response.ok){const error=new Error(data.error||'ارتباط بازی برقرار نشد؛ دوباره امتحان کن.');error.code=data.code;throw error;}
      this.status(true); return data;
    } catch(error) {
      if(!error.code)this.status(false);
      if(controller.signal.aborted){const code=controller.signal.reason?.code;const stopped=new Error(code==='ROOM_CLOSED'?'لابی بسته شد.':'درخواست کامل نشد؛ دوباره امتحان کن.');if(typeof code==='string')stopped.code=code;throw stopped;}
      throw error;
    } finally { clearTimeout(timer); this.controllers.delete(controller); }
  }
  suspend() { /* Backgrounding a phone never suspends the shared room. */ }
  close() { const reason=Object.assign(new Error('Session ended'),{code:this.endedCode??'CANCELLED'});for(const controller of this.controllers)controller.abort(reason);this.controllers.clear();this.endedCode=null;this.status(false); }
}
export const transport=new ServerTransport();
