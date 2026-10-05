const {test}=require('node:test'),assert=require('node:assert/strict'),Module=require('node:module'),path=require('node:path'),babel=require('@babel/core'),React=require('react'),renderer=require('react-test-renderer');
const listeners=new Set();let locks=0;const state={isAuthenticated:true,isLocked:false,lockApp(){locks++;state.isLocked=true;}};const useStore=selector=>selector(state);useStore.getState=()=>state;
const original=Module._load;Module._load=function(name,parent,isMain){if(name==='react-native')return{AppState:{currentState:'active',addEventListener:(_,fn)=>{listeners.add(fn);return{remove:()=>listeners.delete(fn)}}}};if(name==='../store/useStore')return{useStore};return original.call(this,name,parent,isMain)};
const file=path.resolve('src/hooks/useAutoLock.js'),mod=new Module(file,module);mod.paths=module.paths;mod._compile(babel.transformFileSync(file,{configFile:false,plugins:['@babel/plugin-transform-modules-commonjs']}).code,file);
function Host(){mod.exports.default();return null;}
test('background locks immediately; returning never unlocks and biometric transitions do not create a loop',()=>{
 let view;renderer.act(()=>{view=renderer.create(React.createElement(Host))});
 const emit=value=>renderer.act(()=>{for(const fn of listeners)fn(value)});
 emit('background');assert.equal(locks,1);assert.equal(state.isLocked,true);
 emit('active');assert.equal(state.isLocked,true);
 emit('inactive');emit('active');assert.equal(locks,1);
 state.isLocked=false;emit('background');assert.equal(locks,2);
 renderer.act(()=>view.unmount());assert.equal(listeners.size,0);
});
