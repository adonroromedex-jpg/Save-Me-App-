const {test}=require('node:test'),assert=require('node:assert/strict'),Module=require('node:module'),path=require('node:path'),babel=require('@babel/core');
const React=require('react'),renderer=require('react-test-renderer');
const now=Date.now();let incoming=[{id:'old',sender_id:'bob',created_at:new Date(now-86400000).toISOString(),read_at:null}],callback;
const scheduled=[],dismissed=[],marked=[];const state={user:{id:'alice'},activeChat:null,isLocked:false,setSyncIssue(){},setUnread(){},openPeer(){}};
const useStore=selector=>selector(state);useStore.getState=()=>state;
const Notifications={addNotificationResponseReceivedListener:()=>({remove(){}}),getLastNotificationResponseAsync:async()=>null,getPermissionsAsync:async()=>({granted:true}),scheduleNotificationAsync:async n=>scheduled.push(n),getPresentedNotificationsAsync:async()=>[{request:{identifier:'read-old',content:{data:{recipient:'alice',sender:'bob',messageId:'read'}}}}],dismissNotificationAsync:async id=>dismissed.push(id),setBadgeCountAsync:async()=>{}};
const db={from:()=>{let count=false;return{select: function(_,options){count=!!options;return this},eq(){return this},is(){return this},limit(){return this},then(resolve){resolve(count?{count:0}:{data:incoming})}}},channel:()=>({on(_,__,fn){callback=fn;return this},subscribe(){return this}}),removeChannel(){}};
const t=x=>x,original=Module._load;Module._load=function(name,parent,isMain){
 if(name==='react-native')return{AppState:{currentState:'active',addEventListener:()=>({remove(){}})}};
 if(name==='react-i18next')return{useTranslation:()=>({t})};
 if(name==='../store/useStore')return{useStore};
 if(name==='../services/supabase')return{getSupabaseClient:()=>db};
 if(name==='../services/messages')return{markMessages:async ids=>marked.push(ids)};
 if(name==='../services/notifications')return{Notifications};
 return original.call(this,name,parent,isMain);
};
const file=path.resolve('src/hooks/useIncomingMessages.js'),mod=new Module(file,module);mod.paths=module.paths;mod._compile(babel.transformFileSync(file,{configFile:false,plugins:['@babel/plugin-transform-modules-commonjs']}).code,file);
function Host(){mod.exports.default();return null;}
test('old inbox is acknowledged silently, read notifications are removed, new messages notify once',async()=>{
 let view;await renderer.act(async()=>{view=renderer.create(React.createElement(Host));await new Promise(setImmediate)});
 assert.equal(scheduled.length,0);assert.deepEqual(marked[0],['old']);assert.ok(dismissed.includes('read-old'));
 incoming=[{id:'fresh',sender_id:'bob',created_at:new Date(Date.now()+100).toISOString(),read_at:null}];
 await renderer.act(async()=>{await callback()});assert.equal(scheduled.length,1);assert.equal(scheduled[0].content.data.messageId,'fresh');
 await renderer.act(async()=>{await callback()});assert.equal(scheduled.length,1);
 renderer.act(()=>view.unmount());
});
