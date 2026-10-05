const {test}=require('node:test'),assert=require('node:assert/strict'),Module=require('node:module'),path=require('node:path'),babel=require('@babel/core');
const saved=new Map(),keys=new Map([['alice',{public_key:'original',version:1}],['bob',{public_key:'peer-new',version:2}]]);
let failResponse=true,rotations=0;
const encode=v=>Buffer.from(v).toString('base64');
const db={auth:{getSession:async()=>({data:{session:{user:{id:'alice'}}}})},rpc:async(name,args)=>{
 if(name==='get_chat_key')return{data:keys.get(args.p_peer)?.public_key};
 if(name==='get_chat_identity')return{data:keys.get(args.p_peer)};
 if(name==='register_chat_key')return{data:keys.get('alice').public_key};
 if(name==='restart_chat_identity'){
  assert.ok(saved.has('chat-restart-v1-alice'),'draft stored before server mutation');assert.equal(saved.get('chat-identity-v1-alice'),encode(new Uint8Array(32).fill(2)),'old key preserved before commit');
  assert.equal(args.p_expected,keys.get('alice').public_key);keys.set('alice',{public_key:args.p_key,version:2});rotations++;
  if(failResponse){failResponse=false;return{error:new Error('network response lost')}}return{data:args.p_key};
 }
 throw new Error('unexpected RPC');
}};
const original=Module._load;Module._load=function(name,parent,isMain){
 if(name==='react-native')return{AppState:{currentState:'active'}};
 if(name==='../store/useStore')return{useStore:{getState:()=>({user:{id:'alice'},isLocked:false})}};
 if(name==='expo-secure-store')return{getItemAsync:async k=>saved.get(k),setItemAsync:async(k,v)=>saved.set(k,v),deleteItemAsync:async k=>saved.delete(k)};
 if(name==='expo-crypto')return{getRandomBytesAsync:async()=>new Uint8Array(32).fill(7)};
 if(name==='./supabase')return{getSupabaseClient:()=>db};
 if(name==='./cryptoCore')return{encode,decode:v=>new Uint8Array(Buffer.from(v,'base64')),keyPair:secret=>({publicKey:secret,secretKey:secret}),fingerprint:s=>Buffer.from(s).toString('hex')};
 return original.call(this,name,parent,isMain);
};
const file=path.resolve('src/services/identity.js'),mod=new Module(file,module);mod.paths=module.paths;mod._compile(babel.transformFileSync(file,{configFile:false,plugins:['@babel/plugin-transform-modules-commonjs']}).code,file);
const service=mod.exports;
test('restart survives a lost response, preserves old secrets and requires explicit approval for rotated peer keys',async()=>{
 saved.set('chat-identity-v1-alice',encode(new Uint8Array(32).fill(2)));
 await assert.rejects(service.restartIdentity('alice'),/network response lost/);
 assert.ok(saved.has('chat-restart-v1-alice'));
 const own=await service.ensureIdentity('alice');assert.equal(own.publicKey,keys.get('alice').public_key);assert.equal(saved.has('chat-restart-v1-alice'),false);
 assert.ok([...saved.keys()].some(k=>k.startsWith('chat-identity-archive-')));
 await service.restartIdentity('alice');assert.equal(rotations,1,'healthy key is never rotated again');
 await assert.rejects(service.peerIdentity('alice','bob'),e=>e.code==='PEER_KEY_CHANGED');assert.equal(saved.has('peer-key-alice-bob'),false);
 const review=await service.peerKeyReview('alice','bob');assert.equal(review.changed,true);
 keys.set('bob',{public_key:'peer-newer',version:3});await assert.rejects(service.acceptPeerIdentity('alice','bob',review.key),/chanje ankò/);
 assert.equal(saved.has('peer-key-alice-bob'),false);
 await service.acceptPeerIdentity('alice','bob','peer-newer');assert.equal(await service.peerIdentity('alice','bob'),'peer-newer');
});
