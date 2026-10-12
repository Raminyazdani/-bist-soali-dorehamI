// Actual mobile-browser regression for configurable rules, drafts, URL photos
// and a running turn whose referee switches to another app.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {localServer} from '../scripts/server.mjs';

const base=process.env.E2E_URL||'http://127.0.0.1:5184';
const imageUrl=process.env.E2E_IMAGE_URL||'https://www.gstatic.com/webp/gallery/1.webp';
const output=new URL('../test-output/',import.meta.url);
const server=process.env.E2E_URL?null:localServer({directory:'test-output/rooms-5184'});
if(server)await new Promise(resolve=>server.listen(5184,'127.0.0.1',resolve));
const proxy=process.env.HTTPS_PROXY;
const browser=await chromium.launch({headless:true,args:['--no-sandbox',...(proxy?['--ignore-certificate-errors']:[])],...(proxy?{proxy:{server:proxy}}:{})});
const readerSource=await readFile(new URL('api-reader.js',import.meta.url),'utf8');
const pages=[],contexts=[],errors=[],checks=[];
const elapsed=s=>s.turn.elapsedMs+(s.turn.status==='running'&&s.turn.startedAt?Math.max(0,s.serverNow-s.turn.startedAt):0);
await mkdir(output,{recursive:true});
async function read(page){
  if(!await page.evaluate(()=>typeof window.readGameState==='function'))await page.addScriptTag({content:readerSource});
  return page.evaluate(()=>window.readGameState());
}
async function click(page,selector){
  const before=Number(await page.locator('#app').getAttribute('data-command-sequence')||0);
  const action=await page.locator(selector).evaluate(button=>button.dataset.action);
  await page.locator(selector).click();
  if(['correct','failed','reset'].includes(action))await page.locator('[data-confirm=accept]').click();
  await page.waitForFunction(before=>Number(document.querySelector('#app').dataset.commandSequence)>before&&!document.querySelector('#app').classList.contains('busy'),before,{timeout:35000});
}
async function saved(page,text){
  for(let i=0;i<60;i++){if((await read(page)).ownCards?.[0]?.text===text)return;await new Promise(resolve=>setTimeout(resolve,150));}
  assert.equal((await read(page)).ownCards[0].text,text);
}
try{
  for(let i=0;i<3;i++){
    const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,locale:'fa-IR'});
    if(server)await context.route(base+'/**',async route=>{
      const request=route.request(),body=request.postDataBuffer();
      const response=await fetch(request.url(),{method:request.method(),headers:request.headers(),...(body?{body}:{})});
      await route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:Buffer.from(await response.arrayBuffer())});
    });
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
    contexts.push(context);pages.push(page);await page.goto(base);
  }
  const [creator,guest,third]=pages;
  await creator.locator('#entry-name').fill('سازنده');await creator.locator('[name=count]').fill('1');
  await creator.locator('[name=questions]').selectOption('10');
  assert.equal(await creator.locator('[name=autoPause]').isChecked(),false);
  assert.equal(await creator.locator('[name=sharedControls]').isChecked(),true);
  await click(creator,'button[type=submit]');
  const first=await read(creator);assert.deepEqual(first.settings,{questions:10,autoPause:false,sharedControls:true});
  for(const [page,name]of[[guest,'دوست یک'],[third,'دوست دو']]){
    await page.goto(base+'/?room='+first.code);await page.locator('#entry-name').fill(name);await click(page,'button[type=submit]');
  }
  await Promise.all(pages.map(page=>click(page,'[data-action=readyLobby]')));
  await creator.locator('[name=questions]').selectOption('30');await click(creator,'[data-do=set-count]');
  let current=await read(guest);assert.equal(current.settings.questions,30);assert.ok(current.players.every(p=>!p.ready));
  await creator.locator('[name=questions]').selectOption('10');await click(creator,'[data-do=set-count]');
  const configured=await read(creator);
  await Promise.all(pages.map(page=>page.waitForFunction(revision=>Number(document.querySelector('#app').dataset.revision)>=revision,configured.revision)));
  await Promise.all(pages.map(page=>click(page,'[data-action=readyLobby]')));
  await creator.goto('about:blank');
  await guest.locator('[data-action=startWriting]:not([disabled])').waitFor();await click(guest,'[data-action=startWriting]');
  assert.equal((await read(guest)).phase,'writing');
  checks.push('10/30 question settings persist, clear readiness, and a guest starts the ready group without the creator');

  // API outage preserves text locally while reload still has access to assets.
  const guestId=(await read(guest)).you;
  await contexts[1].route(base+'/api/game',route=>{
    const data=route.request().postDataJSON();
    if(data?.type==='action'&&data.action==='saveCard')return route.abort('internetdisconnected');
    return route.continue();
  });
  // Simulate the browser storage of the currently released client during an
  // upgrade: same participant session, legacy pending text, no new cache yet.
  const upgrading=await read(guest);
  await guest.addInitScript(s=>{
    // Seed before the new app's first bind. A running new client otherwise
    // legitimately recreates its used marker on visibility/pagehide events.
    const fixture=`forehead-legacy-fixture-${s.id}-${s.you}`;
    if(localStorage.getItem(fixture)==='ready')return;
    localStorage.setItem(fixture,'ready');
    const prefix=`forehead-text-v1-${s.id}-${s.you}-${s.generation}`;
    for(const key of Object.keys(localStorage))if(key===prefix||key.startsWith(prefix+'-'))localStorage.removeItem(key);
    localStorage.setItem(`forehead-drafts-${s.id}-${s.generation}`,JSON.stringify({[s.ownCards[0].id]:'پیش‌نویس نسخهٔ قبلی',foreign:'متن عضو دیگر'}));
  },upgrading);
  await guest.reload();await guest.locator('textarea[data-card]').waitFor();
  assert.equal(await guest.locator('textarea[data-card]').inputValue(),'پیش‌نویس نسخهٔ قبلی');
  const migrated=await guest.evaluate(s=>JSON.parse(localStorage.getItem(`forehead-text-v1-${s.id}-${s.you}-${s.generation}`)),upgrading);
  assert.deepEqual(migrated,{[upgrading.ownCards[0].id]:'پیش‌نویس نسخهٔ قبلی'});
  checks.push('upgrading the previous client recovers only this author’s pending text, without copying a foreign card');
  await guest.locator('textarea[data-card]').fill('پیش‌نویس بدون اتصال');
  await guest.waitForFunction(()=>[...document.querySelectorAll('[data-draft-status]')].some(el=>el.textContent.includes('گوشی')||el.textContent.includes('اتصال')));
  await guest.reload();await guest.locator('textarea[data-card]').waitFor();
  assert.equal(await guest.locator('textarea[data-card]').inputValue(),'پیش‌نویس بدون اتصال');
  assert.equal((await read(guest)).you,guestId);
  await contexts[1].unroute(base+'/api/game');
  await guest.evaluate(()=>window.dispatchEvent(new Event('online')));
  await saved(guest,'پیش‌نویس بدون اتصال');
  checks.push('unsaved text survives an API outage and reload, then drains to the server with the same participant');

  const guestCard=(await read(guest)).ownCards[0].id;
  await guest.locator(`[data-image-url="${guestCard}"]`).fill('https://127.0.0.1/private.png');
  await guest.locator(`[data-do=image-url][data-card-id="${guestCard}"]`).click();
  await guest.locator('#toast.visible.error').waitFor();
  assert.equal((await read(guest)).ownCards[0].imageUrl,null);
  await guest.locator(`[data-image-url="${guestCard}"]`).fill(imageUrl);
  await guest.locator(`[data-do=image-url][data-card-id="${guestCard}"]`).click();
  await guest.waitForFunction(()=>{const img=document.querySelector('.editor-photo img');return img?.complete&&img.naturalWidth>0;},{},{timeout:35000});
  const imported=(await read(guest)).ownCards[0].imageUrl;
  assert.ok(imported.startsWith('/api/photo?'));assert.ok(!imported.includes('gstatic'));
  await guest.reload();await guest.locator('.editor-photo img').waitFor();
  await guest.waitForFunction(()=>document.querySelector('.editor-photo img')?.naturalWidth>0);
  checks.push('a private URL is blocked; a real public HTTPS raster is fetched once, compressed, stored privately and survives reload');
  await guest.screenshot({path:fileURLToPath(new URL('features-writing.png',output)),fullPage:true});
  // An update notice may appear, but a writing session must stay intact.
  let versionReads=0;
  await contexts[1].route(base+'/version.json',async route=>{versionReads++;await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({version:'test-new-release'})});});
  await new Promise(resolve=>setTimeout(resolve,5200));
  await guest.evaluate(()=>window.dispatchEvent(new Event('pageshow')));
  await guest.locator('#version-notice').waitFor();
  assert.ok(versionReads>0);assert.equal(await guest.locator('[data-do=refresh-version]').isDisabled(),true);
  assert.equal((await read(guest)).phase,'writing');

  await creator.goto(base);await creator.locator('textarea[data-card]').fill('کارت سازنده');
  await third.locator('textarea[data-card]').fill('کارت دوست دو');
  await Promise.all(pages.map(page=>click(page,'[data-do=cards-ready]')));
  await Promise.all(pages.map(page=>page.locator('#app[data-phase=playing]').waitFor()));
  assert.equal(await guest.locator('#version-notice').count(),0);
  const ids=await Promise.all(pages.map(page=>page.evaluate(()=>JSON.parse(localStorage.getItem('forehead-session-v3')).playerId)));
  let importedShown=false,awayVerified=false;
  for(let i=0;i<3;i++){
    let state=await read(pages[0]);
    const guessIndex=ids.indexOf(state.turn.playerId),refIndex=ids.indexOf(state.turn.refereeId),otherIndex=[0,1,2].find(n=>n!==guessIndex&&n!==refIndex);
    const guess=pages[guessIndex],ref=pages[refIndex],other=pages[otherIndex];
    assert.equal(state.turn.remaining,10);
    await ref.locator('[data-action=start]').waitFor();await click(ref,'[data-action=start]');
    await other.locator('.js-time').first().waitFor();await ref.locator('[data-action=question]:not([disabled])').waitFor();
    let activeRef=ref;
    if(ref===creator){
      assert.notEqual(other,creator);
      const before=await read(other);await ref.goto('about:blank');
      await new Promise(resolve=>setTimeout(resolve,22500));
      const away=await read(other);assert.equal(away.turn.status,'running');assert.equal(away.turn.refereeOnline,false);
      assert.ok(elapsed(away)>=elapsed(before)+20000);
      await other.locator('[data-action=claimReferee]').waitFor({timeout:12000});await click(other,'[data-action=claimReferee]');
      assert.equal((await read(other)).turn.refereeId,ids[otherIndex]);
      activeRef=other;await ref.goto(base);
      await ref.locator('#app[data-phase=playing]').waitFor();
      awayVerified=true;
      checks.push('the creator/manager acting as referee fully leaves for over20s; time continues and a nonguesser guest claims refereeing');
    }
    state=await read(activeRef);
    if(state.turn.card?.id===guestCard){
      await guess.waitForFunction(()=>document.querySelector('.head-card img')?.naturalWidth>0,{},{timeout:15000});importedShown=true;
    }
    await activeRef.locator('[data-action=question]:not([disabled])').waitFor();await click(activeRef,'[data-action=question]');await click(activeRef,'[data-action=correct]');
    const ended=await read(activeRef);assert.equal(ended.turn.result.questionsUsed,1);assert.equal(ended.turn.result.score,9);
    if(i<2){const next=pages.find(p=>p!==activeRef&&p!==creator)??pages.find(p=>p!==activeRef);await next.locator('[data-action=next]').waitFor();await click(next,'[data-action=next]');}
  }
  assert.equal(importedShown,true);assert.equal(awayVerified,true);await guest.locator('.scoreboard').waitFor();
  const final=await read(guest);assert.equal(final.phase,'finished');assert.ok(final.scores.every(p=>p.score===9));
  checks.push('configured10-question turns score9 after one question; imported photo reaches its recipient and shared members advance all turns');
  await guest.locator('.deck-summary summary').click();
  await guest.locator('.summary-card img').scrollIntoViewIfNeeded();
  await guest.waitForFunction(()=>{const img=document.querySelector('.summary-card img');return img?.complete&&img.naturalWidth>0;},{},{timeout:15000});
  await guest.locator('.summary-card img').evaluate(img=>img.decode());
  await guest.screenshot({path:fileURLToPath(new URL('features-scoreboard.png',output)),fullPage:true});
  await click(guest,'[data-action=reset]');
  const fresh=await read(guest);assert.equal(fresh.generation,first.generation+1);assert.equal(fresh.phase,'lobby');assert.deepEqual(fresh.settings,first.settings);
  checks.push('a guest starts a clean replay while configured rules remain');
  await guest.locator('[data-do=refresh-version]:not([disabled])').waitFor();
  const identity=await guest.evaluate(()=>JSON.parse(localStorage.getItem('forehead-session-v3')));
  await contexts[1].unroute(base+'/version.json');
  await Promise.all([guest.waitForEvent('load'),guest.locator('[data-do=refresh-version]').click()]);
  await guest.locator('#app[data-phase=lobby]').waitFor();
  assert.deepEqual(await guest.evaluate(()=>JSON.parse(localStorage.getItem('forehead-session-v3'))),identity);
  checks.push('version detection keeps writing/play intact; explicit idle update reload retains room and participant identity');
  assert.deepEqual(errors,[]);
  const result={passed:true,base,players:3,turns:3,checks,errors,hosted:Boolean(process.env.E2E_URL)};
  await writeFile(new URL('features-results.json',output),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}catch(error){
  await writeFile(new URL('features-results.json',output),JSON.stringify({passed:false,base,error:error.stack,checks,errors},null,2));
  for(let i=0;i<pages.length;i++)if(pages[i].url().startsWith(base))await pages[i].screenshot({path:fileURLToPath(new URL(`features-failure-${i}.png`,output)),fullPage:true}).catch(()=>{});
  throw error;
}finally{await browser.close();if(server)await new Promise(resolve=>server.close(resolve));}
