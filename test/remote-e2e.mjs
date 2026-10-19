// One real three-player room: remote guessers must never receive their answer
// or private photo before the result, while the other phones can referee it.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {localServer} from '../scripts/server.mjs';

const base=(process.env.E2E_URL||'http://127.0.0.1:5185').replace(/\/$/,'');
const output=new URL('../test-output/',import.meta.url);
const server=process.env.E2E_URL?null:localServer({directory:'test-output/rooms-5185'});
if(server)await new Promise(resolve=>server.listen(5185,'127.0.0.1',resolve));
const proxy=process.env.HTTPS_PROXY;
const browser=await chromium.launch({headless:true,args:['--no-sandbox',...(proxy?['--ignore-certificate-errors']:[])],...(proxy?{proxy:{server:proxy}}:{})});
const readerSource=await readFile(new URL('api-reader.js',import.meta.url),'utf8');
const pages=[],contexts=[],ids=[],errors=[],checks=[],photoRequests=[[],[],[]];
const labels=['پاسخ محرمانهٔ انار','پاسخ محرمانهٔ دوچرخه','پاسخ محرمانهٔ فیل'];
const violations=[],pendingReplies=new Set();
const audited={activeSnapshots:0,activeActionSnapshots:0,compactReplies:0};
const elapsed=s=>s.turn.elapsedMs+(s.turn.status==='running'&&s.turn.startedAt?Math.max(0,s.serverNow-s.turn.startedAt):0);
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
await mkdir(output,{recursive:true});

