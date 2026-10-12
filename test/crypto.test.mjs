import test from 'node:test';
import assert from 'node:assert/strict';
import { secureRandomInt, roomCode } from '../lib/crypto.mjs';
import { shuffle } from '../lib/game.mjs';

function supplyDraws(t, draws) {
  return t.mock.method(globalThis.crypto,'getRandomValues',buffer=>{
    assert.ok(buffer instanceof Uint32Array);assert.equal(buffer.length,1);
    assert.ok(draws.length,'unexpected extra crypto draw');buffer[0]=draws.shift();return buffer;
  });
}

test('secure random integers reject the surplus Uint32 tail instead of biasing low outcomes',t=>{
  const draws=[4294967290,4294967295,4294967289],mock=supplyDraws(t,draws);
  assert.equal(secureRandomInt(10),9);assert.equal(mock.mock.callCount(),3);assert.equal(draws.length,0);
});

test('secure random integer boundaries include every valid index and reject invalid bounds before drawing',t=>{
  const mock=supplyDraws(t,[4294967295,4294967295]);
  assert.equal(secureRandomInt(1),0);assert.equal(secureRandomInt(2**32),4294967295);
  for(const bound of [0,-1,1.5,Number.NaN,Infinity,2**32+1])assert.throws(()=>secureRandomInt(bound),RangeError);
  assert.equal(mock.mock.callCount(),2);
});

test('the accepted full buckets give each integer the same number of preimages',t=>{
  supplyDraws(t,Array.from({length:20},(_,i)=>i));
  const counts=Array(10).fill(0);
  for(let i=0;i<20;i++)counts[secureRandomInt(10)]++;
  assert.deepEqual(counts,Array(10).fill(2));
});

test('default Fisher–Yates consumes bounded crypto draws while injected deterministic randomness stays usable',t=>{
  const mock=supplyDraws(t,[0,0]);
  assert.deepEqual(shuffle(['a','b','c']),['b','c','a']);assert.equal(mock.mock.callCount(),2);
  assert.deepEqual(shuffle(['a','b','c'],()=>0.999999),['a','b','c']);assert.equal(mock.mock.callCount(),2);
});

test('six-digit room codes use the same rejection boundary and include both range endpoints',t=>{
  const bound=900000,limit=Math.floor(2**32/bound)*bound,mock=supplyDraws(t,[limit,0,899999]);
  assert.equal(roomCode(),'100000');assert.equal(roomCode(),'999999');assert.equal(mock.mock.callCount(),3);
});
