const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises'),syncFs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),Module=require('node:module');
const babel=require('@babel/core');
const nativeModules={};
const root=path.resolve('.test-private-files');
const filePath=uri=>uri.replace(/^file:\/\//,'');
const expoFS={cacheDirectory:`file://${root}/`,getInfoAsync:async uri=>{const s=await fs.stat(filePath(uri));return{exists:true,size:s.size};},makeDirectoryAsync:(uri)=>fs.mkdir(filePath(uri),{recursive:true}),deleteAsync:uri=>fs.rm(filePath(uri),{recursive:true,force:true}),
 readAsStringAsync:async(uri,opts)=>{const b=await fs.readFile(filePath(uri));return b.subarray(opts.position||0,opts.length===undefined?undefined:(opts.position||0)+opts.length).toString('base64');},
 writeAsStringAsync:(uri,value)=>fs.writeFile(filePath(uri),Buffer.from(value,'base64'))};
const load=Module._load;Module._load=function(name,parent,isMain){
 if(name==='react-native')return{NativeModules:nativeModules};
 if(name==='expo-file-system')return expoFS;
 if(name==='expo-crypto')return{randomUUID:crypto.randomUUID,getRandomBytesAsync:async n=>new Uint8Array(crypto.randomBytes(n))};
 if(name==='react-native-file-access')return{FileSystem:{writeFile:(p,v)=>fs.writeFile(p,Buffer.from(v,'base64')),appendFile:(p,v)=>fs.appendFile(p,Buffer.from(v,'base64'))}};
 return load.call(this,name,parent,isMain);
};
const original=Module._extensions['.js'];Module._extensions['.js']=function(mod,filename){if(filename.includes('/src/services/'))mod._compile(babel.transformFileSync(filename,{configFile:false,plugins:['@babel/plugin-transform-modules-commonjs']}).code,filename);else original(mod,filename);};
const p=require('../src/services/privateFiles');const core=require('../src/services/cryptoCore');
test('chunked files round-trip, tampering/cancellation delete partially decrypted output',async()=>{
 await fs.mkdir(root,{recursive:true});
 try{
 const source=crypto.randomBytes(2*core.CHUNK_BYTES+31);const sourcePath=`file://${root}/source.bin`;await fs.writeFile(filePath(sourcePath),source);
 const m=await p.prepareManifest({uri:sourcePath,type:'video',mimeType:'video/mp4'});assert.equal(m.chunks,3);
 const parts=[];for(let i=0;i<m.chunks;i++){const uri=`file://${root}/part-${i}`;await p.encryptedPart(sourcePath,m,i,uri);parts.push(new Uint8Array(await fs.readFile(filePath(uri))));}
 const output=await p.assemblePrivateFile(m,async i=>parts[i]);assert.deepEqual(await fs.readFile(filePath(output)),source);await p.removePrivateFile(output);
 let inflight=0, maximum=0;
 const parallel=await p.assemblePrivateFile(m,async i=>{maximum=Math.max(maximum,++inflight);await new Promise(r=>setTimeout(r,(3-i)*2));inflight--;return parts[i];},async()=>{},3);
 assert.equal(maximum,3);assert.deepEqual(await fs.readFile(filePath(parallel)),source);await p.removePrivateFile(parallel);
 await assert.rejects(p.assemblePrivateFile(m,async i=>{inflight++;try{if(i===0)throw Error('download failed');await new Promise(r=>setTimeout(r,5));return parts[i];}finally{inflight--;}},async()=>{},3),/download failed/);
 assert.equal(inflight,0);assert.deepEqual(await fs.readdir(filePath(p.privateCache)),[]);
 nativeModules.SaveMeCrypto={decryptFileAppend:async(source,target,length,key,nonce,aad)=>{
  const data=await fs.readFile(filePath(source));const decipher=crypto.createDecipheriv('aes-256-gcm',Buffer.from(key,'base64'),Buffer.from(nonce,'base64'));decipher.setAAD(Buffer.from(aad,'base64'));decipher.setAuthTag(data.subarray(-16));const plain=Buffer.concat([decipher.update(data.subarray(0,-16)),decipher.final()]);assert.equal(plain.length,length);await fs.appendFile(filePath(target),plain);
 }};
 const direct=await p.assemblePrivateFile(m,async i=>{const uri=p.privateCache+`download-${i}.bin`;await fs.writeFile(filePath(uri),parts[i]);return{uri};},async()=>{},3);
 assert.deepEqual(await fs.readFile(filePath(direct)),source);await p.removePrivateFile(direct);assert.deepEqual(await fs.readdir(filePath(p.privateCache)),[]);
 await assert.rejects(p.assemblePrivateFile(m,async i=>{if(i===0)throw Error('network');const uri=p.privateCache+`cancel-${i}.bin`;await fs.writeFile(filePath(uri),parts[i]);return{uri};},async()=>{},3),/network/);
 assert.deepEqual(await fs.readdir(filePath(p.privateCache)),[],'all successful prefetch files are removed after a sibling failure');
 delete nativeModules.SaveMeCrypto;
 const bad=parts.map(x=>new Uint8Array(x));bad[1][50]^=1;
 await assert.rejects(p.assemblePrivateFile(m,async i=>bad[i]));
 assert.deepEqual(await fs.readdir(filePath(p.privateCache)),[]);
 let calls=0;await assert.rejects(p.assemblePrivateFile(m,async i=>parts[i],async()=>{if(++calls>1)throw new Error('background');}),/background/);
 assert.deepEqual(await fs.readdir(filePath(p.privateCache)),[]);
 await assert.rejects(p.assemblePrivateFile({...m,chunks:1},async i=>parts[i]),/Invalid encrypted file/);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
