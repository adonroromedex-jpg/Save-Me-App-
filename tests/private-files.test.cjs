const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises'),syncFs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),Module=require('node:module');
const babel=require('@babel/core');
const root=path.resolve('.test-private-files');
const filePath=uri=>uri.replace(/^file:\/\//,'');
const expoFS={cacheDirectory:`file://${root}/`,getInfoAsync:async uri=>{const s=await fs.stat(filePath(uri));return{exists:true,size:s.size};},makeDirectoryAsync:(uri)=>fs.mkdir(filePath(uri),{recursive:true}),deleteAsync:uri=>fs.rm(filePath(uri),{recursive:true,force:true}),
 readAsStringAsync:async(uri,opts)=>{const b=await fs.readFile(filePath(uri));return b.subarray(opts.position||0,opts.length===undefined?undefined:(opts.position||0)+opts.length).toString('base64');},
 writeAsStringAsync:(uri,value)=>fs.writeFile(filePath(uri),Buffer.from(value,'base64'))};
const load=Module._load;Module._load=function(name,parent,isMain){
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
 const bad=parts.map(x=>new Uint8Array(x));bad[1][50]^=1;
 await assert.rejects(p.assemblePrivateFile(m,async i=>bad[i]));
 assert.deepEqual(await fs.readdir(filePath(p.privateCache)),[]);
 let calls=0;await assert.rejects(p.assemblePrivateFile(m,async i=>parts[i],async()=>{if(++calls>1)throw new Error('background');}),/background/);
 assert.deepEqual(await fs.readdir(filePath(p.privateCache)),[]);
 await assert.rejects(p.assemblePrivateFile({...m,chunks:1},async i=>parts[i]),/Invalid encrypted file/);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
