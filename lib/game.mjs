import {hash, token, roomCode, randomUUID, equalHash, secureRandomInt} from './crypto.mjs';

export const LIMITS = { minPlayers: 2, maxPlayers: 12, maxCards: 20, questions: 20, roomHours: 24 };
export class GameError extends Error {
  constructor(message, status = 400, code = 'INVALID_ACTION') {
    super(message); this.status = status; this.code = code;
  }
}
const fail = (message, code) => { throw new GameError(message, 400, code); };
export const tokenHash = hash;
export const makeToken = token;
export const makeCode = roomCode;
export function normalizeDigits(value) {
  return String(value ?? '').replace(/[۰-۹]/g, c => String(c.charCodeAt(0) - 1776)).replace(/[٠-٩]/g, c => String(c.charCodeAt(0) - 1632));
}
export function cleanName(value) {
  const name = String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, '').trim().replace(/\s+/g, ' ');
  if (!name || name.length > 28) fail('اسمت را بنویس؛ حداکثر ۲۸ حرف.', 'BAD_NAME');
  return name;
}
export function cardCount(value) {
  const n = Number(normalizeDigits(value));
  if (!Number.isInteger(n) || n < 1 || n > LIMITS.maxCards) fail('تعداد کارت باید بین ۱ و ۲۰ باشد.', 'BAD_COUNT');
  return n;
}
export const normalizeName = s => s.normalize('NFKC').replace(/ي/g, 'ی').replace(/ك/g, 'ک').toLocaleLowerCase('fa');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const canonicalId = value => typeof value === 'string' ? value.toLowerCase() : value;
export function participantIdentity(playerId, token) {
  if (playerId && (typeof playerId !== 'string' || !UUID.test(playerId))) fail('شناسهٔ بازیکن نامعتبر است.', 'BAD_ID');
  if (token && !/^[a-zA-Z0-9_-]{32,80}$/.test(token)) fail('ورود نامعتبر است.', 'BAD_TOKEN');
  return { playerId: canonicalId(playerId) || randomUUID(), token: token || makeToken() };
}
export function createRoom({ name, cardsPerPlayer = 3, code = makeCode(), now = Date.now(), playerId, token, roomId }) {
  ({ playerId, token } = participantIdentity(playerId, token));
  if (roomId && (typeof roomId !== 'string' || !UUID.test(roomId))) fail('شناسهٔ لابی نامعتبر است.', 'BAD_ID');
  const player = { id: playerId, name: cleanName(name), tokenHash: tokenHash(token), ready: false, joinedAt: now };
  const room = {
    id: canonicalId(roomId) || randomUUID(), code, generation: 1, createdAt: now,
    expiresAt: now + LIMITS.roomHours * 3600000, hostId: player.id, creatorId: player.id,
    cardsPerPlayer: cardCount(cardsPerPlayer), phase: 'lobby', players: [player],
    cards: [], order: [], assignments: {}, turnIndex: 0, turn: null, results: [], requests: []
  };
  return { room, credentials: { roomId: room.id, playerId: player.id, token, code: room.code } };
}
export function authenticate(room, playerId, token, now = Date.now()) {
  playerId = canonicalId(playerId);
  if (room?.phase === 'closed') throw new GameError('مدیر لابی را بست؛ می‌توانی وارد یک لابی تازه شوی.', 410, 'ROOM_CLOSED');
  if (!room || room.expiresAt <= now) throw new GameError('این لابی بسته شده است. یک لابی تازه بساز.', 410, 'EXPIRED');
  const player = room.players.find(p => p.id === playerId);
  const supplied = tokenHash(token);
  if (!player || !equalHash(player.tokenHash, supplied))
    throw new GameError('ورودت معتبر نیست؛ دوباره با کد لابی وارد شو.', 401, 'UNAUTHORIZED');
  return player;
}
export function joinRoom(room, name, now = Date.now(), identity = {}) {
  if (room.phase === 'closed') throw new GameError('این لابی بسته شده است؛ یک لابی تازه بساز.', 410, 'ROOM_CLOSED');
  if (room.expiresAt <= now) throw new GameError('این لابی بسته شده است.', 410, 'EXPIRED');
  if (room.phase !== 'lobby') fail('کارت‌سازی شروع شده؛ ورود بازیکن تازه بسته است.', 'ROOM_LOCKED');
  if (room.players.length >= LIMITS.maxPlayers) fail('لابی پر است؛ حداکثر ۱۲ نفر.', 'ROOM_FULL');
  name = cleanName(name);
  if (room.players.some(p => normalizeName(p.name) === normalizeName(name))) fail('این اسم در لابی هست؛ یک اسم متفاوت بنویس.', 'NAME_TAKEN');
  const { playerId, token } = participantIdentity(identity.playerId, identity.token);
  if (room.players.some(p => p.id === playerId)) fail('شناسهٔ بازیکن تکراری است.', 'BAD_ID');
  const next = structuredClone(room);
  const player = { id: playerId, name, tokenHash: tokenHash(token), ready: false, joinedAt: now };
  next.players.push(player);
  return { room: next, credentials: { roomId: room.id, playerId: player.id, token, code: room.code } };
}
export function shuffle(list, random) {
  const result = [...list];
  for (let i = result.length - 1; i > 0; i--) {
    const j = random === undefined ? secureRandomInt(i + 1) : Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
export function dealCards(players, cards, count, random) {
  const ids = players.map(p => p.id);
  if (ids.length < 2) fail('برای بازی حداقل دو نفر لازم است.', 'TOO_FEW');
  const byAuthor = Object.fromEntries(ids.map(id => [id, shuffle(cards.filter(c => c.authorId === id), random)]));
  if (Object.values(byAuthor).some(list => list.length !== count || list.some(c => !c.text.trim()))) fail('کارت‌ها کامل نیستند.', 'INCOMPLETE');
  const assignments = Object.fromEntries(ids.map(id => [id, []]));
  // Each block visits every other author once. Randomize the seating and
  // shifts, then the cards themselves, so one author cannot fill a hand.
  for (let round = 0; round < count;) {
    const seats = shuffle(ids, random);
    const shifts = shuffle(Array.from({ length:ids.length - 1 }, (_, i) => i + 1), random);
    for (const shift of shifts) {
      if (round === count) break;
      seats.forEach((author, i) => assignments[seats[(i + shift) % seats.length]].push(byAuthor[author][round].id));
      round++;
    }
  }
  for (const id of ids) assignments[id] = shuffle(assignments[id], random);
  return assignments;
}
function newTurn(room) {
  const position = room.turnIndex % room.order.length;
  const playerId = room.order[position];
  return {
    id: randomUUID(), playerId, refereeId: room.order[(position + 1) % room.order.length],
    cardId: room.assignments[playerId][Math.floor(room.turnIndex / room.order.length)],
    status: 'waiting', remaining: LIMITS.questions, startedAt: null, elapsedMs: 0, questionHistory: [],
    pauseReason: null, result: null
  };
}
export function elapsedTime(turn, now = Date.now()) {
  return Math.max(0, Math.round(turn.elapsedMs + (turn.status === 'running' && turn.startedAt ? Math.max(0, now - turn.startedAt) : 0)));
}
const isHost = (room, actor) => room.hostId === actor.id;
function requireHost(room, actor) { if (!isHost(room, actor)) fail('این کار با مدیر لابی است.', 'HOST_ONLY'); }
function requireTurn(room) { if (room.phase !== 'playing' || !room.turn) fail('الان نوبت فعالی نداریم.', 'NO_TURN'); }
function requireReferee(room, actor) {
  requireTurn(room);
  if (room.turn.refereeId !== actor.id) fail('دکمه‌های این نوبت دست داور است.', 'REFEREE_ONLY');
}
function requireRunning(room, now) {
  if (room.turn.status !== 'running' || now < room.turn.startedAt) fail('اول نوبت را شروع کن و منتظر پایان شمارش معکوس باش.', 'NOT_RUNNING');
}
const textValue = value => {
  const text = String(value ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim();
  if (text.length > 160) fail('متن هر کارت حداکثر ۱۶۰ حرف است.', 'TEXT_TOO_LONG');
  return text;
};
function ownCard(room, actor, cardId) {
  if (room.phase !== 'writing' || actor.ready) fail('برای ویرایش، آمادگی‌ات را بردار.', 'CARDS_LOCKED');
  const card = room.cards.find(c => c.id === cardId && c.authorId === actor.id);
  if (!card) fail('این کارت متعلق به تو نیست.', 'NOT_YOUR_CARD');
  return card;
}
function beginPlaying(room, random) {
  room.assignments = dealCards(room.players, room.cards, room.cardsPerPlayer, random);
  room.order = shuffle(room.players.map(p => p.id), random);
  room.phase = 'playing'; room.turnIndex = 0; room.results = []; room.turn = newTurn(room);
}
function finishTurn(room, success, now) {
  const t = room.turn;
  const result = {
    turnId: t.id, playerId: t.playerId, cardId: t.cardId, success,
    questionsUsed: LIMITS.questions - t.remaining, score: success ? t.remaining : 0,
    elapsedMs: elapsedTime(t, now), endedAt: now
  };
  t.elapsedMs = result.elapsedMs; t.startedAt = null; t.status = 'result'; t.result = result;
  room.results.push(result);
  if (room.results.length === room.players.length * room.cardsPerPlayer) room.phase = 'finished';
}
function resetGame(room) {
  room.phase = 'lobby'; room.generation++; room.players.forEach(p => p.ready = false);
  room.cards = []; room.assignments = {}; room.order = []; room.turn = null; room.turnIndex = 0; room.results = [];
}
export function applyAction(input, actorId, action, data = {}, context = {}) {
  actorId = canonicalId(actorId);
  const { now = Date.now(), requestId = randomUUID(), random, presence = {} } = context;
  const requestKey = `${actorId}:${requestId}`;
  if (input.requests.includes(requestKey)) return { room: input, changed: false };
  if (input.phase === 'closed') throw new GameError('این لابی بسته شده است.', 410, 'ROOM_CLOSED');
  const room = structuredClone(input);
  const actor = room.players.find(p => p.id === actorId);
  if (!actor) throw new GameError('دیگر عضو این لابی نیستی.', 401, 'UNAUTHORIZED');
  if (data.generation !== undefined && data.generation !== room.generation) fail('بازی تازه شروع شده؛ صفحه را به‌روز کن.', 'STALE_GAME');
  if (data.turnId !== undefined && data.turnId !== room.turn?.id) fail('نوبت عوض شده؛ صفحه را به‌روز کن.', 'STALE_TURN');
  switch (action) {
    case 'setCount':
      requireHost(room, actor);
      if (room.phase !== 'lobby') fail('تنظیمات پس از شروع قفل می‌شوند.', 'ROOM_LOCKED');
      room.cardsPerPlayer = cardCount(data.count); room.players.forEach(p => p.ready = false); break;
    case 'readyLobby':
      if (room.phase !== 'lobby') fail('مرحلهٔ ورود تمام شده.', 'WRONG_PHASE');
      actor.ready = Boolean(data.ready); break;
    case 'startWriting':
      requireHost(room, actor);
      if (room.phase !== 'lobby' || room.players.length < LIMITS.minPlayers || room.players.some(p => !p.ready)) fail('حداقل دو نفر و آمادگی همه لازم است.', 'NOT_READY');
      room.phase = 'writing'; room.players.forEach(p => p.ready = false);
      room.cards = room.players.flatMap(p => Array.from({ length: room.cardsPerPlayer }, () => ({ id: randomUUID(), authorId: p.id, text: '', imagePath: null, imageUrl: null })));
      break;
    case 'saveCard': {
      const card = ownCard(room, actor, data.cardId); card.text = textValue(data.text); break;
    }
    case '_attachImage': {
      const card = ownCard(room, actor, data.cardId); card.imagePath = data.imagePath; card.imageUrl = data.imageUrl; break;
    }
    case 'removeImage': {
      const card = ownCard(room, actor, data.cardId); card.imagePath = null; card.imageUrl = null; break;
    }
    case 'readyWriting': {
      if (room.phase !== 'writing') fail('مرحلهٔ کارت‌سازی تمام شده.', 'WRONG_PHASE');
      if (data.ready) {
        const own = room.cards.filter(c => c.authorId === actor.id);
        if (data.cards) {
          if (actor.ready) fail('برای ویرایش، آمادگی‌ات را بردار.', 'CARDS_LOCKED');
          if (!Array.isArray(data.cards) || data.cards.length !== room.cardsPerPlayer || new Set(data.cards.map(c => c.id)).size !== room.cardsPerPlayer) fail('همهٔ کارت‌ها را تکمیل کن.', 'INCOMPLETE');
          for (const item of data.cards) {
            const card = own.find(c => c.id === item.id);
            if (!card) fail('کارت نامعتبر است.', 'NOT_YOUR_CARD');
            card.text = textValue(item.text);
          }
        }
        if (own.length !== room.cardsPerPlayer || own.some(c => !c.text)) fail('برای همهٔ کارت‌ها متن بنویس؛ عکس به‌تنهایی کافی نیست.', 'INCOMPLETE');
      }
      actor.ready = Boolean(data.ready);
      if (room.players.every(p => p.ready)) beginPlaying(room, random);
      break;
    }
    case 'start':
      requireReferee(room, actor);
      if (room.turn.status !== 'waiting') fail('این نوبت قبلاً شروع شده.', 'ALREADY_STARTED');
      room.turn.status = 'running'; room.turn.startedAt = now + 3000; break;
    case 'question':
      requireReferee(room, actor); requireRunning(room, now);
      if (room.turn.remaining <= 0) fail('۲۰ سؤال تمام شده؛ پاسخ آخر را داوری کن.', 'NO_QUESTIONS');
      room.turn.questionHistory.push(room.turn.remaining); room.turn.remaining--; break;
    case 'undoQuestion':
      requireReferee(room, actor); requireRunning(room, now);
      if (!room.turn.questionHistory.length) fail('سؤالی برای برگرداندن نداریم.', 'NOTHING_TO_UNDO');
      room.turn.remaining = room.turn.questionHistory.pop(); break;
    case 'correct':
      requireReferee(room, actor); requireRunning(room, now); finishTurn(room, true, now); break;
    case 'failed':
      requireReferee(room, actor); requireRunning(room, now);
      if (room.turn.remaining !== 0) fail('هنوز سؤال باقی مانده است.', 'QUESTIONS_LEFT');
      finishTurn(room, false, now); break;
    case 'pause':
      requireTurn(room);
      if (!isHost(room, actor) && room.turn.refereeId !== actor.id) fail('داور یا مدیر می‌تواند مکث کند.', 'REFEREE_ONLY');
      if (room.turn.status !== 'running') return { room: input, changed: false };
      room.turn.elapsedMs = elapsedTime(room.turn, now); room.turn.startedAt = null; room.turn.status = 'paused'; room.turn.pauseReason = 'manual'; break;
    case 'autoPause': {
      requireTurn(room);
      if (room.turn.status !== 'running') return { room: input, changed: false };
      const missing = [room.turn.playerId, room.turn.refereeId].filter(id => now - (presence[id] ?? now) > 20000);
      if (!missing.length) return { room: input, changed: false };
      room.turn.elapsedMs = elapsedTime(room.turn, now); room.turn.startedAt = null; room.turn.status = 'paused'; room.turn.pauseReason = 'connection'; break;
    }
    case 'resume':
      requireReferee(room, actor);
      if (room.turn.status !== 'paused') fail('بازی در مکث نیست.', 'NOT_PAUSED');
      room.turn.status = 'running'; room.turn.startedAt = now + 1000; room.turn.pauseReason = null; break;
    case 'next':
      requireTurn(room);
      if (actor.id !== room.turn.refereeId && !isHost(room, actor)) fail('داور نوبت بعد را شروع می‌کند.', 'REFEREE_ONLY');
      if (room.turn.status !== 'result') fail('اول نتیجهٔ این نوبت را ثبت کن.', 'NOT_FINISHED');
      room.turnIndex++; room.turn = newTurn(room); break;
    case 'setReferee': {
      requireHost(room, actor); requireTurn(room);
      if (!room.players.some(p => p.id === data.playerId) || data.playerId === room.turn.playerId) fail('داور باید یکی از بقیهٔ بازیکن‌ها باشد.', 'BAD_REFEREE');
      room.turn.refereeId = data.playerId; break;
    }
    case 'transferHost':
      requireHost(room, actor);
      if (!room.players.some(p => p.id === data.playerId)) fail('بازیکن پیدا نشد.', 'BAD_PLAYER');
      room.hostId = data.playerId; break;
    case 'claimHost':
      if (now - (presence[room.hostId] ?? room.createdAt) < 45000) fail('مدیر هنوز متصل است.', 'HOST_ONLINE');
      room.hostId = actor.id; break;
    case 'kick': {
      requireHost(room, actor);
      if (!room.players.some(p => p.id === data.playerId)) fail('بازیکن پیدا نشد.', 'BAD_PLAYER');
      if (data.playerId === actor.id || data.playerId === canonicalId(room.creatorId ?? context.creatorId)) fail('سازندهٔ لابی را نمی‌توان حذف کرد؛ برای خروج او لابی را ببند.', 'CREATOR_REQUIRED');
      if (room.phase !== 'lobby' && !data.confirm) fail('حذف بازیکن در این مرحله، بازی را از اول شروع می‌کند؛ تأیید کن.', 'CONFIRM_KICK');
      room.players = room.players.filter(p => p.id !== data.playerId);
      if (room.phase !== 'lobby') resetGame(room);
      else room.players.forEach(p => p.ready = false);
      break;
    }
    case 'closeRoom':
      if (!isHost(room, actor) && actor.id !== canonicalId(room.creatorId ?? context.creatorId)) fail('مدیر یا سازنده می‌تواند لابی را ببندد.', 'HOST_ONLY');
      resetGame(room); room.phase = 'closed'; room.closedAt = now; room.expiresAt = now;
      break;
    case 'leave':
      if (room.phase !== 'lobby') fail('پس از کارت‌سازی، جای بازیکن حفظ می‌شود تا برگردد.', 'ROOM_LOCKED');
      room.players = room.players.filter(p => p.id !== actor.id);
      if (room.hostId === actor.id && room.players.length) room.hostId = room.players[0].id;
      break;
    case 'reset':
      requireHost(room, actor);
      if (room.phase !== 'finished' && !data.confirm) fail('شروع دوباره باید تأیید شود.', 'CONFIRM_RESET');
      resetGame(room);
      break;
    default: fail('درخواست نامعتبر است.', 'UNKNOWN_ACTION');
  }
  room.requests = [...room.requests.slice(-299), requestKey];
  return { room, changed: true };
}
export function leaderboard(room) {
  const rows = room.players.map(p => {
    const turns = room.results.filter(r => r.playerId === p.id);
    return { playerId: p.id, name: p.name, score: turns.reduce((a, r) => a + r.score, 0), elapsedMs: turns.reduce((a, r) => a + r.elapsedMs, 0), correct: turns.filter(r => r.success).length, completed: turns.length };
  }).sort((a, b) => b.score - a.score || a.elapsedMs - b.elapsedMs || a.name.localeCompare(b.name, 'fa'));
  rows.forEach((row, i) => row.rank = i && row.score === rows[i - 1].score && row.elapsedMs === rows[i - 1].elapsedMs ? rows[i - 1].rank : i + 1);
  return rows;
}
export function snapshot(room, actorId, revision = 0, now = Date.now(), presence = {}) {
  actorId = canonicalId(actorId);
  const actor = room.players.find(p => p.id === actorId);
  if (!actor) throw new GameError('دیگر عضو این لابی نیستی.', 401, 'UNAUTHORIZED');
  const cardView = card => ({ id: card.id, text: card.text, imageUrl: card.imageUrl, authorId: card.authorId, authorName: room.players.find(p => p.id === card.authorId)?.name ?? '' });
  const currentCard = room.turn && room.turn.status !== 'waiting' ? room.cards.find(c => c.id === room.turn.cardId) : null;
  return {
    id: room.id, code: room.code, generation: room.generation, revision, phase: room.phase,
    hostId: room.hostId, creatorId: room.creatorId, you: actorId, cardsPerPlayer: room.cardsPerPlayer, serverNow: now, expiresAt: room.expiresAt,
    players: room.players.map(p => ({ id: p.id, name: p.name, ready: p.ready, online: now - (presence[p.id] ?? p.joinedAt) < 25000,
      cardProgress: room.cards.filter(c => c.authorId === p.id && c.text.trim()).length })),
    ownCards: room.phase === 'writing' ? room.cards.filter(c => c.authorId === actorId).map(cardView) : [],
    order: room.order, turnIndex: room.turnIndex, totalTurns: room.players.length * room.cardsPerPlayer,
    turn: room.turn ? { ...room.turn, questionHistory: undefined, canUndo: room.turn.questionHistory.length > 0, elapsedMs: room.turn.elapsedMs, card: currentCard ? cardView(currentCard) : null } : null,
    scores: leaderboard(room),
    completedCards: room.phase === 'finished' ? room.results.map(r => ({ ...r, card: cardView(room.cards.find(c => c.id === r.cardId)) })) : []
  };
}