function auditReply(data,index,kind){
  const snapshot=data?.snapshot;
  const active=snapshot?.phase==='playing'&&snapshot.turn?.status!=='result'&&snapshot.turn?.playerId===ids[index];
  if(active||data?.unchanged){
    const serialized=JSON.stringify(data);
    if(labels.some(text=>serialized.includes(text)))violations.push('answer text in a hidden game response');
    if(serialized.includes('/api/photo?')||serialized.includes('imagePath'))violations.push('private photo in a hidden game response');
    if(serialized.includes('tokenHash'))violations.push('credential hash in a game response');
  }
  if(active){
    audited.activeSnapshots++;
    if(kind==='action')audited.activeActionSnapshots++;
    if(snapshot.turn.card!=null)violations.push('active guesser received a card object');
    if(snapshot.ownCards?.length||snapshot.completedCards?.length)violations.push('active guesser received a hidden deck');
  }
  if(data?.unchanged)audited.compactReplies++;
}
function observe(page,index){
  page.on('pageerror',error=>errors.push(error.message));
  page.on('request',request=>{
    const url=new URL(request.url());
    if(url.origin===new URL(base).origin&&url.pathname==='/api/photo')photoRequests[index].push(url.searchParams.get('path'));
  });
  page.on('response',response=>{
    if(new URL(response.url()).pathname!=='/api/game'||!response.ok())return;
    const task=(async()=>{
      let data;
      // A reload can cancel an old response body. Explicit fresh reads below
      // must succeed; cancellation does not turn a discarded body into proof.
      try{data=await response.json();}catch{return;}
      let kind;
      try{kind=response.request().postDataJSON()?.type;}catch{}
      auditReply(data,index,kind);
    })();
    pendingReplies.add(task);void task.finally(()=>pendingReplies.delete(task));
  });
}
async function flushAudit(){
  while(pendingReplies.size)await Promise.all([...pendingReplies]);
  assert.deepEqual(violations,[],'remote response privacy violations');
}
async function read(page){
  if(!await page.evaluate(()=>typeof window.readGameState==='function'))await page.addScriptTag({content:readerSource});
  return page.evaluate(()=>window.readGameState());
}
async function request(page,body){
  return page.evaluate(async body=>{
    const credentials=JSON.parse(localStorage.getItem('forehead-session-v3'));
    const response=await fetch('/api/game',{method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',body:JSON.stringify({...credentials,...body})});
    return {status:response.status,data:await response.json()};
  },body);
}
async function click(page,selector){
  const before=Number(await page.locator('#app').getAttribute('data-command-sequence')||0);
  const action=await page.locator(selector).evaluate(button=>button.dataset.action);
  await page.locator(selector).click();
  if(['correct','failed','reset'].includes(action))await page.locator('[data-confirm=accept]').click();
  await page.waitForFunction(before=>Number(document.querySelector('#app').dataset.commandSequence)>before&&!document.querySelector('#app').classList.contains('busy'),before,{timeout:35000});
}
async function syncAll(state){
  await Promise.all(pages.map(page=>page.waitForFunction(revision=>Number(document.querySelector('#app').dataset.revision)>=revision,state.revision,{timeout:25000})));
}
async function loaded(page,selector){
  await page.locator(selector).first().waitFor({timeout:15000});
  await page.waitForFunction(selector=>{const img=document.querySelector(selector);return img?.complete&&img.naturalWidth===900;},selector,{timeout:15000});
}
async function remoteView(page,remaining){
  await page.locator('.remote-turn-screen[data-view=remote-turn]').waitFor();
  const view=await page.locator('.remote-turn-screen').innerText();
  assert.match(view,/نوبت توست/);
  assert.doesNotMatch(view,/بالای سر|بالای سرت|چرخاندن|بچرخان|افقی کن|تمام.?صفحه/);
  assert.doesNotMatch(await page.locator('#app').innerText(),/گوشی بالای سر|گوشی بالای سرت|صفحه را بچرخان|افقی کن|بزرگ.کردن صفحه/);
  assert.equal(await page.locator('.head-screen,.head-card,.head-instruction,[data-do=fullscreen]').count(),0);
  assert.equal(await page.locator('body.head-mode').count(),0);
  assert.equal(await page.locator('.remote-turn-screen img,.remote-turn-screen .guess-card').count(),0);
  for(const text of labels)assert.ok(!(await page.locator('#app').innerHTML()).includes(text),'answer text entered active guesser DOM');
  assert.ok(!(await page.locator('#app').innerHTML()).includes('/api/photo?'),'private photo URL entered active guesser DOM');
  const numbers=await page.locator('.remote-turn-screen').evaluate(root=>{
    const number=key=>Number(root.querySelector(`[data-remote=${key}]`).textContent.replace(/[۰-۹]/g,d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
    return {remaining:number('remaining'),used:number('used'),total:number('total')};
  });
  assert.deepEqual(numbers,{remaining,used:10-remaining,total:10});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
}
async function hiddenReads(page,index){
  const state=await read(page);
  assert.equal(state.settings.remotePlay,true);
  assert.ok(state.turn.card==null,'full snapshot revealed the current remote answer');
  auditReply({snapshot:state},index,'explicit-full');
  const poll=await request(page,{type:'state',knownRevision:state.revision});
  assert.equal(poll.status,200);
  assert.ok(poll.data.snapshot||poll.data.unchanged,'conditional poll returned no state');
  if(process.env.E2E_URL)assert.ok(poll.data.unchanged,'stable hosted revision did not use compact polling');
  auditReply(poll.data,index,'explicit-poll');
  await flushAudit();
  return state;
}

try{
  for(let i=0;i<3;i++){
    const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,locale:'fa-IR'});
    if(server)await context.route(base+'/**',async route=>{
      const req=route.request(),body=req.postDataBuffer();
      const response=await fetch(req.url(),{method:req.method(),headers:req.headers(),...(body?{body}:{})});
      await route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:Buffer.from(await response.arrayBuffer())});
    });
    const page=await context.newPage();contexts.push(context);pages.push(page);observe(page,i);await page.goto(base);
  }
  const creator=pages[0];
  assert.equal(await creator.locator('#entry-remote-play[name=remotePlay]').isChecked(),false);
  await creator.locator('#entry-name').fill('میزبان دور');await creator.locator('[name=count]').fill('1');
  await creator.locator('[name=questions]').selectOption('10');await creator.locator('#entry-remote-play').check();
  await click(creator,'button[type=submit]');
  const initial=await read(creator);assert.equal(initial.settings.remotePlay,true);
  for(let i=1;i<3;i++){
    await pages[i].goto(base+'/?room='+initial.code);await pages[i].locator('#entry-name').fill(i===1?'دوست دور یک':'دوست دور دو');
    await click(pages[i],'button[type=submit]');
  }
  for(const page of pages)ids.push(await page.evaluate(()=>JSON.parse(localStorage.getItem('forehead-session-v3')).playerId));
  await syncAll(await read(creator));
  await Promise.all(pages.map(page=>click(page,'[data-action=readyLobby]')));
  await creator.locator('#lobby-remote-play').uncheck();await click(creator,'[data-do=set-count]');
  let configured=await read(creator);assert.equal(configured.settings.remotePlay,false);assert.ok(configured.players.every(p=>!p.ready));
  await syncAll(configured);await Promise.all(pages.map(page=>click(page,'[data-action=readyLobby]')));
  await creator.locator('#lobby-remote-play').check();await click(creator,'[data-do=set-count]');
  configured=await read(creator);assert.equal(configured.settings.remotePlay,true);assert.ok(configured.players.every(p=>!p.ready));
  const identity=await creator.evaluate(()=>JSON.parse(localStorage.getItem('forehead-session-v3')));
  await creator.reload();await creator.locator('#lobby-remote-play').waitFor();
  assert.equal(await creator.locator('#lobby-remote-play').isChecked(),true);
  assert.deepEqual(await creator.evaluate(()=>JSON.parse(localStorage.getItem('forehead-session-v3'))),identity);
  assert.equal((await read(creator)).settings.remotePlay,true);
  checks.push('remote play defaults off; host changes clear all readiness and persist across same-identity reload');

  await syncAll(await read(creator));await Promise.all(pages.map(page=>click(page,'[data-action=readyLobby]')));
  await creator.locator('[data-action=startWriting]:not([disabled])').waitFor();await click(creator,'[data-action=startWriting]');
  await Promise.all(pages.map(page=>page.locator('textarea[data-card]').waitFor()));
  const writing=await read(creator);
  const locked=await request(creator,{type:'action',requestId:crypto.randomUUID(),action:'setSettings',data:{generation:writing.generation,settings:{remotePlay:false}}});
  assert.equal(locked.status,400);assert.equal(locked.data.code,'ROOM_LOCKED');
  assert.equal((await read(creator)).settings.remotePlay,true);assert.equal(await creator.locator('#lobby-remote-play').count(),0);
  for(let i=0;i<3;i++){
    await pages[i].locator('textarea[data-card]').fill(labels[i]);
    const buffer=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="900" height="600"><rect width="900" height="600" fill="${['#bdeb72','#a999ed','#ffad68'][i]}"/><circle cx="450" cy="300" r="210" fill="#20302a"/></svg>`);
    await pages[i].locator('input[type=file]').first().setInputFiles({name:'remote-photo.svg',mimeType:'image/svg+xml',buffer});
    await loaded(pages[i],'.editor-photo img');
  }
  checks.push('remote rules lock at writing; all three authors save real text and generated photos through private upload');
  await Promise.all(pages.map(page=>click(page,'[data-do=cards-ready]')));
  await Promise.all(pages.map(page=>page.locator('#app[data-phase=playing]').waitFor()));
  const seen=new Set(),guessers=new Set();let checkedTimer=false,checkedHandoff=false,checkedReload=false,checkedGuesserAction=false;
  for(let turn=0;turn<3;turn++){
    const state=await read(creator),guessIndex=ids.indexOf(state.turn.playerId),refIndex=ids.indexOf(state.turn.refereeId);
    const otherIndex=[0,1,2].find(index=>index!==guessIndex&&index!==refIndex);
    const guess=pages[guessIndex],ref=pages[refIndex],other=pages[otherIndex];let activeRef=ref;
    assert.equal(state.turnIndex,turn);guessers.add(state.turn.playerId);
    await syncAll(state);await remoteView(guess,10);await hiddenReads(guess,guessIndex);
    await ref.locator('[data-action=start]').waitFor();
    const [startResponse]=await Promise.all([
      ref.waitForResponse(response=>{
        if(new URL(response.url()).pathname!=='/api/game')return false;
        try{return response.request().postDataJSON()?.action==='start';}catch{return false;}
      }),
      click(ref,'[data-action=start]')
    ]);
    const started=(await startResponse.json()).snapshot;assert.ok(started);
    assert.ok(started.turn.startedAt>started.serverNow,'real three-second countdown was skipped');
    assert.equal(await ref.locator('.card-stage .js-reveal').isVisible(),false);
    await syncAll(started);
    await remoteView(guess,10);await hiddenReads(guess,guessIndex);
    await ref.locator('[data-action=question]:not([disabled])').waitFor({timeout:10000});
    await loaded(ref,'.card-stage img');await loaded(other,'.card-stage img');
    const revealed=await read(ref),card=revealed.turn.card;
    assert.ok(card&&labels.includes(card.text));assert.notEqual(card.authorId,revealed.turn.playerId);
    assert.ok(!seen.has(card.id));seen.add(card.id);
    assert.match(await ref.locator('.card-stage').innerText(),new RegExp(card.text));
    assert.match(await other.locator('.card-stage').innerText(),new RegExp(card.text));
    const path=new URL(card.imageUrl,base).searchParams.get('path');assert.ok(path);
    assert.equal(photoRequests[guessIndex].filter(p=>p===path).length,0,'remote guesser requested its unrevealed photo');
    await remoteView(guess,10);await hiddenReads(guess,guessIndex);

    if(turn===0){
      await guess.screenshot({path:fileURLToPath(new URL('remote-guesser-portrait.png',output)),fullPage:true});
      await guess.setViewportSize({width:844,height:390});await remoteView(guess,10);
      await guess.screenshot({path:fileURLToPath(new URL('remote-guesser-landscape.png',output)),fullPage:true});
      await guess.setViewportSize({width:390,height:844});
      const before=await guess.locator('.remote-turn-screen .js-time').innerText();
      await guess.waitForFunction(before=>document.querySelector('.remote-turn-screen .js-time')?.textContent!==before,before,{timeout:5000});
      await click(ref,'[data-action=question]');await syncAll(await read(ref));await remoteView(guess,9);
      await click(ref,'[data-action=undoQuestion]');await syncAll(await read(ref));await remoteView(guess,10);
      const beforeReload=await guess.evaluate(()=>JSON.parse(localStorage.getItem('forehead-session-v3')));
      await guess.reload();await guess.locator('.remote-turn-screen').waitFor({timeout:35000});
      assert.deepEqual(await guess.evaluate(()=>JSON.parse(localStorage.getItem('forehead-session-v3'))),beforeReload);
      await remoteView(guess,10);await hiddenReads(guess,guessIndex);checkedReload=true;
    }

    // The host is also a guesser exactly once. A legal authenticated host pause
    // must redact its action response, not only state/poll responses.
    if(turn===0||guessIndex===0){
      if(guessIndex===0){
        const current=await read(guess);
        const paused=await request(guess,{type:'action',requestId:crypto.randomUUID(),action:'pause',data:{generation:current.generation,turnId:current.turn.id}});
        assert.equal(paused.status,200);assert.ok(paused.data.snapshot?.turn.card==null,'guesser action response revealed an answer');
        auditReply(paused.data,guessIndex,'action');checkedGuesserAction=true;
      }else await click(ref,'[data-action=pause]');
      const paused=await read(ref);assert.equal(paused.turn.status,'paused');await syncAll(paused);await remoteView(guess,10);
      await delay(150);const frozen=await guess.locator('.remote-turn-screen .js-time').innerText();
      await delay(650);assert.equal(await guess.locator('.remote-turn-screen .js-time').innerText(),frozen);
      const still=await read(guess);assert.equal(still.turn.elapsedMs,paused.turn.elapsedMs);await hiddenReads(guess,guessIndex);
      assert.equal(photoRequests[guessIndex].filter(p=>p===path).length,0);
      await click(ref,'[data-action=resume]');await ref.locator('[data-action=question]:not([disabled])').waitFor({timeout:10000});
      await guess.waitForFunction(frozen=>document.querySelector('.remote-turn-screen .js-time')?.textContent!==frozen,frozen,{timeout:5000});
      assert.ok(elapsed(await read(ref))>=paused.turn.elapsedMs);checkedTimer=true;
    }
    if(turn===0){
      const before=await read(ref),sequence=Number(await ref.locator('#app').getAttribute('data-command-sequence')||0);
      await ref.locator('[data-do=menu]').first().click();await ref.locator('[data-select=referee]').selectOption(ids[otherIndex]);
      await ref.waitForFunction(sequence=>Number(document.querySelector('#app').dataset.commandSequence)>sequence&&!document.querySelector('#app').classList.contains('busy'),sequence,{timeout:35000});
      const handed=await read(other);assert.equal(handed.turn.refereeId,ids[otherIndex]);assert.equal(handed.turn.startedAt,before.turn.startedAt);assert.equal(handed.turn.remaining,before.turn.remaining);
      await ref.locator('.room-menu [data-do=menu]').click();activeRef=other;
      await activeRef.locator('[data-action=question]:not([disabled])').waitFor();
      await syncAll(handed);await remoteView(guess,10);await hiddenReads(guess,guessIndex);checkedHandoff=true;
    }
    await click(activeRef,'[data-action=question]');await syncAll(await read(activeRef));await remoteView(guess,9);
    await hiddenReads(guess,guessIndex);await flushAudit();
    assert.equal(photoRequests[guessIndex].filter(p=>p===path).length,0,'active remote guesser fetched the secret card photo');
    await click(activeRef,'[data-action=correct]');
    const result=await read(activeRef);assert.equal(result.turn.result.questionsUsed,1);assert.equal(result.turn.result.score,9);
    if(turn<2){
      await guess.locator('.turn-result').waitFor();assert.ok((await guess.locator('.turn-result').innerText()).includes(card.text));
      await loaded(guess,'.turn-result img');assert.equal(await guess.locator('.remote-turn-screen').count(),0);
      await click(activeRef,'[data-action=next]');
    }
  }
  assert.equal(guessers.size,3);assert.equal(seen.size,3);assert.ok(checkedTimer&&checkedHandoff&&checkedReload&&checkedGuesserAction);
  checks.push('all three distinct guessers use the remote view with counters, no forehead/fullscreen instructions, and contained portrait/landscape layouts');
  checks.push('active answers/photos stay absent from full snapshots, conditional polls, action responses, DOM and photo requests through countdown, pause, reload and role changes');
  checks.push('both other phones receive each unique non-own text/private photo after the real countdown');
  checks.push('remaining/used/total counters track question and undo; manual pause freezes server and visible time, then resume continues it');
  checks.push('the current referee hands off through the actual menu without resetting the turn, timer or question budget');
  checks.push('a remote guesser reload preserves identity and hidden-answer presentation');

  for(const page of pages){
    await page.locator('.scoreboard').waitFor();const final=await read(page);
    assert.equal(final.phase,'finished');assert.equal(final.completedCards.length,3);assert.ok(final.scores.every(player=>player.score===9&&player.completed===1));
    await page.locator('.deck-summary summary').click();assert.equal(await page.locator('.summary-card img').count(),3);
    for(const text of labels)assert.ok((await page.locator('.deck-summary').innerText()).includes(text));
    for(const image of await page.locator('.summary-card img').all()){await image.scrollIntoViewIfNeeded();await image.evaluate(img=>img.decode());assert.equal(await image.evaluate(img=>img.naturalWidth),900);}
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  }
  await pages[1].screenshot({path:fileURLToPath(new URL('remote-scoreboard.png',output)),fullPage:true});
  checks.push('answers reveal only after results; all three 10-question turns score 9 and completed private photos remain visible to the group');
  await click(pages[1],'[data-action=reset]');
  const replay=await read(pages[1]);assert.equal(replay.phase,'lobby');assert.equal(replay.generation,initial.generation+1);assert.deepEqual(replay.settings,initial.settings);
  await creator.locator('#lobby-remote-play').waitFor();assert.equal(await creator.locator('#lobby-remote-play').isChecked(),true);
  checks.push('shared replay starts no extra room and preserves enabled remote play and all configured rules');
  await flushAudit();assert.ok(audited.activeSnapshots>0&&audited.activeActionSnapshots>0);assert.deepEqual(errors,[]);
  const result={passed:true,base,players:3,rooms:1,turns:3,checks,errors,audited,hosted:Boolean(process.env.E2E_URL)};
  await writeFile(new URL('remote-results.json',output),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}catch(error){
  await writeFile(new URL('remote-results.json',output),JSON.stringify({passed:false,base,error:error.stack,checks,errors,audited,violations},null,2));
  for(let i=0;i<pages.length;i++)if(pages[i].url().startsWith(base))await pages[i].screenshot({path:fileURLToPath(new URL(`remote-failure-${i}.png`,output)),fullPage:true}).catch(()=>{});
  throw error;
}finally{await browser.close();if(server)await new Promise(resolve=>server.close(resolve));}
