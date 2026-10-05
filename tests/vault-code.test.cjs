const {test}=require('node:test'),assert=require('node:assert/strict'),Module=require('node:module'),path=require('node:path'),crypto=require('node:crypto'),babel=require('@babel/core');
const entries=new Map(),native={};
const original=Module._load;
Module._load=function(name,parent,isMain){
 if(name==='react-native')return{NativeModules:native,Platform:{Version:34}};
 if(name==='expo-secure-store')return{WHEN_UNLOCKED_THIS_DEVICE_ONLY:1,getItemAsync:async k=>entries.get(k)||null,setItemAsync:async(k,v)=>entries.set(k,v),deleteItemAsync:async k=>entries.delete(k)};
 if(name==='expo-crypto')return{getRandomBytesAsync:async n=>new Uint8Array(crypto.randomBytes(n))};
 return original.call(this,name,parent,isMain);
};
const old=Module._extensions['.js'];Module._extensions['.js']=function(mod,filename){if(filename.includes('/src/services/'))mod._compile(babel.transformFileSync(filename,{configFile:false,plugins:['@babel/plugin-transform-modules-commonjs']}).code,filename);else old(mod,filename);};
const {unlockVaultKey,hasVaultCode}=require('../src/services/vaultCode');
test('one existing vault PIN reopens the same master on JS and native KDF; a new arbitrary PIN is rejected',async()=>{
 assert.equal(await hasVaultCode('owner'),false);
 const first=await unlockVaultKey('owner','012345');assert.equal(await hasVaultCode('owner'),true);
 const second=await unlockVaultKey('owner','012345');assert.deepEqual(second,first);
 native.SaveMeCrypto={deriveVaultKey:async(pin,salt)=>crypto.pbkdf2Sync(pin,Buffer.from(salt,'base64'),210000,32,'sha256').toString('base64')};
 assert.deepEqual(await unlockVaultKey('owner','012345'),first);
 await assert.rejects(unlockVaultKey('owner','123456'),/pa kòrèk/);
 assert.deepEqual(await unlockVaultKey('owner','012345'),first,'wrong entry never replaces the original code/master');
});
