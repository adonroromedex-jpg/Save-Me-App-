const {test}=require('node:test'),assert=require('node:assert/strict'),Module=require('node:module'),path=require('node:path'),babel=require('@babel/core');
const file=path.resolve('src/services/chunkUrls.js'),mod=new Module(file,module);mod.paths=module.paths;mod._compile(babel.transformFileSync(file,{configFile:false,plugins:['@babel/plugin-transform-modules-commonjs']}).code,file);
test('24 chunks share one short-lived signing request; expiry refreshes and invalid indexes never fetch',async()=>{
 let time=0;const calls=[];
 const storage={createSignedUrls:async(paths,seconds)=>{calls.push({paths,seconds});return{data:paths.map(path=>({signedUrl:`https://test/${path}`}))}}};
 const read=mod.exports.chunkUrlReader(storage,'private',48,()=>time);
 for(let start=0;start<48;start+=3){const values=await Promise.all([0,1,2].map(n=>read(start+n)));assert.equal(values[0],`https://test/private/${start}.bin`);}
 assert.equal(calls.length,2,'previous batches of three required 16 signing requests for 48 chunks');
 assert.ok(calls.every(c=>c.seconds===15&&c.paths.length===24));
 time=10001;await read(47);assert.equal(calls.length,3);
 await assert.rejects(read(48),/Invalid/);assert.equal(calls.length,3);
});
