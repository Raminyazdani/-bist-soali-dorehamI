import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {BlobStore} from '../lib/blob-store.mjs';
import {cleanupRequest,gameRequest,photoRequest} from '../lib/http.mjs';
import {fileBlob} from './file-blob.mjs';

export function localServer({directory,cleanupSecret,root=new URL('../dist/',import.meta.url).pathname}={}) {
  const sdk=directory?fileBlob(directory):undefined;
  return createServer(async(req,res)=>{
    const pathname=new URL(req.url,'http://localhost').pathname;
    const store=new BlobStore(sdk?{sdk}:{});
    if(pathname==='/api/game')return gameRequest(req,res,store);
    if(pathname==='/api/photo')return photoRequest(req,res,store);
    if(pathname==='/api/cleanup')return cleanupRequest(req,res,store,cleanupSecret);
    try {
      const name=pathname==='/'?'index.html':pathname.slice(1),target=resolve(root,name);
      if(!target.startsWith(resolve(root)+'/'))throw Error('Invalid path');
      const bytes=await readFile(target);
      const mime={'.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.html':'text/html'};
      res.setHeader('Content-Type',mime[extname(target)]??'application/octet-stream');res.end(bytes);
    } catch { res.statusCode=404;res.end('Not found'); }
  });
}
