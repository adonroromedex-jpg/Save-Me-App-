const {test}=require('node:test'),assert=require('node:assert/strict'),Module=require('node:module'),path=require('node:path'),babel=require('@babel/core');
const React=require('react'),renderer=require('react-test-renderer');
const listeners=new Set();
const original=Module._load;Module._load=function(name,parent,isMain){if(name==='react-native')return{View:'View',StyleSheet:{absoluteFill:{}},BackHandler:{addEventListener:(_,fn)=>{listeners.add(fn);return{remove:()=>listeners.delete(fn)}}}};return original.call(this,name,parent,isMain);};
const filename=path.resolve('src/components/SecureOverlay.jsx');const mod=new Module(filename,module);mod.paths=module.paths;
mod._compile(babel.transformFileSync(filename,{configFile:false,plugins:['@babel/plugin-transform-modules-commonjs','@babel/plugin-transform-react-jsx']}).code,filename);
const {SecureOverlayProvider,SecureOverlay}=mod.exports;
test('secure overlays stay in the Activity view tree, update without render loops, clean up on close',()=>{
 let view,closed=0;
 const tree=(visible,text,hidden=false)=>React.createElement(SecureOverlayProvider,{hidden},React.createElement(SecureOverlay,{visible,onRequestClose:()=>closed++},React.createElement('Secret',null,text)));
 renderer.act(()=>{view=renderer.create(tree(true,'123456'));});
 assert.equal(view.root.findByType('Secret').children[0],'123456');assert.equal(listeners.size,1);
 renderer.act(()=>{view.update(tree(true,'654321'));});assert.equal(view.root.findByType('Secret').children[0],'654321');
 renderer.act(()=>{[...listeners][0]();});assert.equal(closed,1);
 renderer.act(()=>{view.update(tree(true,'sensitive',true));});assert.equal(view.root.findAllByType('Secret').length,0,'PIN overlays hidden while biometric lock is shown');
 renderer.act(()=>{view.update(tree(true,'sensitive',false));});assert.equal(view.root.findAllByType('Secret').length,1);
 renderer.act(()=>{view.update(tree(false,''));});assert.equal(view.root.findAllByType('Secret').length,0);assert.equal(listeners.size,0);
 renderer.act(()=>{view.unmount();});assert.equal(listeners.size,0);
});
