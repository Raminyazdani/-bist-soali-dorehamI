import {createServer} from 'vite';
const server=await createServer({server:{host:'0.0.0.0',port:Number(process.env.PORT||5173)}});
await server.listen();server.printUrls();
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await server.close();process.exit(0);});
