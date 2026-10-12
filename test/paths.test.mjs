import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileBlob} from '../scripts/file-blob.mjs';
import {localServer} from '../scripts/server.mjs';

test('disk storage keeps portable Blob paths and refuses paths outside its directory',async t=>{
  const directory=await mkdtemp(join(tmpdir(),'forehead paths '));
  t.after(()=>rm(directory,{recursive:true,force:true}));
  const root=join(directory,'داده‌ها'),sdk=fileBlob(root);
  const first='forehead-v3/rooms/first.json',second='forehead-v3/photos/player/card.png';
  await sdk.put(first,'{"saved":true}');await sdk.put(second,Buffer.from('photo'));
  const listing=await sdk.list({prefix:'forehead-v3/',limit:1});
  assert.equal(listing.hasMore,true);assert.equal(listing.blobs[0].pathname,second);
  const next=await sdk.list({prefix:'forehead-v3/',cursor:listing.cursor,limit:1});
  assert.equal(next.hasMore,false);assert.equal(next.blobs[0].pathname,first);
  assert.equal(await new Response((await sdk.get(first)).stream).text(),'{"saved":true}');
  for(const path of ['../outside.json',join(directory,'outside.json'),'.']){
    await assert.rejects(()=>sdk.put(path,'escape'),{code:'BAD_PATH'});
    await assert.rejects(()=>sdk.get(path),{code:'BAD_PATH'});
  }
});

test('the local HTTP server serves a build in a directory with spaces and Unicode',async t=>{
  const directory=await mkdtemp(join(tmpdir(),'forehead build ')),root=join(directory,'نسخه');
  await mkdir(join(root,'assets'),{recursive:true});
  await writeFile(join(root,'index.html'),'<h1>روی پیشونی!</h1>');
  await writeFile(join(root,'assets','app.js'),'console.log("ready");');
  const server=localServer({root,directory:join(directory,'rooms')});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(async()=>{await new Promise(resolve=>server.close(resolve));await rm(directory,{recursive:true,force:true});});
  const base=`http://127.0.0.1:${server.address().port}`;
  const home=await fetch(base+'/');assert.equal(home.status,200);assert.match(await home.text(),/روی پیشونی/);
  const asset=await fetch(base+'/assets/app.js');assert.equal(asset.status,200);assert.equal(asset.headers.get('content-type'),'text/javascript');
  assert.equal((await fetch(base+'/missing.js')).status,404);
});
