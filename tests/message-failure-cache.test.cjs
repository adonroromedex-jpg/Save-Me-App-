const {test}=require('node:test'),assert=require('node:assert/strict'),Module=require('node:module'),path=require('node:path'),babel=require('@babel/core');
let calls=0,code='OLD_KEY_GENERATION';
const row={id:'old',sender_id:'b',recipient_id:'a',encrypted_body:{version:'old'}};
const original=Module._load;Module._load=function(name,parent,isMain){
 if(name==='./supabase')return{getSupabaseClient:()=>({from:()=>({select(){return this},or(){return this},eq(){return this},order(){return this},limit(){return this},then(resolve){resolve({data:[row]})}})})};
 if(name==='./identity')return{decryptForSelf:async()=>{calls++;const e=new Error('unavailable');e.code=code;throw e}};
 if(name==='../store/useStore')return{useStore:{getState:()=>({user:{id:'a'}})}};
 if(parent?.filename?.endsWith('/services/messages.js'))return{};
 return original.call(this,name,parent,isMain);
};
const file=path.resolve('src/services/messages.js'),mod=new Module(file,module);mod.paths=module.paths;mod.filename=file;mod._compile(babel.transformFileSync(file,{configFile:false,plugins:['@babel/plugin-transform-modules-commonjs']}).code,file);
test('old key generations stop repeated network work; temporary errors and explicit invalidation retry',async()=>{
 const cache=new Map();await mod.exports.listMessages('a','b',null,cache);await mod.exports.listMessages('a','b',null,cache);assert.equal(calls,1);
 cache.clear();await mod.exports.listMessages('a','b',null,cache);assert.equal(calls,2);
 cache.clear();code='NETWORK';await mod.exports.listMessages('a','b',null,cache);await mod.exports.listMessages('a','b',null,cache);assert.equal(calls,4);
});
