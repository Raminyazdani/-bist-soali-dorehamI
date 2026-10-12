import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {localServer} from '../scripts/server.mjs';

const base=process.env.E2E_URL||'http://127.0.0.1:5182';
const output=new URL('../test-output/',import.meta.url);
const server=process.env.E2E_URL?null:localServer({directory:'test-output/rooms-5182'});
if(server)await new Promise(resolve=>server.listen(5182,'127.0.0.1',resolve));
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
  const expected=await page.locator(selector).evaluate(button=>button.dataset.action??(button.dataset.do==='cards-ready'?'readyWriting':button.dataset.do==='kick'?'kick':button.dataset.do==='close-room'?'closeRoom':button.dataset.do==='transfer'?'transferHost':button.closest('form')?.dataset.entry));
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
    const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,locale:'fa-IR',permissions:['camera','microphone']});
    if(server)await context.route(base+'/**',async route=>{
      const request=route.request(),body=request.postDataBuffer();const response=await fetch(request.url(),{method:request.method(),headers:request.headers(),...(body?{body}:{})});await route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:Buffer.from(await response.arrayBuffer())});
    });
    const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));pages.push(page);await page.goto(base);
  }
  const [creator,amin,milad]=pages;
  await creator.locator('#entry-name').fill('رامین');await creator.locator('[name=count]').fill('1');await click(creator,'button[type=submit]');
  const first=await read(creator),code=first.code;
  for(const [page,name] of [[amin,'امین'],[milad,'میلاد']]){
    await page.goto(base+'/?room='+code);await page.locator('#entry-name').fill(name);await click(page,'button[type=submit]');
  }
  const ids=await Promise.all(pages.map(page=>page.evaluate(()=>JSON.parse(localStorage.getItem('forehead-session-v3')).playerId)));
  await menu(amin);assert.equal(await amin.locator('[data-do=close-room]').count(),0);await amin.locator('[data-do=menu]').last().click();
  await menu(creator);await creator.locator('#kick-target').selectOption(ids[1]);
  await creator.locator('[data-do=kick]').click();await creator.getByRole('alertdialog').waitFor();
  await creator.locator('[data-confirm=cancel]').click();assert.equal((await read(creator)).players.length,3);
  await confirmClick(creator,'[data-do=kick]');
  await home(amin);assert.equal((await read(creator)).players.length,2);
  checks.push('manager kicks a lobby guest and the guest returns home immediately');
  await amin.goto(base+'/?room='+code);await amin.locator('#entry-name').fill('امین');await click(amin,'button[type=submit]');
  ids[1]=await amin.evaluate(()=>JSON.parse(localStorage.getItem('forehead-session-v3')).playerId);
  await Promise.all(pages.map(page=>click(page,'[data-action=readyLobby]')));
  await creator.locator('[data-action=startWriting]:not([disabled])').waitFor();await click(creator,'[data-action=startWriting]');
  for(const page of pages)await page.locator('textarea[data-card]').fill('میلاد');
  await Promise.all(pages.map(page=>click(page,'[data-do=cards-ready]')));
  const playing=await read(creator),referee=pages[ids.indexOf(playing.turn.refereeId)];
  await referee.locator('[data-action=start]').waitFor();await click(referee,'[data-action=start]');
  await referee.locator('[data-action=question]:not([disabled])').waitFor();
  if(playing.turn.playerId===ids[0])assert.equal(await creator.locator('.head-top [data-do=menu]').count(),1);
  await menu(creator);await creator.locator('#kick-target').selectOption(ids[2]);await confirmClick(creator,'[data-do=kick]');
  await home(milad);await amin.locator('#app[data-phase=lobby]').waitFor();
  const reset=await read(creator);assert.equal(reset.phase,'lobby');assert.equal(reset.generation,2);assert.equal(reset.players.length,2);
  assert.ok(reset.players.every(p=>!p.ready));assert.ok(reset.scores.every(p=>p.score===0));assert.equal(reset.turn,null);
  checks.push('confirmed mid-game kick resets remaining players to a clean two-person lobby');
  await menu(creator);await creator.locator('#host-target').selectOption(ids[1]);await click(creator,'[data-do=transfer]');
  await menu(creator);await creator.locator('[data-do=close-room]').click();await creator.getByRole('alertdialog').waitFor();
  await creator.locator('[data-confirm=cancel]').click();assert.equal((await read(creator)).phase,'lobby');
  await confirmClick(creator,'[data-do=close-room]');await home(creator);await home(amin);
  checks.push('original creator can close after transferring management; all connected players return home');
  await creator.reload();await creator.locator('#entry-name').fill('رامین');await click(creator,'button[type=submit]');
  const next=await read(creator);assert.notEqual(next.id,first.id);
  await amin.goto(base+'/?room='+next.code);await amin.locator('#entry-name').fill('امین');await click(amin,'button[type=submit]');
  const newAmin=await amin.evaluate(()=>JSON.parse(localStorage.getItem('forehead-session-v3')).playerId);
  await menu(creator);await creator.locator('#host-target').selectOption(newAmin);await click(creator,'[data-do=transfer]');
  await menu(amin);await confirmClick(amin,'[data-do=close-room]');await home(amin);await home(creator);
  await new Promise(resolve=>setTimeout(resolve,1300));await home(creator);await home(amin);
  checks.push('transferred manager can close; original host leaves cleanly; a fresh independent lobby works');
  for(const page of pages)assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  assert.deepEqual(errors,[]);
  const result={passed:true,base,players:3,checks,errors,realtimeVerified:true,hostedBuild:Boolean(process.env.E2E_URL)};
  await writeFile(new URL('lobby-results.json',output),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}catch(error){
  await writeFile(new URL('lobby-results.json',output),JSON.stringify({passed:false,base,error:error.stack,checks,errors},null,2));
  throw error;
}finally{await browser.close();if(server)await new Promise(resolve=>server.close(resolve));}
