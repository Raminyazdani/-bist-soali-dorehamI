// Durable disk adapter for local development/tests only. Production uses the
// real private Vercel Blob SDK; it never falls back to disk or process memory.
import {mkdir,readFile,writeFile,rename,unlink,readdir,stat} from 'node:fs/promises';
import {dirname,join,resolve} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
const queues=new Map();
const etag=bytes=>createHash('sha256').update(bytes).digest('hex');
const error=code=>Object.assign(new Error(code),{code});
export function fileBlob(directory) {
  const root=resolve(directory);
  const path=name=>{const result=resolve(root,name);if(!result.startsWith(root+'/'))throw error('BAD_PATH');return result;};
  async function serial(fn) { const previous=queues.get(root)??Promise.resolve();const current=previous.then(fn);queues.set(root,current.catch(()=>{}));return current; }
  async function read(name) { try{return await readFile(path(name));}catch(e){if(e.code==='ENOENT')return null;throw e;} }
  return {
    async list(options={}) {
      const names=[];
      async function walk(directory){
        let entries;try{entries=await readdir(directory,{withFileTypes:true});}catch(error){if(error.code==='ENOENT')return;throw error;}
        for(const entry of entries){
          const target=join(directory,entry.name);
          if(entry.isDirectory())await walk(target);
          else if(!entry.name.endsWith('.tmp'))names.push(target.slice(root.length+1));
        }
      }
      await walk(root);
      const matching=names.filter(name=>name.startsWith(options.prefix??'')&&(!options.cursor||name>options.cursor)).sort(),selected=matching.slice(0,options.limit??200);
      return {blobs:await Promise.all(selected.map(async pathname=>({pathname,uploadedAt:(await stat(path(pathname))).mtime}))),hasMore:matching.length>selected.length,cursor:selected.at(-1)};
    },
    async get(name) {
      const bytes=await read(name);if(!bytes)return null;
      let contentType='application/json';if(name.includes('/photos/'))contentType=name.endsWith('.png')?'image/png':name.endsWith('.webp')?'image/webp':'image/jpeg';
      return {statusCode:200,stream:new Response(bytes).body,blob:{etag:etag(bytes),contentType}};
    },
    async put(name,value,options={}) { return serial(async()=>{
      const old=await read(name);
      if(options.ifMatch&&(!old||etag(old)!==options.ifMatch))throw error('PRECONDITION');
      if(old&&!options.allowOverwrite)throw error('EXISTS');
      const bytes=Buffer.from(value),target=path(name);await mkdir(dirname(target),{recursive:true});
      const temporary=target+'.'+randomUUID()+'.tmp';await writeFile(temporary,bytes);await rename(temporary,target);
      return {etag:etag(bytes)};
    }); },
    async del(names,options={}) { return serial(async()=>{for(const name of Array.isArray(names)?names:[names]){
      const old=await read(name);if(!old)continue;
      if(options.ifMatch&&etag(old)!==options.ifMatch)throw error('PRECONDITION');
      await unlink(path(name));
    }}); }
  };
}
