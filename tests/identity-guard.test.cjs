const {test}=require('node:test'),assert=require('node:assert/strict'),Module=require('node:module'),path=require('node:path'),babel=require('@babel/core');
let session='alice',registered=null,randomCalls=0,writes=0;const saved=new Map();
const db={auth:{getSession:async()=>({data:{session:{user:{id:session}}}})},rpc:async(name,args)=>({data:name==='get_chat_key'?registered:(registered ||= args.p_key)})};
const original=Module._load;Module._load=function(name,parent,isMain){
 if(name==='react-native')return {AppState:{currentState:'active'}};
 if(name==='../store/useStore')return {useStore:{getState:()=>({user:{id:session},isLocked:false})}};
 if(name==='expo-secure-store')return{getItemAsync:async k=>saved.get(k),setItemAsync:async(k,v)=>{writes++;saved.set(k,v)}};
 if(name==='expo-crypto')return{getRandomBytesAsync:async()=>{randomCalls++;return new Uint8Array(32).fill(7)}};
 if(name==='./supabase')return{getSupabaseClient:()=>db};
 if(name==='./cryptoCore')return{encode:v=>Buffer.from(v).toString('base64'),decode:v=>new Uint8Array(Buffer.from(v,'base64')),keyPair:secret=>({publicKey:secret,secretKey:secret})};
 return original.call(this,name,parent,isMain);
};
const file=path.resolve('src/services/identity.js'),mod=new Module(file,module);mod.paths=module.paths;mod._compile(babel.transformFileSync(file,{configFile:false,plugins:['@babel/plugin-transform-modules-commonjs']}).code,file);
test('identity preserves registered keys, refuses missing private keys and mismatched sessions',async()=>{
 registered='old-public';await assert.rejects(mod.exports.ensureIdentity('alice'),e=>e.code==='IDENTITY_KEY_MISSING');assert.equal(randomCalls,0);assert.equal(writes,0);assert.equal(registered,'old-public');
 saved.set('chat-identity-v1-alice',Buffer.alloc(32,2).toString('base64'));
 await assert.rejects(mod.exports.ensureIdentity('alice'),e=>e.code==='IDENTITY_KEY_MISMATCH');assert.equal(writes,0);assert.equal(registered,'old-public');
 session='bob';await assert.rejects(mod.exports.ensureIdentity('alice'),/Sesyon/);assert.equal(writes,0);
 registered=null;const pair=await mod.exports.ensureIdentity('bob');assert.equal(pair.publicKey,registered);assert.equal(writes,1);
 await mod.exports.ensureIdentity('bob');assert.equal(writes,1);
});
