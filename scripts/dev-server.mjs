import {localServer} from './server.mjs';
const port=Number(process.env.PORT||5173);
const server=localServer({directory:process.env.GAME_DEV_DIR??'test-output/dev-rooms'});
server.listen(port,'0.0.0.0',()=>console.log(`Game: http://localhost:${port}`));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>process.exit(0)));
