const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const fs = require('node:fs');
const Module = require('node:module');
const babel = require('@babel/core');
const filename = require('node:path').resolve('src/services/cryptoCore.js');
const mod = new Module(filename, module); mod.paths = module.paths;
mod._compile(babel.transformFileSync(filename, { configFile:false, plugins:['@babel/plugin-transform-modules-commonjs'] }).code, filename);
const c = mod.exports;
const random = n => new Uint8Array(randomBytes(n));
test('recipient decrypts Unicode content; stranger and modified envelopes cannot', () => {
  const alice=c.keyPair(random(32)), bob=c.keyPair(random(32)), eve=c.keyPair(random(32));
  const body={id:'m1',text:'Bonjou 🇭🇹 — kòd 123456, ñ, è'};
  const envelope=c.seal(body,c.encode(bob.publicKey),alice.secretKey,random(24));
  assert.deepEqual(c.unseal(envelope,c.encode(alice.publicKey),bob.secretKey),body);
  assert.throws(()=>c.unseal(envelope,c.encode(alice.publicKey),eve.secretKey));
  const tampered=c.decode(envelope.box);tampered[20]^=1;
  assert.throws(()=>c.unseal({...envelope,box:c.encode(tampered)},c.encode(alice.publicKey),bob.secretKey));
  assert.throws(()=>c.unseal({...envelope,v:99},c.encode(alice.publicKey),bob.secretKey));
});
test('file chunks authenticate bytes, file identity, ordering, length and MIME', () => {
  const m={id:'m1',kind:'video',mime:'video/mp4',size:2*c.CHUNK_BYTES+17,key:c.encode(random(32)),prefix:c.encode(random(8))};
  const plain=random(c.CHUNK_BYTES), encrypted=c.encryptChunk(plain,m,0);
  assert.deepEqual(c.decryptChunk(encrypted,m,0),plain);
  for(const altered of [{...m,id:'m2'},{...m,size:1},{...m,mime:'image/jpeg'}]) assert.throws(()=>c.decryptChunk(encrypted,altered,0));
  assert.throws(()=>c.decryptChunk(encrypted,m,1));
  assert.throws(()=>c.decryptChunk(encrypted.slice(0,-1),m,0));
  encrypted[99]^=1;assert.throws(()=>c.decryptChunk(encrypted,m,0));
  const last=random(17);assert.deepEqual(c.decryptChunk(c.encryptChunk(last,m,2),m,2),last);
});
test('public-key fingerprints are deterministic and key-dependent',()=>{
  const a=c.encode(random(32)),b=c.encode(random(32));
  assert.equal(c.fingerprint(a),c.fingerprint(a));assert.notEqual(c.fingerprint(a),c.fingerprint(b));
});
