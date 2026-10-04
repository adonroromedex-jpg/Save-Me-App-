const {test}=require('node:test'),assert=require('node:assert/strict'),Module=require('node:module'),path=require('node:path'),babel=require('@babel/core');
const filename=path.resolve('src/services/transferQueue.js'),mod=new Module(filename,module);
mod._compile(babel.transformFileSync(filename,{configFile:false,plugins:['@babel/plugin-transform-modules-commonjs']}).code,filename);
const {transferQueue}=mod.exports;
test('uploads are bounded and failure waits for in-flight requests before cleanup',async()=>{
 let running=0,maximum=0;const done=[];
 await transferQueue(10,async i=>{maximum=Math.max(maximum,++running);await new Promise(r=>setTimeout(r,2));done.push(i);running--;});
 assert.equal(maximum,3);assert.equal(done.length,10);assert.equal(running,0);
 const started=[];
 await assert.rejects(transferQueue(10,async i=>{started.push(i);running++;try{if(i===0)throw Error('offline');await new Promise(r=>setTimeout(r,5));}finally{running--;}}),/offline/);
 assert.equal(running,0);assert.ok(started.length<=3);
});
