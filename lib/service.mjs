import {randomUUID} from './crypto.mjs';
import {Buffer} from 'buffer';
import { applyAction, authenticate, createRoom, GameError, joinRoom, makeCode, normalizeDigits, snapshot } from './game.mjs';

const ACTIONS = new Set(['setCount','readyLobby','startWriting','saveCard','readyWriting','removeImage','start','question','undoQuestion','correct','failed','pause','resume','next','setReferee','transferHost','claimHost','leave','reset','kick','closeRoom']);
const requestIdCheck = id => {
  if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{8,100}$/.test(id)) throw new GameError('شناسهٔ درخواست نامعتبر است.', 400, 'BAD_REQUEST_ID');
};
export class GameService {
  constructor(storage, options = {}) { this.storage = storage; this.clock = options.clock ?? (() => Date.now()); this.random = options.random ?? Math.random; }
  async respond(row, actorId, credentials) {
    const presence = await this.storage.presence(row.id);
    return { snapshot: snapshot(row.state, actorId, row.revision, this.clock(), presence), ...(credentials ? { credentials } : {}) };
  }
  async create(data) {
    if (data.roomId && data.playerId && data.token) {
      try {
        const existing = await this.storage.get(data.roomId);
        authenticate(existing.state, data.playerId, data.token, this.clock());
        await this.storage.ping(existing.id, data.playerId, this.clock());
        return this.respond(existing, data.playerId, { roomId: existing.id, playerId: data.playerId, token: data.token, code: existing.state.code });
      } catch (error) { if (error.code !== 'NOT_FOUND') throw error; }
    }
    for (let tries = 0; tries < 8; tries++) {
      const { room, credentials } = createRoom({ ...data, code: makeCode(), now: this.clock() });
      const row = await this.storage.insert(room);
      if (!row) {
        if (data.roomId) {
          try {
            const existing = await this.storage.get(data.roomId);
            authenticate(existing.state, data.playerId, data.token, this.clock());
            return this.respond(existing, data.playerId, { roomId: existing.id, playerId: data.playerId, token: data.token, code: existing.state.code });
          } catch (error) { if (error.code !== 'NOT_FOUND') throw error; }
        }
        continue;
      }
      await this.storage.ping(room.id, credentials.playerId, this.clock());
      return this.respond(row, credentials.playerId, credentials);
    }
    throw new GameError('ساخت لابی انجام نشد؛ دوباره امتحان کن.', 503, 'BUSY');
  }
  async join(data) {
    const code = normalizeDigits(data.code).replace(/\s/g, '');
    if (!/^\d{6}$/.test(code)) throw new GameError('کد لابی شش رقم است.', 400, 'BAD_CODE');
    let row = await this.storage.byCode(code);
    for (let tries = 0; tries < 8; tries++) {
      if (data.playerId && row.state.players.some(p => p.id === data.playerId)) {
        authenticate(row.state, data.playerId, data.token, this.clock());
        await this.storage.ping(row.id, data.playerId, this.clock());
        return this.respond(row, data.playerId, { roomId: row.id, playerId: data.playerId, token: data.token, code });
      }
      const joined = joinRoom(row.state, data.name, this.clock(), data);
      if (await this.storage.cas(row, joined.room)) {
        const next = { ...row, state: joined.room, revision: Number(row.revision) + 1 };
        await this.storage.ping(row.id, joined.credentials.playerId, this.clock());
        return this.respond(next, joined.credentials.playerId, joined.credentials);
      }
      row = await this.storage.get(row.id);
    }
    throw new GameError('لابی در حال تغییر است؛ دوباره امتحان کن.', 409, 'BUSY');
  }
  async state(data) {
    let row = await this.storage.get(data.roomId);
    authenticate(row.state, data.playerId, data.token, this.clock());
    await this.storage.ping(row.id, data.playerId, this.clock());
    const presence = await this.storage.presence(row.id);
    if (row.state.phase === 'playing' && row.state.turn?.status === 'running') {
      const paused = applyAction(row.state, data.playerId, 'autoPause', {}, { now: this.clock(), presence });
      if (paused.changed && await this.storage.cas(row, paused.room)) row = { ...row, state: paused.room, revision: Number(row.revision) + 1 };
      else if (paused.changed) row = await this.storage.get(row.id);
    }
    return { snapshot: snapshot(row.state, data.playerId, row.revision, this.clock(), presence) };
  }
  async action(data, internalAction, internalData) {
    const action = internalAction ?? data.action;
    if (!internalAction && !ACTIONS.has(action)) throw new GameError('درخواست نامعتبر است.', 400, 'UNKNOWN_ACTION');
    requestIdCheck(data.requestId);
    let row = await this.storage.get(data.roomId);
    let previous;
    for (let tries = 0; tries < 10; tries++) {
      authenticate(row.state, data.playerId, data.token, this.clock());
      previous = row.state;
      const presence = action === 'claimHost' ? await this.storage.presence(row.id) : {};
      const changed = applyAction(row.state, data.playerId, action, internalData ?? data.data ?? {}, { requestId: data.requestId, now: this.clock(), random: this.random, presence, creatorId: row.creatorId ?? row.state.creatorId });
      if (!changed.changed) return this.respond(row, data.playerId);
      if (await this.storage.cas(row, changed.room)) {
        row = { ...row, state: changed.room, revision: Number(row.revision) + 1 };
        if (action === 'leave') return { left: true };
        await this.storage.ping(row.id, data.playerId, this.clock());
        if (['reset','removeImage','kick','closeRoom'].includes(action)) {
          const stillUsed = new Set(changed.room.cards.map(c => c.imagePath));
          await this.storage.removeImages(previous.cards.map(c => c.imagePath).filter(path => path && !stillUsed.has(path)));
        }
        return this.respond(row, data.playerId);
      }
      row = await this.storage.get(row.id);
    }
    throw new GameError('یک درخواست دیگر همزمان رسید؛ دوباره امتحان کن.', 409, 'BUSY');
  }
  async upload(data) {
    requestIdCheck(data.requestId);
    const row = await this.storage.get(data.roomId);
    const actor = authenticate(row.state, data.playerId, data.token, this.clock());
    if (row.state.requests.includes(`${data.playerId}:${data.requestId}`)) return this.respond(row, data.playerId);
    if (row.state.phase !== 'writing' || actor.ready) throw new GameError('برای ویرایش، آمادگی‌ات را بردار.', 400, 'CARDS_LOCKED');
    const card = row.state.cards.find(c => c.id === data.cardId && c.authorId === actor.id);
    if (!card) throw new GameError('این کارت متعلق به تو نیست.', 400, 'NOT_YOUR_CARD');
    if (typeof data.base64 !== 'string' || data.base64.length > 820000) throw new GameError('عکس باید کمتر از ۶۰۰ کیلوبایت باشد.', 400, 'IMAGE_TOO_LARGE');
    const bytes = Buffer.from(data.base64, 'base64');
    let extension;
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) extension = 'jpg';
    if (bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) extension = 'png';
    if (bytes.subarray(0,4).toString() === 'RIFF' && bytes.subarray(8,12).toString() === 'WEBP') extension = 'webp';
    if (!extension || !bytes.length || bytes.length > 614400) throw new GameError('عکس معتبر JPG، PNG یا WebP انتخاب کن.', 400, 'BAD_IMAGE');
    const mime = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }[extension];
    const path = `${row.id}/${actor.id}/${card.id}-${randomUUID()}.${extension}`;
    const url = await this.storage.upload(path, bytes, mime);
    try {
      const result = await this.action(data, '_attachImage', { cardId: card.id, imagePath: path, imageUrl: url });
      // Concurrent retries may have uploaded an extra object before the same action
      // was committed. Keep the referenced photo and remove only unused objects.
      const latest = await this.storage.get(row.id);
      const used = new Set(latest.state.cards.map(c => c.imagePath));
      await this.storage.removeImages([path, card.imagePath].filter(p => p && !used.has(p)));
      return result;
    } catch (error) {
      // A response/presence failure after the CAS must not delete a committed photo.
      const current = await this.storage.get(row.id).catch(() => null);
      if (current && !current.state.cards.some(c => c.imagePath === path)) await this.storage.removeImages([path]);
      throw error;
    }
  }
}
