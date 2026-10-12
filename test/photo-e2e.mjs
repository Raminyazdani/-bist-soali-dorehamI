import {fileURLToPath} from 'node:url';
// Regression: a native photo picker can outlive a lobby render on mobile.
// Both phones must receive the other author's photo over actual HTTP backend.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {localServer} from '../scripts/server.mjs';
import {BlobStore} from '../lib/blob-store.mjs';
import {fileBlob} from '../scripts/file-blob.mjs';
import {photoLink} from '../lib/security.mjs';

const base=process.env.E2E_URL||'http://127.0.0.1:5181';
const output=new URL('../test-output/',import.meta.url);
const server=process.env.E2E_URL?null:localServer({directory:'test-output/rooms-5181'});
if(server)await new Promise(resolve=>server.listen(5181,'127.0.0.1',resolve));
const proxy=process.env.HTTPS_PROXY;
const browser=await chromium.launch({headless:true,args:['--no-sandbox',...(proxy?['--ignore-certificate-errors']:[])],...(proxy?{proxy:{server:proxy}}:{})});
const readerSource=await readFile(new URL('api-reader.js',import.meta.url),'utf8');
const pages=[],errors=[],checks=[];await mkdir(output,{recursive:true});
async function read(page){
  if(!await page.evaluate(()=>typeof window.readGameState==='function')){
    await page.addScriptTag({content:readerSource});
  }
  return page.evaluate(()=>window.readGameState());
}
async function click(page,selector){
  const before=await page.locator('#app').getAttribute('data-command-sequence')||0;
  const expected=await page.locator(selector).evaluate(button=>button.dataset.action??(button.dataset.do==='cards-ready'?'readyWriting':button.closest('form')?.dataset.entry));
  await page.locator(selector).click();
  if(['correct','failed','reset','kick','closeRoom'].includes(expected))await page.locator('[data-confirm=accept]').click();
  await page.waitForFunction(({before,expected})=>{
    const app=document.querySelector('#app');return Number(app.dataset.commandSequence)>Number(before)&&!app.classList.contains('busy');
  },{before,expected},{timeout:30000});
}
async function photoLoaded(page,selector){
  await page.locator(selector).first().waitFor({timeout:15000});
  await page.waitForFunction(selector=>{
    const img=document.querySelector(selector);return img?.complete&&img.naturalWidth===900;
  },selector,{timeout:15000});
}
try{
  for(let i=0;i<2;i++){
    const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,locale:'fa-IR',permissions:['camera','microphone']});
    if(server)await context.route(base+'/**',async route=>{
      const request=route.request(),body=request.postDataBuffer();const response=await fetch(request.url(),{method:request.method(),headers:request.headers(),...(body?{body}:{})});await route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:Buffer.from(await response.arrayBuffer())});
    });
    const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));pages.push(page);await page.goto(base);
  }
  await pages[0].locator('#entry-name').fill('رامین');await pages[0].locator('[name=count]').fill('1');await click(pages[0],'button[type=submit]');
  const code=(await read(pages[0])).code;
  await pages[1].goto(base+'/?room='+code);await pages[1].locator('#entry-name').fill('امین');await click(pages[1],'button[type=submit]');
  await Promise.all(pages.map(page=>click(page,'[data-action=readyLobby]')));
  await pages[0].locator('[data-action=startWriting]:not([disabled])').waitFor();await click(pages[0],'[data-action=startWriting]');
  const cardIds=[];
  for(let i=0;i<2;i++){
    const page=pages[i];await page.locator('textarea[data-card]').fill(i===0?'میلاد':'رامین');
    cardIds.push(await page.locator('textarea[data-card]').getAttribute('data-card'));
    const [chooser]=await Promise.all([page.waitForEvent('filechooser',{timeout:15000}),page.locator('.photo-button').click()]);
    // An actual authenticated background save replaces the input while the
    // native picker is open, even when unchanged heartbeat renders are skipped.
    await page.evaluate(async cardId=>{const c=JSON.parse(localStorage.getItem('forehead-session-v3'));await fetch('/api/game',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'action',...c,action:'saveCard',data:{cardId,text:document.querySelector('textarea[data-card]').value},requestId:crypto.randomUUID()})});},cardIds[i]);
    await page.waitForFunction(input=>!input.isConnected,chooser.element(),{timeout:15000});
    const buffer=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="900" height="600"><rect width="900" height="600" fill="${i===0?'#bdeb72':'#a999ed'}"/><circle cx="450" cy="300" r="210" fill="#20302a"/></svg>`);
    await chooser.setFiles({name:'milad-photo.svg',mimeType:'image/svg+xml',buffer});
    await photoLoaded(page,'.editor-photo img');
    checks.push(`${i===0?'creator':'guest'} photo selection survives autosave/heartbeat while native picker is open`);
    if(server&&i===0){
      const credentials=await page.evaluate(()=>JSON.parse(localStorage.getItem('forehead-session-v3')));
      const row=await new BlobStore({sdk:fileBlob('test-output/rooms-5181')}).get(credentials.roomId);
      const path=row.state.cards.find(card=>card.authorId===credentials.playerId).imagePath;
      const nearExpiry=photoLink(row.state,credentials.playerId,path,Date.now()-540000);
      await page.evaluate(src=>{window.photoEditorBefore=document.querySelector('textarea');document.querySelector('.editor-photo img').setAttribute('src',src);},nearExpiry);
      await page.waitForFunction(src=>document.querySelector('.editor-photo img')?.getAttribute('src')!==src,nearExpiry,{timeout:15000});
      await photoLoaded(page,'.editor-photo img');
      assert.equal(await page.evaluate(()=>window.photoEditorBefore===document.querySelector('textarea')),true);
      checks.push('an expiring photo link renews during unchanged-state polling without replacing the editor');
    }
    await page.screenshot({path:fileURLToPath(new URL(`photo-author-${i}.png`,output)),fullPage:true});
  }
  await Promise.all(pages.map(page=>click(page,'[data-do=cards-ready]')));
  const playerIds=await Promise.all(pages.map(page=>page.evaluate(()=>JSON.parse(localStorage.getItem('forehead-session-v3')).playerId)));
  for(let turn=0;turn<2;turn++){
    const state=await read(pages[0]),guesser=pages[playerIds.indexOf(state.turn.playerId)],referee=pages[playerIds.indexOf(state.turn.refereeId)];
    await guesser.locator('.head-instruction').waitFor();await click(referee,'[data-action=start]');
    await guesser.locator('.head-card:not(.hidden)').waitFor({timeout:15000});
    await photoLoaded(guesser,'.head-card img');await photoLoaded(referee,'.card-stage img');
    const current=await read(referee);
    assert.equal(current.phase,'playing',JSON.stringify({phase:current.phase,id:current.id,uiPhase:await referee.locator('#app').getAttribute('data-phase')}));
    assert.notEqual(current.turn.card.authorId,current.turn.playerId);
    assert.equal(current.turn.card.id,cardIds[1-playerIds.indexOf(state.turn.playerId)]);
    await guesser.setViewportSize({width:844,height:390});
    assert.equal(await guesser.locator('.head-card img').isVisible(),true);
    await guesser.screenshot({path:fileURLToPath(new URL(`photo-recipient-${turn}.png`,output)),fullPage:true});
    if(guesser===pages[1]){
      await guesser.reload();await guesser.locator('#app[data-phase=playing]').waitFor({timeout:35000});
      if((await read(referee)).turn.status==='paused')await click(referee,'[data-action=resume]');
      await photoLoaded(guesser,'.head-card img');checks.push('recipient reload retrieves the current photo again');
    }
    checks.push(`turn ${turn+1}: other author's photo rendered on recipient and referee, including landscape view`);
    await referee.locator('[data-action=question]:not([disabled])').waitFor();await click(referee,'[data-action=question]');await click(referee,'[data-action=correct]');
    if(turn===0)await click(referee,'[data-action=next]');
  }
  await pages[0].locator('.scoreboard').waitFor();
  for(const page of pages){
    await page.locator('.deck-summary summary').click();
    assert.equal(await page.locator('.summary-card img').count(),2);
    await photoLoaded(page,'.summary-card img');
    for(const img of await page.locator('.summary-card img').all()){
      await img.scrollIntoViewIfNeeded();await img.evaluate(img=>img.decode());
      assert.equal(await img.evaluate(img=>img.naturalWidth),900);
    }
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  }
  checks.push('both photos remain on completed cards and scoreboard for both players');assert.deepEqual(errors,[]);
  const result={passed:true,base,players:2,turns:2,checks,errors,realtimeVerified:true,hostedBuild:Boolean(process.env.E2E_URL)};
  await writeFile(new URL('photo-results.json',output),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}catch(error){
  await writeFile(new URL('photo-results.json',output),JSON.stringify({passed:false,base,error:error.stack,checks,errors},null,2));
  for(let i=0;i<pages.length;i++)await pages[i].screenshot({path:fileURLToPath(new URL(`photo-failure-${i}.png`,output)),fullPage:true}).catch(()=>{});
  throw error;
}finally{await browser.close();if(server)await new Promise(resolve=>server.close(resolve));}
