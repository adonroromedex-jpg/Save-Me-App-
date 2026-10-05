const { test } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');
const babel = require('@babel/core');
let level = 0, types = [], calls = 0, authenticated = false, lastOptions;
const native = {
  SecurityLevel: { NONE: 0, SECRET: 1, BIOMETRIC: 2 },
  AuthenticationType: { FINGERPRINT: 1, FACIAL_RECOGNITION: 2 },
  getEnrolledLevelAsync: async () => level,
  supportedAuthenticationTypesAsync: async () => types,
  authenticateAsync: async options => { calls++; lastOptions = options; return { success: authenticated }; },
};
const originalLoad = Module._load;
Module._load = function (name, parent, isMain) {
  if (name === 'expo-local-authentication') return native;
  if (name === 'expo-secure-store') return {};
  return originalLoad.call(this, name, parent, isMain);
};
const filename = path.resolve('src/services/biometrics.js');
const mod = new Module(filename, module); mod.paths = module.paths;
mod._compile(babel.transformFileSync(filename, { configFile: false, plugins: ['@babel/plugin-transform-modules-commonjs'] }).code, filename);
const service = mod.exports;
test('biometric enrollment is mandatory; device PIN fallback and cancelled scans cannot unlock', async () => {
  level = 1; types = []; authenticated = true;
  assert.equal(await service.getBiometricType(), 'none');
  assert.equal((await service.authenticate('Unlock')).success, false);
  assert.equal(calls,0);
  level=2;types=[1];
  assert.equal(await service.getBiometricType(),'fingerprint');
  assert.equal((await service.authenticate('Unlock')).success,true);
  assert.equal(lastOptions.disableDeviceFallback,true);
  authenticated=false;
  assert.equal((await service.authenticate('Unlock')).success,false);
  level=0;types=[1];
  assert.equal(await service.getBiometricType(),'none');
  const before=calls;
  assert.equal((await service.authenticate()).success,false);
  assert.equal(calls,before);
});
