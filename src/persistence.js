let database;
export async function db() {
  if (!database) database = new Promise((resolve,reject) => {
    const request=indexedDB.open('forehead-peer-v2',1);
    request.onupgradeneeded=()=>{request.result.createObjectStore('rooms',{keyPath:'id'});request.result.createObjectStore('photos');};
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>{database=null;reject(new Error('ذخیرهٔ بازی در این مرورگر باز نشد؛ مرورگر معمولی را امتحان کن.'));};
  });
  return database;
}
export async function readRecord(store,key) {
  const database=await db();
  return new Promise((resolve,reject)=>{const request=database.transaction(store).objectStore(store).get(key);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
}
export async function writeRecord(store,value,key) {
  const database=await db();
  return new Promise((resolve,reject)=>{
    const transaction=database.transaction(store,'readwrite');
    const target=transaction.objectStore(store);
    key===undefined?target.put(value):target.put(value,key);
    transaction.oncomplete=()=>resolve();
    transaction.onerror=transaction.onabort=()=>reject(new Error('حافظهٔ مرورگر پر است؛ یک عکس کوچک‌تر انتخاب کن.'));
  });
}
export async function deleteRecords(store,keys) {
  if(!keys.length)return;
  const database=await db();
  return new Promise((resolve,reject)=>{const transaction=database.transaction(store,'readwrite');for(const key of keys)transaction.objectStore(store).delete(key);transaction.oncomplete=resolve;transaction.onerror=()=>reject(transaction.error);});
}
