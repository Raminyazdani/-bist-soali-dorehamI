import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,relative,isAbsolute,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {BlobStore} from '../lib/blob-store.mjs';
import {PostgresStore} from '../lib/postgres-store.mjs';
import {cleanupRequest,gameRequest,photoRequest,imageImportRequest} from '../lib/http.mjs';
import {fileBlob} from './file-blob.mjs';

export function localServer({directory,cleanupSecret,imageImporter,root=fileURLToPath(new URL('../dist/',import.meta.url))}={}) {
  const sdk=directory?fileBlob(directory):undefined;
  return createServer(async(req,res)=>{
    const pathname=new URL(req.url,'http://localhost').pathname;
    const store=sdk?new BlobStore({sdk}):new PostgresStore();
    if(pathname==='/api/game')return gameRequest(req,res,store);
    if(pathname==='/api/photo')return photoRequest(req,res,store);
    if(pathname==='/api/image-import')return imageImportRequest(req,res,store,imageImporter);
    if(pathname==='/api/cleanup')return cleanupRequest(req,res,store,cleanupSecret);
    try {
      const name=pathname==='/'?'index.html':pathname.slice(1),target=resolve(root,name);
      const inside=relative(resolve(root),target);
      if(!inside||inside==='..'||inside.startsWith('..'+sep)||isAbsolute(inside))throw Error('Invalid path');
      const bytes=await readFile(target);
      const mime={'.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.html':'text/html','.json':'application/json'};
      if(pathname==='/version.json')res.setHeader('Cache-Control','no-store');
      res.setHeader('Content-Type',mime[extname(target)]??'application/octet-stream');res.end(bytes);
    } catch { res.statusCode=404;res.end('Not found'); }
  });
}
