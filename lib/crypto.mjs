import {sha256} from '@noble/hashes/sha2.js';
import {bytesToHex} from '@noble/hashes/utils.js';

export const randomUUID = () => globalThis.crypto.randomUUID();
export const hash = value => bytesToHex(sha256(new TextEncoder().encode(String(value))));
export function token() {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
export function roomCode() {
  const buffer = new Uint32Array(1), size = 900000, limit = Math.floor(2**32 / size) * size;
  do { globalThis.crypto.getRandomValues(buffer); } while (buffer[0] >= limit);
  return String(100000 + buffer[0] % size);
}
export function equalHash(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let difference = 0;
  for (let i=0;i<a.length;i++) difference |= a.charCodeAt(i)^b.charCodeAt(i);
  return difference === 0;
}
