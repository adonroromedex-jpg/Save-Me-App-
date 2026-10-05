const {test}=require('node:test'),assert=require('node:assert/strict'),Module=require('node:module'),path=require('node:path'),babel=require('@babel/core');
function load(file){const m=new Module(path.resolve(file),module);m.paths=module.paths;m._compile(babel.transformFileSync(file,{configFile:false,plugins:['@babel/plugin-transform-modules-commonjs']}).code,path.resolve(file));return m.exports;}
const {useStore}=load('src/store/useStore.js');const original=Module._load;Module._load=function(name,parent,isMain){if(name==='../store/useStore')return{useStore};return original.call(this,name,parent,isMain)};
const {waitForAccountUnlock}=load('src/services/accountAccess.js');
test('selected files wait behind biometric lock, account switch rejects old operations and clears old UI',async()=>{
 useStore.getState().setUser({id:'a'});assert.equal(useStore.getState().isLocked,true);
 let ready=false;const selection=waitForAccountUnlock('a').then(()=>ready=true);await Promise.resolve();assert.equal(ready,false);
 useStore.getState().unlockApp();await selection;assert.equal(ready,true);
 useStore.getState().setFiles(['a-file']);useStore.getState().setUnread(9);useStore.getState().setActiveChat('a-peer');
 useStore.getState().lockApp();const rejected=assert.rejects(waitForAccountUnlock('a'),/Sesyon/);
 useStore.getState().setUser({id:'b'});await rejected;
 assert.deepEqual(useStore.getState().files,[]);assert.equal(useStore.getState().unread,0);assert.equal(useStore.getState().activeChat,null);assert.equal(useStore.getState().isLocked,true);
});
