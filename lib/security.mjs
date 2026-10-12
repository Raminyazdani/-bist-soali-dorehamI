import {createHmac} from 'node:crypto';
import {equalHash} from './crypto.mjs';
import {GameError} from './game.mjs';

const signature=(room,player,path,expires)=>createHmac('sha256',player.tokenHash).update(JSON.stringify([room.id,room.generation,player.id,path,expires])).digest('hex');
export function photoLink(room,playerId,path,now=Date.now()) {
  const player=room.players.find(p=>p.id===playerId);
  if(!player)throw new GameError('دیگر عضو این لابی نیستی.',401,'UNAUTHORIZED');
  const expires=Math.ceil((now+600000)/60000)*60000;
  return '/api/photo?'+new URLSearchParams({roomId:room.id,playerId,path,expires:String(expires),signature:signature(room,player,path,expires)});
}
export function verifyPhoto(room,params,now=Date.now()) {
  if(room.phase==='closed')throw new GameError('این لابی بسته شده است.',410,'ROOM_CLOSED');
  if(room.expiresAt<=now)throw new GameError('این لابی منقضی شده است.',410,'EXPIRED');
  const player=room.players.find(p=>p.id===params.get('playerId')),path=params.get('path'),expires=Number(params.get('expires'));
  if(!player||!path||!Number.isSafeInteger(expires)||expires<=now||!equalHash(params.get('signature'),signature(room,player,path,expires)))
    throw new GameError('این لینک عکس معتبر نیست؛ صفحه را تازه کن.',403,'INVALID_PHOTO');
  return player.id;
}
export function requestGuard(req) {
  const origin=req.headers.origin;
  const host=String(req.headers['x-forwarded-host']??req.headers.host??'').split(',')[0].trim();
  if(origin){
    try{if(new URL(origin).host!==host)throw Error('Origin mismatch');}
    catch{throw new GameError('درخواست از این صفحه مجاز نیست.',403,'ORIGIN');}
  }
  if(!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type']??''))
    throw new GameError('درخواست باید JSON باشد.',415,'CONTENT_TYPE');
}
export function clientAddress(req) {
  return String(process.env.VERCEL?(req.headers['x-vercel-forwarded-for']??req.headers['x-forwarded-for']??req.socket?.remoteAddress):req.socket?.remoteAddress??'unknown').split(',')[0].trim();
}
