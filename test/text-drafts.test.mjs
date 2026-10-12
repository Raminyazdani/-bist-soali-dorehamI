import test from 'node:test';
import assert from 'node:assert/strict';
import {TextDrafts} from '../src/text-drafts.js';
const storage = () => { const values = new Map(); return {values,getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)}; };
const state = (changes = {}) => ({id:'room-a',you:'player-a',generation:1,phase:'writing',players:[{id:'player-a',ready:false}],ownCards:[{id:'card-a',text:''}],...changes});
test('reload restores only this player/generation own pending text, without sensitive cache fields', () => {
  const disk=storage(),first=new TextDrafts(disk,()=> 'request_a');first.bind(state());first.set('card-a','نوشتهٔ محلی');first.ticket('card-a');
  assert.deepEqual(JSON.parse(disk.getItem(first.key)),{'card-a':'نوشتهٔ محلی'});
  const reload=new TextDrafts(disk);assert.equal(reload.bind(state()).get('card-a'),'نوشتهٔ محلی');
  assert.equal(new TextDrafts(disk).bind(state({you:'player-b',players:[{id:'player-b',ready:false}]})).size,0);
  assert.equal(new TextDrafts(disk).bind(state({generation:2})).size,0);
  assert.equal(new TextDrafts(disk).bind(state({phase:'playing'})).size,0);
  assert.equal(new TextDrafts(disk).bind(state({players:[{id:'player-a',ready:true}]})).size,0);
});
test('older in-flight save and poll cannot erase a newer edit; retry keeps one request intent', () => {
  const drafts=new TextDrafts(storage(),()=> 'same_request');drafts.bind(state());drafts.set('card-a','قدیمی');const old=drafts.ticket('card-a');
  assert.equal(drafts.ticket('card-a').requestId,old.requestId);
  drafts.set('card-a','جدید');assert.equal(drafts.acknowledge(old),false);
  assert.equal(drafts.bind(state({ownCards:[{id:'card-a',text:'قدیمی'}]})).get('card-a'),'جدید');
  const latest=drafts.ticket('card-a');assert.equal(drafts.acknowledge(latest),true);assert.equal(drafts.pending().length,0);
});
test('reversing to the previous server value survives its stale poll while an older edit is in flight', () => {
  const drafts=new TextDrafts(storage());drafts.bind(state({ownCards:[{id:'card-a',text:'A'}]}));
  drafts.set('card-a','B');const old=drafts.ticket('card-a');drafts.set('card-a','A');
  assert.equal(drafts.bind(state({ownCards:[{id:'card-a',text:'A'}]}),{protectedCards:new Set(['card-a'])}).get('card-a'),'A');
  assert.equal(drafts.acknowledge(old),false);
  assert.equal(drafts.bind(state({ownCards:[{id:'card-a',text:'B'}]})).get('card-a'),'A');
  const latest=drafts.ticket('card-a');assert.equal(drafts.acknowledge(latest),true);
  assert.equal(drafts.values().size,0);
});
test('a fresh server confirmation reconciles a lost response and normalization before resending', () => {
  const disk=storage(),drafts=new TextDrafts(disk);drafts.bind(state());drafts.set('card-a','  پاسخ  ');
  const reload=new TextDrafts(disk);assert.equal(reload.bind(state({ownCards:[{id:'card-a',text:'پاسخ'}]})).size,0);
  assert.deepEqual(JSON.parse(disk.getItem(reload.key)),{});
});
test('generation change and stale async acknowledgements cannot affect a fresh game', () => {
  const drafts=new TextDrafts(storage());drafts.bind(state());drafts.set('card-a','دست قبلی');const old=drafts.ticket('card-a');
  drafts.bind(state({generation:2,ownCards:[{id:'card-b',text:''}]}));drafts.set('card-b','دست تازه');
  assert.equal(drafts.acknowledge(old),false);assert.equal(drafts.values().get('card-b'),'دست تازه');
});
test('invalid/foreign cached entries are ignored and blocked local storage is reported honestly', () => {
  const disk=storage(),drafts=new TextDrafts(disk);drafts.bind(state());disk.setItem(drafts.key,JSON.stringify({'card-a':'ک'.repeat(161),foreign:'private',token:{bad:true}}));
  assert.equal(new TextDrafts(disk).bind(state()).size,0);
  const blocked=new TextDrafts({getItem(){throw Error('blocked');},setItem(){throw Error('blocked');},removeItem(){throw Error('blocked');}});
  blocked.bind(state());blocked.set('card-a','حفظ در حافظه');assert.equal(blocked.persisted,false);assert.equal(blocked.values().get('card-a'),'حفظ در حافظه');
});
test('published legacy drafts migrate only own valid text and preserve another author cache', () => {
  const disk=storage(),legacyKey='forehead-drafts-room-a-1';
  disk.setItem(legacyKey,JSON.stringify({'card-a':'نوشتهٔ منتشرنشده',foreign:'نوشتهٔ نویسندهٔ دیگر',token:'secret',photo:{bytes:'private'},proof:{signature:'private'},url:'https://example.test/photo'}));
  const drafts=new TextDrafts(disk);assert.equal(drafts.bind(state()).get('card-a'),'نوشتهٔ منتشرنشده');
  assert.deepEqual(JSON.parse(disk.getItem(drafts.key)),{'card-a':'نوشتهٔ منتشرنشده'});
  const remaining=JSON.parse(disk.getItem(legacyKey));assert.equal(Object.hasOwn(remaining,'card-a'),false);
  assert.deepEqual(remaining,{foreign:'نوشتهٔ نویسندهٔ دیگر',token:'secret',photo:{bytes:'private'},proof:{signature:'private'},url:'https://example.test/photo'});
});
test('legacy import requires own writing/unready scope and ignores invalid text or another generation', () => {
  const disk=storage(),legacyKey='forehead-drafts-room-a-1',legacy=JSON.stringify({'card-a':'قدیمی',foreign:'متن دیگر','card-long':'ک'.repeat(161),'card-object':{text:'not plain text'}});
  disk.setItem(legacyKey,legacy);
  for (const snapshot of [state({phase:'playing'}),state({phase:'lobby'}),state({players:[]}),state({players:[{id:'player-a',ready:true}]}),state({you:'player-b',players:[{id:'player-b',ready:false}],ownCards:[{id:'card-b',text:''}]}),state({generation:2})]) {
    assert.equal(new TextDrafts(disk).bind(snapshot).size,0);
  }
  assert.equal(disk.getItem(legacyKey),legacy);
  const invalid=new TextDrafts(disk);assert.equal(invalid.bind(state({ownCards:[{id:'card-long',text:''},{id:'card-object',text:''}]})).size,0);
  assert.deepEqual(JSON.parse(disk.getItem(invalid.key)),{});
});
test('scoped drafts and empty used scopes win; acknowledged or reset text never resurrects from legacy', () => {
  const disk=storage(),legacyKey='forehead-drafts-room-a-1',scopedKey='forehead-text-v1-room-a-player-a-1';
  disk.setItem(legacyKey,JSON.stringify({'card-a':'قدیمی'}));disk.setItem(scopedKey,JSON.stringify({'card-a':'تازه'}));
  const drafts=new TextDrafts(disk);assert.equal(drafts.bind(state()).get('card-a'),'تازه');
  assert.equal(drafts.acknowledge(drafts.ticket('card-a')),true);assert.deepEqual(JSON.parse(disk.getItem(scopedKey)),{});
  assert.equal(new TextDrafts(disk).bind(state()).size,0);
  drafts.bind(state());drafts.set('card-a','قبل از بازی تازه');drafts.bind(state({generation:2,ownCards:[{id:'card-b',text:''}]}));
  assert.deepEqual(JSON.parse(disk.getItem(scopedKey)),{});
  assert.equal(new TextDrafts(disk).bind(state()).size,0);
  assert.equal(JSON.parse(disk.getItem(legacyKey))['card-a'],'قدیمی');
  disk.setItem(scopedKey,'invalid JSON');assert.equal(new TextDrafts(disk).bind(state()).size,0);
});
test('migration reconciles confirmed text and never removes legacy data before durable scoped save', () => {
  const disk=storage(),legacyKey='forehead-drafts-room-a-1';disk.setItem(legacyKey,JSON.stringify({'card-a':'  پاسخ  ',foreign:'باقی'}));
  const confirmed=new TextDrafts(disk);assert.equal(confirmed.bind(state({ownCards:[{id:'card-a',text:'پاسخ'}]})).size,0);
  assert.deepEqual(JSON.parse(disk.getItem(confirmed.key)),{});assert.deepEqual(JSON.parse(disk.getItem(legacyKey)),{foreign:'باقی'});
  const blockedDisk=storage();blockedDisk.setItem(legacyKey,JSON.stringify({'card-a':'هنوز محلی'}));
  const blocked=new TextDrafts({...blockedDisk,setItem(){throw Error('blocked');}});
  assert.equal(blocked.bind(state()).get('card-a'),'هنوز محلی');assert.equal(blocked.persisted,false);
  assert.deepEqual(JSON.parse(blockedDisk.getItem(legacyKey)),{'card-a':'هنوز محلی'});
});
