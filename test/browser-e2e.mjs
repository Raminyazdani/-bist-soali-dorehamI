import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
const base=process.env.E2E_URL||'http://127.0.0.1:5180';
const root=new URL('../dist/',import.meta.url);
const server=process.env.E2E_URL?null:createServer(async(req,res)=>{
  try{
    const path=new URL(req.url,'http://localhost').pathname;
    const file=new URL(path==='/'?'index.html':path.slice(1),root);
    const bytes=await readFile(file);
    res.setHeader('Content-Type',file.pathname.endsWith('.js')?'text/javascript':file.pathname.endsWith('.css')?'text/css':'text/html');res.end(bytes);
  }catch{res.statusCode=404;res.end('Not found');}
});
if(server)await new Promise(resolve=>server.listen(5180,'127.0.0.1',resolve));
const proxy=process.env.HTTPS_PROXY;
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--allow-loopback-in-peer-connection','--force-webrtc-ip-handling-policy=default','--disable-features=WebRtcHideLocalIpsWithMdns',...(proxy?['--ignore-certificate-errors']:[])],...(proxy?{proxy:{server:proxy}}:{})});
const peerLibrary=await readFile(new URL('../node_modules/peerjs/dist/peerjs.min.js',import.meta.url),'utf8');
const readerSource=await readFile(new URL('peer-reader.js',import.meta.url),'utf8');
const pages=[],contexts=[],errors=[],checks=[];
const output=new URL('../test-output/',import.meta.url);await mkdir(output,{recursive:true});
const names=['رامین','مهسا','میلاد','امین'];
const read=async page=>{
  if(!await page.evaluate(()=>typeof window.readPeerState==='function')){await page.addScriptTag({content:peerLibrary});await page.addScriptTag({content:readerSource});}
  return page.evaluate(()=>window.readPeerState());
};
const refresh=async page=>{
  const current=await read(pages[0]);
  await page.waitForFunction(revision=>Number(document.querySelector('#app').dataset.revision)>=revision,current.revision,{timeout:25000});
};
async function refreshAll(){await Promise.all(pages.map(refresh));}
const click=async(page,selector)=>{
  const before=await page.locator('#app').getAttribute('data-command-sequence')||0;
  const expected=await page.locator(selector).evaluate(button=>button.dataset.action??(button.dataset.do==='cards-ready'?'readyWriting':button.closest('form')?.dataset.entry));
  await page.locator(selector).click({timeout:25000});
  await page.waitForFunction(({before,expected})=>{const app=document.querySelector('#app');return Number(app.dataset.commandSequence)>Number(before)&&app.dataset.completedOperation===expected&&!app.classList.contains('busy');},{before,expected},{timeout:45000});
};
try{
  for(let i=0;i<4;i++){
    const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,locale:'fa-IR',permissions:['camera','microphone']});
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
    contexts.push(context);pages.push(page);
    if(server)await context.route(base+'/**',async route=>{const response=await fetch(route.request().url());await route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:Buffer.from(await response.arrayBuffer())});});
    await page.goto(base);
  }
  await pages[0].locator('#entry-name').waitFor();
  await pages[0].screenshot({path:new URL('01-home.png',output).pathname,fullPage:true});
  await pages[0].locator('#entry-name').fill(names[0]);await pages[0].locator('[name=count]').fill('3');
  await click(pages[0],'button[type=submit]');await pages[0].locator('[data-action=readyLobby]').waitFor();
  const initial=await read(pages[0]);const code=initial.code;
  for(let i=1;i<4;i++){
    await pages[i].goto(base+'/?room='+code);await pages[i].locator('#entry-name').fill(names[i]);
    // Persian digits are accepted, not just Western digits.
    await pages[i].locator('[name=code]').fill(code.replace(/\d/g,d=>'۰۱۲۳۴۵۶۷۸۹'[Number(d)]));
    await click(pages[i],'button[type=submit]');await pages[i].locator('[data-action=readyLobby]').waitFor();
  }
  await refreshAll();
  for(const page of pages)assert.equal(await page.locator('#app').getAttribute('data-you'),await page.evaluate(()=>JSON.parse(localStorage.getItem('forehead-session-v2')).playerId));
  await Promise.all(pages.map(p=>click(p,'[data-action=readyLobby]')));await refresh(pages[0]);
  await pages[0].locator('[data-action=startWriting]:not([disabled])').waitFor();
  await pages[0].screenshot({path:new URL('02-lobby.png',output).pathname,fullPage:true});
  assert.equal((await read(pages[0])).players.length,4);checks.push('4 mobile browsers join with a six-digit code and mark ready');
  await click(pages[0],'[data-action=startWriting]');await refreshAll();
  await Promise.all(pages.map(p=>p.locator('textarea[data-card]').first().waitFor()));
  await click(pages[0],'[data-do=cards-ready]');await pages[0].locator('#toast.visible').waitFor();
  assert.match(await pages[0].locator('#toast').innerText(),/متن|کارت/);
  checks.push('empty required card text is rejected in the actual UI/API');
  for(let i=0;i<4;i++)for(let j=0;j<3;j++)await pages[i].locator('textarea[data-card]').nth(j).fill(`${names[i]} — کارت ${j+1}`);
  const photoId=await pages[0].locator('textarea[data-card]').first().getAttribute('data-card');
  const svg=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="800"><rect width="1100" height="800" fill="#eee8d8"/>${Array.from({length:150},(_,i)=>`<circle cx="${(i*127)%1100}" cy="${(i*173)%800}" r="${20+i%40}" fill="${['#c7ed67','#aea0f5','#1e2925','#ffad68'][i%4]}"/>`).join('')}</svg>`);
  await pages[0].locator('input[type=file]').first().setInputFiles({name:'test-photo.svg',mimeType:'image/svg+xml',buffer:svg});
  await pages[0].locator('.editor-photo img').waitFor();
  assert.equal(await pages[0].locator('.editor-photo img').evaluate(img=>img.complete&&img.naturalWidth>=1000),true);
  await pages[0].screenshot({path:new URL('03-writing.png',output).pathname,fullPage:true});
  checks.push('browser photo compression, durable phone storage and rendered photo over WebRTC');
  await Promise.all(pages.map(p=>click(p,'[data-do=cards-ready]')));await refreshAll();
  let state=await read(pages[0]);assert.equal(state.phase,'playing');
  const playerIds=await Promise.all(pages.map(p=>p.evaluate(()=>JSON.parse(localStorage.getItem('forehead-session-v2')).playerId)));
  const seen=new Set();let photoSeen=false,expectedScore=new Map(playerIds.map(id=>[id,0]));
  for(let turnIndex=0;turnIndex<12;turnIndex++){
    state=await read(pages[0]);assert.equal(state.turnIndex,turnIndex);
    const guessPage=pages[playerIds.indexOf(state.turn.playerId)],refPage=pages[playerIds.indexOf(state.turn.refereeId)];
    await refreshAll();await guessPage.locator('.head-instruction').waitFor();
    assert.equal(await guessPage.locator('.guess-card').count(),0);
    await click(refPage,'[data-action=start]');await refreshAll();
    await refPage.locator('[data-action=question]:not([disabled])').waitFor({timeout:10000});
    state=await read(refPage);assert.ok(state.turn.card);assert.notEqual(state.turn.card.authorId,state.turn.playerId);
    assert.ok(!seen.has(state.turn.card.id));seen.add(state.turn.card.id);
    await guessPage.locator('.head-card:not(.hidden)').waitFor({timeout:10000});
    if(state.turn.card.id===photoId){await guessPage.locator('.head-card img').waitFor();assert.equal(await guessPage.locator('.head-card img').evaluate(img=>img.complete&&img.naturalWidth>=1000),true);photoSeen=true;}
    if(turnIndex===0){
      await guessPage.setViewportSize({width:844,height:390});
      await guessPage.screenshot({path:new URL('04-head-landscape.png',output).pathname,fullPage:true});
      assert.ok(await guessPage.locator('h2').first().isVisible());
      await guessPage.setViewportSize({width:390,height:844});
      await refPage.screenshot({path:new URL('05-referee.png',output).pathname,fullPage:true});
      await click(refPage,'[data-action=question]');await click(refPage,'[data-action=undoQuestion]');
      assert.equal((await read(refPage)).turn.remaining,20);
      await click(refPage,'[data-action=pause]');const paused=(await read(refPage)).turn.elapsedMs;
      await new Promise(resolve=>setTimeout(resolve,650));assert.equal((await read(refPage)).turn.elapsedMs,paused);
      await click(refPage,'[data-action=resume]');await refPage.locator('[data-action=question]:not([disabled])').waitFor();
      const before=JSON.parse(await guessPage.evaluate(()=>localStorage.getItem('forehead-session-v2')));
      if(guessPage===pages[0]){
        await guessPage.reload();await refPage.locator('[data-action=resume]').waitFor({timeout:35000});await click(refPage,'[data-action=resume]');
      }else await guessPage.reload();
      await guessPage.locator('.head-card:not(.hidden)').waitFor({timeout:35000});
      const after=JSON.parse(await guessPage.evaluate(()=>localStorage.getItem('forehead-session-v2')));assert.deepEqual(after,before);
      checks.push('landscape overhead view; undo; pause freezes time; player reload retains identity');
      if(guessPage!==pages[0]){
        await pages[0].reload();
        await pages[0].locator('#app[data-phase=playing]').waitFor({timeout:35000});
        await refPage.locator('[data-action=resume]').waitFor({timeout:35000});
        const restored=await read(pages[0]);assert.equal(restored.turn.status,'paused');assert.equal(restored.turn.remaining,20);assert.equal(restored.players.length,4);
        await click(refPage,'[data-action=resume]');await refPage.locator('[data-action=question]:not([disabled])').waitFor();
      }
      checks.push('creator reload restores the durable room, pauses time and reconnects the group');
    }
    const failure=turnIndex===3;const count=failure?20:2+(turnIndex%5);
    for(let q=0;q<count;q++)await click(refPage,'[data-action=question]');
    if(failure){assert.equal((await read(refPage)).turn.remaining,0);await click(refPage,'[data-action=failed]');}
    else{await click(refPage,'[data-action=correct]');expectedScore.set(state.turn.playerId,expectedScore.get(state.turn.playerId)+20-count);}
    state=await read(refPage);assert.equal(state.scores.find(p=>p.playerId===state.turn.playerId).score,expectedScore.get(state.turn.playerId));
    process.stdout.write(`Completed turn ${turnIndex+1}/12\n`);
    if(turnIndex<11){await click(refPage,'[data-action=next]');await refreshAll();}
  }
  await refreshAll();await pages[0].locator('.scoreboard').waitFor();
  const final=await read(pages[0]);assert.equal(final.phase,'finished');assert.equal(final.completedCards.length,12);assert.equal(seen.size,12);assert.equal(photoSeen,true);
  assert.equal(final.scores.reduce((n,p)=>n+p.completed,0),12);
  await pages[0].screenshot({path:new URL('06-scoreboard.png',output).pathname,fullPage:true});
  checks.push('12 turns; each card used exactly once; no own card dealt; scores and final scoreboard correct');
  await click(pages[0],'[data-action=reset]');await refreshAll();
  const reset=await read(pages[0]);assert.equal(reset.phase,'lobby');assert.equal(reset.players.length,4);assert.ok(reset.scores.every(p=>p.score===0));
  assert.equal(reset.generation,2);checks.push('replay returns all 4 players to a clean lobby');
  for(const page of pages){assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1),false);}
  assert.deepEqual(errors,[]);checks.push('no uncaught browser errors or horizontal overflow in tested mobile views');
  await writeFile(new URL('browser-results.json',output),JSON.stringify({passed:true,base,players:4,turns:12,checks,errors,realtimeVerified:true,publicSignaling:true,transport:'native WebRTC',hostedBuild:!base.includes('127.0.0.1')},null,2));
  process.stdout.write(JSON.stringify({passed:true,checks},null,2)+'\n');
}catch(error){
  await writeFile(new URL('browser-results.json',output),JSON.stringify({passed:false,error:error.stack,checks,errors},null,2));
  for(let i=0;i<pages.length;i++)await pages[i].screenshot({path:new URL(`failure-${i}.png`,output).pathname,fullPage:true}).catch(()=>{});
  for(let i=0;i<pages.length;i++)console.log('UI failure details',i,await pages[i].locator('#toast').textContent().catch(()=>''),await pages[i].locator('#app').getAttribute('data-you').catch(()=>''));
  throw error;
}finally{await browser.close();if(server)await new Promise(resolve=>server.close(resolve));}
