import {transport} from './transport.js';
import './style.css';

const $ = selector => document.querySelector(selector);
const app = $('#app');
const SESSION_KEY = 'forehead-session-v3', PENDING_KEY = 'forehead-pending-v3';
let session = readStored(SESSION_KEY), state = null, config = null;
let busy = false, syncing = false, syncAgain = false, live = false, lastContact = 0, offset = 0, wakeLock;
let homeTab = new URL(location.href).searchParams.get('room') ? 'join' : 'create';
let menuOpen = false, setupError = '', uploadIds = new Set(), draftMap = new Map(), saveTimers = new Map();
let commandSequence=0, pendingConfirmation=null;
const fa = n => Number(n).toLocaleString('fa-IR');
const esc = text => String(text ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const digits = value => String(value).replace(/[۰-۹]/g, c => String(c.charCodeAt(0)-1776)).replace(/[٠-٩]/g, c => String(c.charCodeAt(0)-1632));
const nameOf = id => state?.players.find(p => p.id === id)?.name ?? '';
const me = () => state?.players.find(p => p.id === state.you);
const host = () => state?.hostId === state?.you;
const referee = () => state?.turn?.refereeId === state?.you;
const guesser = () => state?.turn?.playerId === state?.you;
const clock = () => Date.now() + offset;
function readStored(key) { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } }
function storeValue(key, value) { try { value ? localStorage.setItem(key, JSON.stringify(value)) : localStorage.removeItem(key); } catch {} }
function seconds(ms) { const s = Math.floor(Math.max(0, ms)/1000); return `${fa(Math.floor(s/60)).padStart(2,'۰')}:${fa(s%60).padStart(2,'۰')}`; }
function fullTime(ms) { return `${seconds(ms)}٫${fa(Math.floor((ms%1000)/100))}`; }
function token() { const bytes = crypto.getRandomValues(new Uint8Array(24)); return btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); }
function toast(message, error = true) { const el = $('#toast'); el.textContent = message; el.className = `visible ${error ? 'error' : 'ok'}`; clearTimeout(toast.timer); toast.timer = setTimeout(() => el.className = '', 5000); }
function setBusy(value) { busy = value; app.classList.toggle('busy', value); updateControls(); }
const confirmationState = room => JSON.stringify([room?.id,room?.generation,room?.phase,room?.hostId,room?.turn?.id,room?.turn?.status,room?.turn?.remaining,room?.turn?.refereeId]);
function dismissConfirmation(accepted=false) {
  if (!pendingConfirmation) return;
  const { dialog, resolve } = pendingConfirmation; pendingConfirmation=null;
  dialog.close(); dialog.remove(); resolve(accepted);
}
function confirmSensitive(title, message, label) {
  if (pendingConfirmation) return Promise.resolve(false);
  return new Promise(resolve=>{
    const dialog=document.createElement('dialog');
    dialog.className='confirmation-dialog';
    dialog.setAttribute('role','alertdialog');
    dialog.setAttribute('aria-modal','true');
    dialog.setAttribute('aria-labelledby','confirmation-title');
    dialog.setAttribute('aria-describedby','confirmation-message');
    dialog.innerHTML=`<h2 id="confirmation-title">${esc(title)}</h2><p id="confirmation-message">${esc(message)}</p><div class="confirmation-buttons"><button class="button secondary" data-confirm="cancel" autofocus>نه، برگرد</button><button class="button primary" data-confirm="accept">${esc(label)}</button></div>`;
    dialog.addEventListener('cancel',event=>{event.preventDefault();dismissConfirmation();});
    dialog.addEventListener('click',event=>{
      const choice=event.target.closest('[data-confirm]');
      if(choice)dismissConfirmation(choice.dataset.confirm==='accept');
      else if(event.target===dialog){
        const box=dialog.getBoundingClientRect();
        if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)dismissConfirmation();
      }
    });
    pendingConfirmation={dialog,resolve,state:confirmationState(state)};
    document.body.append(dialog);dialog.showModal();
  });
}
async function sensitiveAction(name, data={}) {
  if (busy || !state) return;
  const expected=confirmationState(state);
  const settings={
    correct:['حدس درست را ثبت کنیم؟',`مطمئنی ${nameOf(state.turn?.playerId)} درست حدس زده؟ این نوبت با ${fa(state.turn?.remaining)} امتیاز تمام می‌شود.`,'بله، درست حدس زد'],
    failed:['پایان ناموفق را ثبت کنیم؟','مطمئنی جواب پیدا نشده؟ این نوبت با صفر امتیاز تمام می‌شود.','بله، پایان ناموفق'],
    reset:['از اول شروع کنیم؟','کارت‌ها و امتیازهای این بازی پاک می‌شوند؛ همین جمع به لابی برمی‌گردد.','بله، بازی تازه'],
    kick:['بازیکن حذف شود؟',`«${nameOf(data.playerId)}» از لابی حذف می‌شود.${state.phase!=='lobby'?' بازی فعلی هم تمام می‌شود و بقیه به لابی برمی‌گردند.':''}`,'بله، حذف کن'],
    closeRoom:['لابی برای همه بسته شود؟','همه از این لابی خارج می‌شوند و برای ادامه باید لابی تازه بسازید.','بله، لابی را ببند']
  }[name];
  if (!await confirmSensitive(...settings) || expected!==confirmationState(state)) return;
  if (['kick','closeRoom','reset'].includes(name)) menuOpen=false;
  return action(name,data);
}
async function api(body, retry = true) {
  const started = Date.now();
  try {
    const data = await transport.request(body);
    lastContact = Date.now();
    if (data.snapshot) offset = data.snapshot.serverNow - (started + Date.now())/2;
    return data;
  } catch (error) {
    if (retry && (!error.code || ['SERVICE_UNAVAILABLE','BUSY'].includes(error.code)) && navigator.onLine) {
      await new Promise(resolve=>setTimeout(resolve,250));return api(body, false);
    }
    throw error;
  } finally {
    if(body.type!=='state'){app.dataset.completedOperation=body.action??body.type;app.dataset.commandSequence=String(++commandSequence);}
  }
}
function authData() { return { roomId: session.roomId, playerId: session.playerId, token: session.token, code:session.code, creator:session.creator }; }
function saveDrafts() {
  if (!state) return;
  storeValue(`forehead-drafts-${state.id}-${state.generation}`, Object.fromEntries(draftMap));
}
function renewPhotoLinks(next) {
  const cards=[...(next.ownCards??[]),next.turn?.card,...(next.completedCards??[]).map(result=>result.card)].filter(Boolean);
  const links=new Map(cards.filter(card=>card.imageUrl).map(card=>[new URL(card.imageUrl,location.href).searchParams.get('path'),card.imageUrl]));
  for(const img of app.querySelectorAll('img')){
    const current=new URL(img.getAttribute('src'),location.href);
    if(current.pathname!=='/api/photo'||(Number(current.searchParams.get('expires'))>next.serverNow+120000&&(!img.complete||img.naturalWidth>0)))continue;
    const fresh=links.get(current.searchParams.get('path'));
    if(fresh&&fresh!==img.getAttribute('src'))img.setAttribute('src',fresh);
  }
}
function accept(next) {
  if(!session||next.id!==session.roomId||next.you!==session.playerId)return;
  if(next.phase==='closed'||next.phase==='removed'){
    transport.endedCode=next.phase==='closed'?'ROOM_CLOSED':'REMOVED';
    leaveLocal();toast(next.phase==='closed'?'لابی بسته شد.':'مدیر تو را از لابی حذف کرد.',false);return;
  }
  if (state && next.id === state.id && next.revision < state.revision) return;
  if(state && next.id===state.id && next.revision===state.revision && next.generation===state.generation &&
    state.players.every((player,index)=>player.online===next.players[index]?.online)){
    state=next;renewPhotoLinks(next);return; // Keep inputs/pickers, but renew expiring photo links.
  }
  if (!state || state.generation !== next.generation || state.id !== next.id) {
    draftMap = new Map(Object.entries(readStored(`forehead-drafts-${next.id}-${next.generation}`) ?? {}));
    for (const timer of saveTimers.values()) clearTimeout(timer); saveTimers.clear();
  }
  if (state?.phase!==next.phase) menuOpen=false;
  state = next;
  if(pendingConfirmation && pendingConfirmation.state!==confirmationState(state)){
    dismissConfirmation();toast('وضعیت بازی تغییر کرد؛ دوباره انتخابت را بررسی کن.',false);
  }
  document.title = guesser() && state.phase === 'playing' ? 'نوبت توست! · روی پیشونی' : 'روی پیشونی! · بیست‌سؤالی دورهمی';
  render();
}
async function sync(silent = true) {
  if (!session) return;
  if (syncing) { syncAgain = true; return; }
  syncing = true;
  try {
    const result = await api({ type:'state', ...authData() }); accept(result.snapshot);
  } catch (error) {
    if (['UNAUTHORIZED','EXPIRED','NOT_FOUND','ROOM_CLOSED','REMOVED'].includes(error.code)) { leaveLocal(); toast(error.message); }
    else if (!silent) toast(error.message || 'اینترنت قطع است؛ جای تو در بازی محفوظ می‌ماند.');
  } finally { syncing = false; updateConnection(); if (syncAgain) { syncAgain = false; setTimeout(() => sync(), 50); } }
}
async function connectRoom() {
  live=transport.online;updateConnection();
}
function leaveLocal() {
  dismissConfirmation();
  session = null; state = null; draftMap.clear(); menuOpen = false;
  storeValue(SESSION_KEY, null); storeValue(PENDING_KEY, null);
  transport.close();live = false; render();
}
async function submitEntry(type, form) {
  if (busy) return;
  setBusy(true);
  const values = new FormData(form);
  let pending = readStored(PENDING_KEY);
  const name = String(values.get('name') ?? '').trim();
  const code = digits(values.get('code') ?? '').trim();
  if (!pending || pending.type !== type || pending.name !== name || (type === 'join' && pending.code !== code)) {
    pending = { type, name, code, cardsPerPlayer: Number(values.get('count') || 3), playerId: crypto.randomUUID(), token: token(), ...(type === 'create' ? { roomId: crypto.randomUUID() } : {}) };
    storeValue(PENDING_KEY, pending);
  }
  try {
    const result = await api(pending); session = result.credentials; storeValue(SESSION_KEY, session); storeValue(PENDING_KEY, null);
    accept(result.snapshot); await connectRoom(); await stayAwake();
  } catch (error) { toast(error.message || 'اینترنت را بررسی کن و دوباره بزن؛ درخواستت محفوظ است.'); }
  finally { setBusy(false); }
}
async function action(name, data = {}, options = {}) {
  if (busy && !options.background) return;
  if (!options.background) setBusy(true);
  const body = { type:'action', ...authData(), requestId: crypto.randomUUID().replace(/-/g,''), action:name, data: { ...data, generation:state.generation, ...(state.turn && ['start','question','undoQuestion','correct','failed','pause','resume','next','setReferee'].includes(name) ? { turnId:state.turn.id } : {}) } };
  try {
    const result = await api(body);
    if (result.left) leaveLocal(); else accept(result.snapshot);
    return result;
  } catch (error) {
    if (['ROOM_CLOSED','REMOVED'].includes(error.code)) { leaveLocal(); toast(error.message,false); return; }
    if (['STALE_GAME','STALE_TURN','WRONG_PHASE'].includes(error.code)) await sync();
    if (!options.quiet) toast(error.message || 'ارتباط قطع شد؛ دوباره امتحان کن.');
    throw error;
  } finally { if (!options.background) setBusy(false); }
}
function queueSave(cardId, text) {
  draftMap.set(cardId, text); saveDrafts();
  clearTimeout(saveTimers.get(cardId));
  saveTimers.set(cardId, setTimeout(async () => {
    saveTimers.delete(cardId);
    if (state?.phase !== 'writing' || me()?.ready || !session) return;
    try { await action('saveCard', { cardId, text:draftMap.get(cardId) }, { background:true, quiet:true }); }
    catch { /* Draft survives; Ready submits every current card in one command. */ }
  }, 650));
  updateDraftProgress();
}
async function readyCards() {
  if (uploadIds.size || busy) return;
  for (const timer of saveTimers.values()) clearTimeout(timer); saveTimers.clear();
  const cards = state.ownCards.map(c => ({ id:c.id, text:draftMap.has(c.id) ? draftMap.get(c.id) : c.text }));
  await action('readyWriting', { ready:!me().ready, cards });
}
async function shrinkPhoto(file) {
  if (file.size > 25000000) throw new Error('عکس خیلی بزرگ است؛ یک عکس کوچک‌تر انتخاب کن.');
  const url = URL.createObjectURL(file);
  try {
    const img = new Image(); img.src = url; await img.decode();
    const scale = Math.min(1, 1100 / Math.max(img.naturalWidth,img.naturalHeight));
    const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(img.naturalWidth*scale)); canvas.height = Math.max(1, Math.round(img.naturalHeight*scale));
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0,0,canvas.width,canvas.height); ctx.drawImage(img,0,0,canvas.width,canvas.height);
    for (const quality of [0.85,0.7,0.5,0.3]) {
      const data = canvas.toDataURL('image/jpeg', quality);
      if (data.length < 800000) return data.split(',')[1];
    }
    throw new Error('عکس هنوز بزرگ است؛ یک عکس ساده‌تر انتخاب کن.');
  } catch (error) { throw new Error(error.message.includes('عکس') ? error.message : 'این عکس باز نشد؛ از JPG، PNG یا اسکرین‌شات استفاده کن.'); }
  finally { URL.revokeObjectURL(url); }
}
async function upload(cardId, file) {
  if (!file) return;
  uploadIds.add(cardId); render();
  try {
    const base64 = await shrinkPhoto(file);
    const result = await api({ type:'upload', ...authData(), cardId, base64, requestId:crypto.randomUUID().replace(/-/g,'') });
    accept(result.snapshot); toast('عکس روی کارت نشست!', false);
  } catch (error) { toast(error.message || 'عکس بارگذاری نشد؛ دوباره امتحان کن.'); }
  finally { uploadIds.delete(cardId); render(); }
}
async function stayAwake() {
  try { if ('wakeLock' in navigator && document.visibilityState === 'visible') wakeLock = await navigator.wakeLock.request('screen'); } catch {}
}
function brand() { return `<a class="brand" href="/" aria-label="روی پیشونی"><span class="brand-mark">؟</span><span>روی پیشونی<span class="brand-bang">!</span></span></a>`; }
function connection() { return `<span class="connection js-connection"><i></i><span>در حال اتصال</span></span>`; }
function header() {
  return `<header>${brand()}<div class="header-actions">${connection()}<button class="icon-button" data-do="menu" aria-label="تنظیمات لابی" aria-expanded="${menuOpen}">⋯</button></div></header>`;
}
function stepper() {
  const index = { lobby:0, writing:1, playing:2, finished:3 }[state.phase];
  return `<nav class="steps" aria-label="مراحل بازی">${['جمع شدن','کارت‌سازی','بازی','نتیجه'].map((label,i) => `<span class="${i===index?'current':i<index?'done':''}"><b>${i<index?'✓':fa(i+1)}</b>${label}</span>`).join('')}</nav>`;
}
function roomStrip() { return `<div class="room-strip"><span>لابی <strong dir="ltr">${state.code}</strong></span><button class="text-button" data-do="invite">کپی دعوت ↗</button></div>`; }
function playerList(progress = false) {
  return `<div class="player-list">${state.players.map((p,i) => `<div class="player-row"><span class="avatar a${i%5}">${esc(p.name.slice(0,1))}<i class="${p.online?'online':''}"></i></span><span class="player-name">${esc(p.name)} ${p.id===state.you?'<small>تو</small>':''}${p.id===state.hostId?'<small class="host-label">مدیر</small>':''}</span><span class="player-status ${p.ready?'ready':''}">${p.ready?'✓ آماده':progress?`${fa(p.cardProgress)} از ${fa(state.cardsPerPlayer)} کارت`:'در جمع'}</span></div>`).join('')}</div>`;
}
function menu() {
  if (!menuOpen) return '';
  const others = state.players.filter(p=>p.id!==state.you);
  const refereeChoices = state.players.filter(p=>p.id!==state.turn?.playerId);
  const removable = others.filter(p=>p.id!==state.creatorId);
  return `<aside class="room-menu"><div class="menu-title">مدیریت دورهمی<button class="icon-button" data-do="menu" aria-label="بستن تنظیمات">×</button></div>${host() ? `
    ${state.phase==='playing'?`<label>داور این نوبت<select data-select="referee">${refereeChoices.map(p=>`<option value="${p.id}" ${state.turn.refereeId===p.id?'selected':''}>${esc(p.name)}</option>`).join('')}</select></label>`:''}
    ${others.length?`<label>انتقال مدیریت<select id="host-target"><option value="">یک نفر را انتخاب کن</option>${others.map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select></label><button class="button small secondary" data-do="transfer">انتقال مدیریت</button>`:''}
    ${removable.length?`<label>حذف بازیکن<select id="kick-target"><option value="">یک نفر را انتخاب کن</option>${removable.map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select></label><button class="button small secondary" data-do="kick">حذف بازیکن</button>`:''}
    ${state.phase!=='lobby'?'<button class="text-button danger" data-do="reset-confirm">شروع دوبارهٔ بازی</button>':''}
    ` : '<button class="text-button" data-do="claim">مدیر قطع شده؟ مدیریت را بگیر</button>'}
    ${host()||state.you===state.creatorId?'<button class="text-button danger" data-do="close-room">بستن لابی و خروج</button>':''}
    ${state.phase==='lobby'?'<button class="text-button danger" data-do="leave">خروج از لابی</button>':'<p class="muted tiny">با همین مرورگر می‌توانی به بازی برگردی.</p>'}
    <p class="tiny muted">لابی مستقل از گوشی‌هاست؛ برای پیدا کردن عکس می‌توانی از صفحهٔ بازی بیرون بروی.</p>
    <p class="tiny muted">حدس درست: سؤال‌های باقی‌مانده<br>تساوی: مجموع زمان کمتر</p></aside>`;
}
function gameGuide() {
  return `<details class="game-guide"><summary>چطور بازی کنیم؟ · دربارهٔ اطلاعات لابی</summary><div><ol><li>۲ تا ۱۲ نفر جمع شوید. یکی لابی می‌سازد و کد یا لینک را به بقیه می‌دهد. همه «آماده‌ام» را می‌زنند.</li><li>هر نفر به تعداد تعیین‌شده کارت می‌نویسد؛ متن لازم است و عکس اختیاری. با آمادگی همه، کارت‌ها تقسیم می‌شوند؛ کارت خودت به تو نمی‌رسد.</li><li>وقتی نوبتت شد، گوشی را بالای سرت و رو به بقیه بگیر. داور شروع را می‌زند و هر سؤال یا حدس را یک بار ثبت می‌کند. جواب آخر بعد از سؤال بیستم هم قابل ثبت است.</li><li>حدس درست به تعداد سؤال‌های باقی‌مانده امتیاز دارد؛ شکست صفر. در امتیاز مساوی، مجموع زمان همهٔ نوبت‌ها کمتر بهتر است. مکث و شمارش معکوس حساب نمی‌شوند.</li><li>در پایان، امتیازها و نویسندهٔ کارت‌ها را ببینید و اگر خواستید با همان جمع بازی تازه‌ای شروع کنید.</li></ol><p>اینترنت لازم است؛ نصب و حساب لازم نیست. بیرون رفتن سازنده برای پیدا کردن عکس، بازی بقیه را قطع نمی‌کند. اگر بازیکن نوبت یا داور قطع شود، بازی مکث می‌شود.</p><p>اسم‌ها، متن‌ها و عکس‌ها فقط برای لابی ذخیره می‌شوند. کارت‌های آینده برای بقیه پنهان‌اند و عکس‌ها لینک عمومی دائمی ندارند. هرکس کد لابی را داشته باشد، تا پیش از شروع می‌تواند وارد شود؛ کد را فقط به جمع خودتان بدهید.</p><p>لابی تا ۲۴ ساعت بعد از ساخت معتبر است. داده‌های منقضی به‌صورت دوره‌ای پاک می‌شوند. ورود همین مرورگر برای برگشت به بازی روی گوشی‌ات ذخیره می‌شود.</p></div></details>`;
}
function gameFooter(text='بیست سؤال، یک جواب، کلی خنده.') {
  return `<footer><span>${text}</span><a href="https://github.com/Raminyazdani/-bist-soali-dorehamI" target="_blank" rel="noopener noreferrer">کد و گزارش مشکل در گیت‌هاب ↗</a></footer>`;
}
function renderHome() {
  const code = digits(new URL(location.href).searchParams.get('room') || '');
  return `<div class="shell home-shell"><header>${brand()}<span class="top-tag">بازی برای دورهمی</span></header>
    <main class="home-grid"><section class="home-intro"><span class="eyebrow">همه دور هم، هرکس با گوشی خودش</span><h1>من چی‌ام؟<br><span>شما بگید!</span></h1><p>کارت بنویس، گوشی را بگیر بالای سرت<br>و با بیست سؤال جواب را پیدا کن.</p><div class="card-art" aria-hidden="true"><div class="art-card back">یک شخصیت؟</div><div class="art-card front"><span>روی پیشونی!</span><b>؟</b><small>جواب پیش بقیه‌ست.</small></div><span class="art-star">✦</span><span class="art-dot"></span></div><div class="home-meta"><span>۲ تا ۱۲ نفر</span><i></i><span>عکس یا متن</span><i></i><span>بدون نصب</span></div></section>
    <section class="entry-panel"><div class="tabs" role="tablist"><button role="tab" aria-selected="${homeTab==='create'}" class="${homeTab==='create'?'selected':''}" data-tab="create">ساخت لابی</button><button role="tab" aria-selected="${homeTab==='join'}" class="${homeTab==='join'?'selected':''}" data-tab="join">ورود با کد</button></div>
    ${setupError?`<div class="notice warn"><b>اتصال بازی هنوز آماده نیست</b><p>${esc(setupError)}</p><button class="text-button" data-do="retry-setup">بررسی دوباره</button></div>`:`
    <form id="entry-form" data-entry="${homeTab}"><h2>${homeTab==='create'?'جمع را راه بنداز':'جای تو در جمع خالیه'}</h2><p class="muted">${homeTab==='create'?'یک کد می‌گیری؛ بقیه با آن وارد می‌شوند.':'کد شش‌رقمی را از صاحب لابی بگیر.'}</p>
      <label>اسمت<input name="name" id="entry-name" autocomplete="nickname" maxlength="28" placeholder="مثلاً رامین" required value="${esc(readStored(PENDING_KEY)?.name || '')}" /></label>
      ${homeTab==='create'?'<label>هر نفر چند کارت بسازد؟<div class="count-field"><input name="count" type="number" min="1" max="20" value="3" required /><span>کارت برای هر نفر</span></div></label>':`<label>کد لابی<input name="code" inputmode="numeric" autocomplete="off" maxlength="6" pattern="[0-9۰-۹٠-٩]{6}" placeholder="۱۲۳۴۵۶" dir="ltr" class="code-input" value="${esc(code || readStored(PENDING_KEY)?.code || '')}" required /></label>`}
      <button class="button primary full" type="submit">${homeTab==='create'?'بسازیم! ←':'بریم توی لابی ←'}</button>
    </form>`}<div class="entry-note"><span>✦</span> بدون حساب و نصب؛ لابی به باز بودن گوشی سازنده وابسته نیست.</div></section></main>${gameGuide()}${gameFooter()}</div>`;
}
function renderLobby() {
  const allReady = state.players.length>=2 && state.players.every(p=>p.ready);
  return `<section class="stage-heading"><span class="eyebrow">اول جمع را کامل کنید</span><h1>همه رسیدن؟</h1><p>کد را بده به دوست‌ها و وقتی آماده‌ای علامت بزن.</p></section><div class="two-columns"><section class="panel">${roomStrip()}<div class="panel-heading"><h2>جمع ما</h2><span class="pill">${fa(state.players.length)} نفر</span></div>${playerList()}<button class="button ${me().ready?'secondary':'primary'} full" data-action="readyLobby" data-ready="${!me().ready}">${me().ready?'✓ آماده‌ام؛ تغییرش بده':'من آماده‌ام'}</button><p class="tiny muted">لابی به گوشی سازنده وابسته نیست؛ برای پیدا کردن عکس می‌توانی از بازی بیرون بروی.</p></section><section class="panel mint-panel"><h2>قانون امشب</h2><p class="muted">هر نفر همین تعداد کارت می‌نویسد و همین تعداد نوبت بازی می‌کند.</p>${host()?`<label>تعداد کارت هر نفر<div class="count-field"><input id="lobby-count" type="number" min="1" max="20" value="${state.cardsPerPlayer}"/><button class="text-button" data-do="set-count">ثبت</button></div></label>`:`<div class="big-number">${fa(state.cardsPerPlayer)}<small>کارت برای هر نفر</small></div>`}<div class="rule-lines"><p><b>۲۰</b> سؤال برای هر کارت</p><p><b>+ امتیاز</b> برای سؤال‌های باقی‌مانده</p><p><b>زمان کمتر</b> برای امتیاز مساوی</p></div>${host()?`<button class="button dark full" data-action="startWriting" ${!allReady?'disabled':''}>شروع کارت‌سازی ←</button><p class="tiny muted">${allReady?'جمع کامل است؟ می‌توانی شروع کنی.':'وقتی حداقل دو نفر و همه آماده باشند، فعال می‌شود.'}</p>`:`<div class="notice">${allReady?'همه آماده‌اند؛ منتظر شروع مدیر هستیم.':'منتظر کامل‌شدن جمع هستیم.'}</div>`}</section></div>`;
}
function renderWriting() {
  const ready = me().ready;
  return `<section class="stage-heading"><span class="eyebrow">جواب‌های بامزه بنویسید</span><h1>کارت‌های تو</h1><p>اسم، عدد، شخصیت یا هر چیز دیگر. عکس اختیاری؛ متن همیشه لازم.</p></section><div class="writing-layout"><section><div class="writing-progress"><span class="js-draft-progress"></span><span class="tiny muted">کارت‌ها برای بقیه پنهان‌اند</span></div><div class="card-editor-list">${state.ownCards.map((card,i)=>`<article class="card-editor"><div class="editor-top"><span class="card-index">کارت ${fa(i+1)}</span><span class="tiny muted">${uploadIds.has(card.id)?'در حال بارگذاری عکس…':ready?'قفل شده':'ذخیرهٔ خودکار'}</span></div><label class="sr-only" for="card-${card.id}">متن کارت ${fa(i+1)}</label><textarea id="card-${card.id}" data-card="${card.id}" rows="2" maxlength="160" placeholder="مثلاً: شرلوک هولمز" ${ready?'disabled':''}>${esc(draftMap.has(card.id)?draftMap.get(card.id):card.text)}</textarea>${card.imageUrl?`<div class="editor-photo"><img src="${esc(card.imageUrl)}" alt="عکس کارت ${fa(i+1)}" loading="lazy"/>${!ready?`<button class="photo-remove" data-do="remove-photo" data-card-id="${card.id}" aria-label="حذف عکس کارت ${fa(i+1)}">×</button>`:''}</div>`:''}<div class="editor-bottom"><label class="photo-button ${ready||uploadIds.has(card.id)?'disabled':''}">▧ ${card.imageUrl?'تغییر عکس':'اضافه‌کردن عکس'}<input type="file" accept="image/*" data-photo="${card.id}" ${ready||uploadIds.has(card.id)?'disabled':''}/></label><span class="tiny muted">حداکثر ۱۶۰ حرف</span></div></article>`).join('')}</div><div class="ready-bar"><button class="button ${ready?'secondary':'primary'} full" data-do="cards-ready" ${uploadIds.size?'disabled':''}>${ready?'✓ کارت‌ها آماده‌اند؛ ویرایش کنم':'کارت‌هایم آماده‌اند ←'}</button><p class="tiny muted">${ready?'با آماده‌شدن همه، کارت‌ها تقسیم می‌شوند.':'پیش از آماده‌شدن، همهٔ متن‌ها را بررسی کن.'}</p></div></section><aside class="panel writing-people"><div class="panel-heading"><h2>بقیهٔ جمع</h2><span class="pill">${fa(state.players.filter(p=>p.ready).length)} آماده</span></div>${playerList(true)}<p class="tiny muted">هر کارت فقط یک بار بازی می‌شود و کارت خودت به تو نمی‌رسد.</p></aside></div>`;
}
function turnCard(card, extraClass='') {
  return `<div class="guess-card ${extraClass}">${card?.imageUrl?`<img src="${esc(card.imageUrl)}" alt="عکس کارت"/>`:''}<h2>${esc(card?.text || '')}</h2>${card?`<small>نوشتهٔ ${esc(card.authorName)}</small>`:''}</div>`;
}
function turnOrder() {
  return `<div class="turn-order">${state.order.map(id=>`<span class="${id===state.turn.playerId?'active':''}">${esc(nameOf(id))}</span>`).join('<i>←</i>')}</div>`;
}
function renderPlaying() {
  const turn = state.turn;
  if (turn.status==='result') {
    const result=turn.result;
    return `<section class="turn-result"><span class="result-symbol ${result.success?'success':'failure'}">${result.success?'✦':'↻'}</span><span class="eyebrow">نوبت ${esc(nameOf(turn.playerId))} تمام شد</span><h1>${result.success?'پیداش کردی!':'این یکی موند!'}</h1>${turnCard(turn.card)}<div class="result-stats"><div><b>${fa(result.score)}</b><span>امتیاز این نوبت</span></div><div><b dir="ltr">${fullTime(result.elapsedMs)}</b><span>زمان نوبت</span></div></div>${referee()||host()?'<button class="button primary" data-action="next">نوبت بعدی ←</button>':'<p class="muted">منتظر شروع نوبت بعدی هستیم.</p>'}<p class="tiny muted">نفر بعد: ${esc(nameOf(state.order[(state.turnIndex+1)%state.order.length]))}</p></section>`;
  }
  if (guesser()) {
    return `<main class="head-screen ${turn.status==='waiting'?'waiting':''}"><div class="head-top"><button class="icon-button" data-do="menu" aria-label="مدیریت لابی">⋯</button><span>نوبت توست، ${esc(me().name)}!</span><span>دور ${fa(Math.floor(state.turnIndex/state.order.length)+1)} از ${fa(state.cardsPerPlayer)}</span></div>${turn.status==='waiting'?`<div class="head-instruction"><span class="forehead-symbol">؟</span><h1>گوشی بالای سرت!</h1><p>صفحه رو به بقیه باشد.<br>${esc(nameOf(turn.refereeId))} شروع را می‌زند.</p><button class="text-button" data-do="fullscreen">بزرگ‌کردن صفحه ⛶</button><button class="text-button" data-do="menu">مدیریت نوبت</button></div>`:`<div class="head-countdown js-countdown"><b></b><span>آماده باش…</span></div>${turnCard(turn.card,'head-card js-reveal')}<div class="head-paused ${turn.status==='paused'?'':'hidden'}"><span>Ⅱ</span><h2>بازی مکث شده</h2><p>${turn.pauseReason==='connection'?'منتظر برگشت اتصال هستیم.':'داور دوباره ادامه می‌دهد.'}</p><button class="text-button" data-do="menu">مدیریت نوبت</button></div>`}<div class="head-bottom"><span>سؤال باقی‌مانده <b>${fa(turn.remaining)}</b></span><span class="js-time" dir="ltr"></span></div>${menu()}</main>`;
  }
  return `<section class="stage-heading compact"><span class="eyebrow">دور ${fa(Math.floor(state.turnIndex/state.order.length)+1)} از ${fa(state.cardsPerPlayer)} · نوبت ${fa(state.turnIndex+1)} از ${fa(state.totalTurns)}</span><h1>نوبت ${esc(nameOf(turn.playerId))}</h1><p>${referee()?'تو داور این نوبتی؛ سؤال‌ها و نتیجه را ثبت کن.':`داور: ${esc(nameOf(turn.refereeId))} · تو به سؤال‌ها جواب بده.`}</p></section>${turnOrder()}<div class="play-layout"><section class="card-stage">${turn.status==='waiting'?'<div class="hidden-card"><b>؟</b><p>کارت با شروع نوبت رو می‌شود.</p></div>':`<div class="observer-countdown js-countdown"><b></b><span>گوشی بالای سر باشد…</span></div>${turnCard(turn.card,'js-reveal')}`}</section><section class="panel control-panel"><div class="metrics"><div class="question-meter ${turn.remaining===0?'empty':''}"><span>سؤال باقی‌مانده</span><b>${fa(turn.remaining)}</b><small>از ۲۰ سؤال</small></div><div class="time-meter"><span>زمان نوبت</span><b class="js-time" dir="ltr"></b><small>زمان کمتر، رتبهٔ بهتر</small></div></div>
    ${turn.status==='waiting'?`${referee()?'<button class="button primary full" data-action="start">شروع نوبت ▶</button>':'<div class="notice">منتظر شروع داور هستیم.</div>'}<p class="tiny muted">سه ثانیه فرصت برای بالابردن گوشی.</p>`:turn.status==='paused'?`<div class="notice warn">${turn.pauseReason==='connection'?'اتصال بازیکن یا داور قطع شد؛ زمان متوقف است.':'زمان موقتاً متوقف شده است.'}</div>${referee()?'<button class="button primary full" data-action="resume">ادامهٔ نوبت ▶</button>':''}`:`${turn.remaining===0?'<div class="notice warn">پاسخ سؤال بیستم را هم بشنو؛ سپس نتیجه را ثبت کن.</div>':''}${referee()?`<div class="main-controls"><button class="button dark full" data-action="question" data-running ${turn.remaining===0?'disabled':''}>یک سؤال پرسید <span>−۱</span></button><button class="button primary full" data-action="correct" data-running>✓ درست حدس زد</button><button class="button secondary full" data-action="failed" data-running ${turn.remaining!==0?'disabled':''}>پایان ناموفق</button></div><div class="minor-controls"><button class="text-button" data-action="undoQuestion" data-running ${!turn.canUndo?'disabled':''}>↶ برگرداندن سؤال</button><button class="text-button" data-action="pause">Ⅱ مکث</button></div>`:'<div class="notice">ثبت سؤال و نتیجه با داور است.</div>'}`}
    <p class="tiny muted">حدس مستقیم هم یک سؤال است؛ اول شمارنده را کم کن.</p></section></div>`;
}
function renderFinished() {
  const winners = state.scores.filter(p=>p.rank===1);
  return `<section class="stage-heading finish-heading"><span class="winner-star">✦</span><span class="eyebrow">چه دورهمی خوبی!</span><h1>${winners.map(p=>esc(p.name)).join(' و ')}<br><span>اول ${winners.length>1?'شدند':'شد'}!</span></h1><p>امتیاز بیشتر؛ در تساوی، مجموع زمان کمتر.</p></section><section class="panel scoreboard"><table><thead><tr><th>رتبه</th><th>بازیکن</th><th>امتیاز</th><th>زمان</th></tr></thead><tbody>${state.scores.map(p=>`<tr class="${p.rank===1?'winner-row':''}"><td><span class="rank">${p.rank===1?'♕':fa(p.rank)}</span></td><td>${esc(p.name)}${p.playerId===state.you?'<small>تو</small>':''}<span class="score-detail">${fa(p.correct)} حدس درست از ${fa(p.completed)}</span></td><td class="score-number">${fa(p.score)}</td><td class="score-time" dir="ltr">${fullTime(p.elapsedMs)}</td></tr>`).join('')}</tbody></table>${host()?'<button class="button primary full" data-action="reset">همین جمع، بازی تازه ↻</button>':'<div class="notice">مدیر می‌تواند بازی تازه را شروع کند.</div>'}</section><details class="deck-summary"><summary>همهٔ کارت‌ها و نویسنده‌ها <span>${fa(state.completedCards.length)} کارت</span></summary><div class="deck-grid">${state.completedCards.map(r=>`<article class="summary-card">${r.card.imageUrl?`<img src="${esc(r.card.imageUrl)}" alt="عکس ${esc(r.card.text)}" loading="lazy"/>`:''}<h3>${esc(r.card.text)}</h3><p>نویسنده: ${esc(r.card.authorName)}</p><p>بازیکن: ${esc(nameOf(r.playerId))}</p><span class="pill ${r.success?'green':''}">${r.success?'✓ درست':'بی‌پاسخ'} · ${fa(r.score)} امتیاز</span></article>`).join('')}</div></details>`;
}
function render() {
  app.dataset.revision=String(state?.revision??-1);app.dataset.phase=state?.phase??'home';app.dataset.you=state?.you??'';
  const focused = document.activeElement;
  const focusId = focused?.id, selection = ['TEXTAREA','INPUT'].includes(focused?.tagName) ? [focused.selectionStart, focused.selectionEnd] : null;
  const scroll = window.scrollY;
  document.body.classList.toggle('head-mode', Boolean(state?.phase==='playing' && guesser() && state.turn.status!=='result'));
  if (!state) app.innerHTML = renderHome();
  else if (document.body.classList.contains('head-mode')) app.innerHTML = renderPlaying();
  else app.innerHTML = `<div class="shell">${header()}${menu()}${stepper()}<main>${state.phase==='lobby'?renderLobby():state.phase==='writing'?renderWriting():state.phase==='playing'?renderPlaying():renderFinished()}</main>${gameFooter(state.phase==='playing'?'هر سؤال یک قدم نزدیک‌تر.':undefined)}</div>`;
  // A mobile picker can finish after a snapshot replaced this input. Keep its
  // handler on the input itself so the selection still reaches upload().
  for (const input of app.querySelectorAll('input[data-photo]')) {
    input.addEventListener('change',()=>upload(input.dataset.photo,input.files[0]));
  }
  if (focusId && !pendingConfirmation) {
    const target = document.getElementById(focusId);
    if (target && !target.disabled) { target.focus({ preventScroll:true }); if (selection && selection[0]!==null) { try { target.setSelectionRange(...selection); } catch {} } }
  }
  window.scrollTo({ top:scroll, behavior:'instant' });
  updateConnection(); updateDraftProgress(); updateControls(); tick();
}
function updateDraftProgress() {
  const el=$('.js-draft-progress'); if (!el || !state) return;
  const count=state.ownCards.filter(c=>String(draftMap.has(c.id)?draftMap.get(c.id):c.text).trim()).length;
  el.textContent=`${fa(count)} از ${fa(state.cardsPerPlayer)} کارت کامل شده`;
}
function updateConnection() {
  const el=$('.js-connection'); if (!el) return;
  const ok=navigator.onLine && Date.now()-lastContact<20000;
  el.className=`connection js-connection ${ok?'connected':'disconnected'}`;
  el.querySelector('span').textContent=!navigator.onLine?'اینترنت قطع است':ok?(live?'وصل به جمع':'وصل؛ در حال همگام‌سازی'):'در حال اتصال مجدد';
}
function updateControls() {
  document.querySelectorAll('button[data-action],button[data-do="cards-ready"],button[type="submit"]').forEach(button=>{
    if (!button.dataset.originalDisabled) button.dataset.originalDisabled=button.disabled?'yes':'no';
    const countdown=button.hasAttribute('data-running') && state?.turn?.status==='running' && clock()<state.turn.startedAt;
    button.disabled=busy || button.dataset.originalDisabled==='yes' || countdown;
  });
}
function tick() {
  const turn=state?.turn; if (!turn) return;
  const countdown=turn.status==='running'?Math.max(0,Math.ceil((turn.startedAt-clock())/1000)):0;
  document.querySelectorAll('.js-countdown').forEach(el=>{el.classList.toggle('hidden', !countdown); el.querySelector('b').textContent=fa(countdown);});
  document.querySelectorAll('.js-reveal').forEach(el=>el.classList.toggle('hidden', countdown>0 || turn.status==='paused'));
  const elapsed=turn.elapsedMs+(turn.status==='running'?Math.max(0,clock()-turn.startedAt):0);
  document.querySelectorAll('.js-time').forEach(el=>el.textContent=seconds(elapsed));
  updateControls();
}
async function invite() {
  const url = new URL(location.origin); url.searchParams.set('room',state.code);
  const text=`روی پیشونی! کد لابی: ${state.code}\n${url}`;
  try { await navigator.clipboard.writeText(text); toast('کد و لینک دعوت کپی شد.',false); }
  catch { toast(`کد لابی: ${state.code}`,false); }
}
app.addEventListener('submit', event=>{const form=event.target;if(form.id==='entry-form'){event.preventDefault();submitEntry(form.dataset.entry,form);}});
app.addEventListener('input', event=>{if(event.target.dataset.card)queueSave(event.target.dataset.card,event.target.value);});
app.addEventListener('change', event=>{
  if(event.target.dataset.select==='referee')action('setReferee',{playerId:event.target.value}).catch(()=>{});
});
app.addEventListener('click',async event=>{
  const button=event.target.closest('button'); if(!button || button.disabled)return;
  if(button.dataset.tab){homeTab=button.dataset.tab;render();return;}
  const name=button.dataset.action, command=button.dataset.do;
  try {
    if(name){
      await stayAwake();
      if(['correct','failed','reset'].includes(name))await sensitiveAction(name,name==='reset'?{confirm:true}:{});
      else await action(name,name==='readyLobby'?{ready:button.dataset.ready==='true'}:{});
      return;
    }
    if(command==='menu'){menuOpen=!menuOpen;render();}
    if(command==='invite')await invite();
    if(command==='set-count')await action('setCount',{count:$('#lobby-count').value});
    if(command==='cards-ready')await readyCards();
    if(command==='remove-photo')await action('removeImage',{cardId:button.dataset.cardId});
    if(command==='transfer'){const id=$('#host-target').value;if(id){await action('transferHost',{playerId:id});menuOpen=false;render();}}
    if(command==='claim'){await action('claimHost');menuOpen=false;render();}
    if(command==='leave')await action('leave');
    if(command==='kick'){
      const id=$('#kick-target').value, restarting=state.phase!=='lobby';
      if(id)await sensitiveAction('kick',{playerId:id,confirm:restarting});
    }
    if(command==='close-room')await sensitiveAction('closeRoom');
    if(command==='reset-confirm')await sensitiveAction('reset',{confirm:true});
    if(command==='fullscreen'){try{await document.documentElement.requestFullscreen?.();}catch{}await stayAwake();}
    if(command==='retry-setup')await initialize();
  } catch { /* Action already showed the specific error. */ }
});
window.addEventListener('online',()=>{sync(false);updateConnection();});
window.addEventListener('offline',updateConnection);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){sync();stayAwake();}else transport.suspend();});
window.addEventListener('pagehide',()=>transport.suspend());
transport.onSnapshot(next=>{lastContact=Date.now();accept(next);});
transport.onStatus(connected=>{live=connected;updateConnection();});
async function initialize() {
  try {
    config=await api({type:'config'});setupError='';
    if(session){await sync(false);if(session){await connectRoom();await stayAwake();}}
    else {
      const pending=readStored(PENDING_KEY);
      if(pending){try{const joined=await api(pending);session=joined.credentials;storeValue(SESSION_KEY,session);storeValue(PENDING_KEY,null);accept(joined.snapshot);await connectRoom();}catch{render();}}
      else render();
    }
  }catch(error){setupError=error.message || 'اینترنت یا اتصال بازی را بررسی کنید.';render();}
}
setInterval(tick,100);
setInterval(()=>{if(session && document.visibilityState==='visible')sync();updateConnection();},1600);
initialize();
