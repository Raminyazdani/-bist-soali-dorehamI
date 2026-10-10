// The observer makes the same authenticated HTTP request as every phone.
// It does not access private server state or replace the backend.
window.readGameState=async()=>{
  const credentials=JSON.parse(localStorage.getItem('forehead-session-v3'));
  if(!credentials)throw Error('No test participant session');
  const response=await fetch('/api/game',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'state',...credentials}),cache:'no-store'});
  const data=await response.json();if(!response.ok)throw Error(data.error);return data.snapshot;
};
