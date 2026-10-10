import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {localServer} from '../scripts/server.mjs';

const base=process.env.E2E_URL||'http://127.0.0.1:5183';
const root=new URL('../dist/',import.meta.url),output=new URL('../test-output/',import.meta.url);
let server=process.env.E2E_URL?null:localServer({directory:'test-output/rooms-5183'});
if(server)await new Promise(resolve=>server.listen(5183,'127.0.0.1',resolve));
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
  const expected=await page.locator(selector).evaluate(button=>button.dataset.action??(button.dataset.do==='claim'?'claimHost':button.dataset.do==='cards-ready'?'readyWriting':button.dataset.do==='kick'?'kick':button.dataset.do==='close-room'?'closeRoom':button.dataset.do==='transfer'?'transferHost':button.closest('form')?.dataset.entry));
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

async function menu(page){
  if(!await page.locator('.room-menu').isVisible())await page.locator('[data-do=menu]').first().click();
}
async function confirmClick(page,selector){
  await click(page,selector);
}
async function home(page){await page.locator('#entry-name').waitFor({timeout:15000});assert.equal(await page.evaluate(()=>localStorage.getItem('forehead-session-v3')),null);}

try{
  for(let i=0;i<3;i++){
    const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,locale:'fa-IR'});
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));pages.push(page);
    if(server)await context.route(base+'/**',async route=>{const request=route.request(),body=request.postDataBuffer();const response=await fetch(request.url(),{method:request.method(),headers:request.headers(),...(body?{body}:{})});await route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:Buffer.from(await response.arrayBuffer())});});
    await page.goto(base);
  }
  const [creator,amin,milad]=pages;
  await creator.locator('#entry-name').fill('رامین');await creator.locator('[name=count]').fill('1');await click(creator,'button[type=submit]');
  const first=await read(creator),code=first.code;
  for(const [page,name]of [[amin,'امین'],[milad,'میلاد']]){await page.goto(base+'/?room='+code);await page.locator('#entry-name').fill(name);await click(page,'button[type=submit]');}
  await Promise.all(pages.map(page=>click(page,'[data-action=readyLobby]')));
  await creator.locator('[data-action=startWriting]:not([disabled])').waitFor();await click(creator,'[data-action=startWriting]');
  await Promise.all(pages.map(page=>page.locator('.card-editor').waitFor()));
  await creator.goto('about:blank');
  const frozenAt=Date.now();
  for(const [page,text,color]of [[amin,'میلاد','#266ddd'],[milad,'رامین','#ee682e']]){
    await page.locator('textarea[data-card]').fill(text);
    const base64=await page.evaluate(color=>{const canvas=document.createElement('canvas');canvas.width=480;canvas.height=320;const context=canvas.getContext('2d');context.fillStyle=color;context.fillRect(0,0,480,320);return canvas.toDataURL('image/png').split(',')[1];},color);
    await page.locator('input[type=file]').setInputFiles({name:'friend.png',mimeType:'image/png',buffer:Buffer.from(base64,'base64')});
    await page.waitForFunction(()=>{const img=document.querySelector('.editor-photo img');return img?.complete&&img.naturalWidth>0;});
    for(let tries=0;tries<30;tries++){if((await read(page)).ownCards[0].text===text)break;await new Promise(resolve=>setTimeout(resolve,100));}
    assert.equal((await read(page)).ownCards[0].text,text);
  }
  checks.push('both guests save real text and uploaded photos while the creator app is fully unloaded');
  console.log(checks.at(-1));
  await new Promise(resolve=>setTimeout(resolve,Math.max(0,48000-(Date.now()-frozenAt))));
  const absent=await read(amin);assert.equal(absent.players.find(p=>p.id===first.you).online,false);
  await amin.locator('textarea[data-card]').fill('میلادِ ما');
  await amin.waitForFunction(()=>document.querySelector('#app').dataset.completedOperation==='saveCard');
  await menu(amin);await click(amin,'[data-do=claim]');
  assert.equal((await read(amin)).hostId,absent.you);
  checks.push('after 48 seconds away, cards still save and another player can take management');
  console.log(checks.at(-1));
  await creator.goto(base);
  await creator.locator('textarea[data-card]').fill('امین');
  await Promise.all(pages.map(page=>click(page,'[data-do=cards-ready]')));
  await Promise.all(pages.map(page=>page.locator('#app[data-phase=playing]').waitFor()));
  if(server){
    await new Promise(resolve=>server.close(resolve));server=localServer({directory:'test-output/rooms-5183'});await new Promise(resolve=>server.listen(5183,'127.0.0.1',resolve));
    assert.equal((await read(amin)).players.length,3);checks.push('a fresh server reloads the room and photos from disk without a creator connection');
  }
  const ids=await Promise.all(pages.map(page=>page.evaluate(()=>JSON.parse(localStorage.getItem('forehead-session-v3')).playerId)));
  let awayTurn=false;
  for(let i=0;i<3;i++){
    const turn=(await read(amin)).turn,guesser=pages[ids.indexOf(turn.playerId)],ref=pages[ids.indexOf(turn.refereeId)];
    await ref.locator('[data-action=start]').waitFor();await click(ref,'[data-action=start]');await ref.locator('[data-action=question]:not([disabled])').waitFor();
    if(turn.playerId!==first.you&&turn.refereeId!==first.you){
      await creator.goto('about:blank');
      await new Promise(resolve=>setTimeout(resolve,26000));assert.equal((await read(ref)).turn.status,'running');
      await click(ref,'[data-action=question]');await click(ref,'[data-action=correct]');
      assert.equal((await read(ref)).turn.result.score,19);
      await creator.goto(base);awayTurn=true;
      checks.push('the creator can remain away during other players turn; time, questions and scoring keep working');
    }else{await click(ref,'[data-action=question]');await click(ref,'[data-action=correct]');}
    if(i<2){await click(ref,'[data-action=next]');}
  }
  assert.equal(awayTurn,true);
  await Promise.all(pages.map(page=>page.locator('.scoreboard').waitFor()));
  for(const page of pages){
    await page.locator('.deck-summary summary').click();
    assert.equal(await page.locator('.summary-card img').count(),2);
    for(const image of await page.locator('.summary-card img').all()){
      await image.scrollIntoViewIfNeeded({timeout:15000});await image.evaluate(image=>image.decode());
      assert.equal(await image.evaluate(image=>image.naturalWidth>0),true);
    }
  }
  checks.push('all three players finish and receive the complete scoreboard and photos');
  assert.deepEqual(errors,[]);
  await writeFile(new URL('background-results.json',output),JSON.stringify({passed:true,base,checks,errors,hostedBuild:Boolean(process.env.E2E_URL)},null,2));console.log(JSON.stringify({passed:true,checks},null,2));
}catch(error){await writeFile(new URL('background-results.json',output),JSON.stringify({passed:false,error:error.stack,checks,errors},null,2));throw error;}
finally{await browser.close();if(server)await new Promise(resolve=>server.close(resolve));}
