const {test}=require('node:test'),assert=require('node:assert/strict'),Module=require('node:module'),path=require('node:path'),babel=require('@babel/core');
const React=require('react'),renderer=require('react-test-renderer');let api;const listeners=new Set();
const original=Module._load;Module._load=function(name,parent,isMain){
 if(name==='react-native')return{AppState:{addEventListener:(_,fn)=>{listeners.add(fn);return{remove:()=>listeners.delete(fn)}}},ActivityIndicator:'Spinner',View:'View',Text:'Text',TextInput:'Input',TouchableOpacity:'Button',Switch:'Switch',ScrollView:'Scroll',StyleSheet:{create:x=>x}};
 if(name==='@react-navigation/native')return{useFocusEffect:()=>{}};
 if(name==='react-i18next')return{useTranslation:()=>({t:x=>x})};
 if(name==='expo-crypto')return{};
 if(name==='./SecureOverlay')return{SecureOverlay:({visible,children})=>visible?children:null};
 return original.call(this,name,parent,isMain);
};
const file=path.resolve('src/components/CodePrompt.jsx'),mod=new Module(file,module);mod.paths=module.paths;mod._compile(babel.transformFileSync(file,{configFile:false,plugins:['@babel/plugin-transform-modules-commonjs','@babel/plugin-transform-react-jsx']}).code,file);
function Host(){api=mod.exports.useCodePrompt();return api.codeModal;}
test('wrong code retains selection for retry; background cancellation drains active work before source cleanup',async()=>{
 let view,promise,settled=false,attempts=0;
 renderer.act(()=>{view=renderer.create(React.createElement(Host));});
 renderer.act(()=>{promise=api.askCode({onSubmit:async()=>{if(++attempts===1)throw new Error('Wrong PIN');}});promise.then(()=>{settled=true});});
 renderer.act(()=>view.root.findByType('Input').props.onChangeText('123456'));
 await renderer.act(async()=>view.root.findAllByType('Button').at(-1).props.onPress());
 assert.equal(settled,false);assert.ok(view.root.findAllByType('Text').some(n=>n.children.includes('Wrong PIN')));
 await renderer.act(async()=>view.root.findAllByType('Button').at(-1).props.onPress());assert.equal((await promise).pin,'123456');assert.equal(attempts,2);
 let release;settled=false;
 renderer.act(()=>{promise=api.askCode({onSubmit:()=>new Promise(resolve=>{release=resolve})});promise.then(()=>{settled=true});});
 renderer.act(()=>view.root.findByType('Input').props.onChangeText('123456'));
 await renderer.act(async()=>{view.root.findAllByType('Button').at(-1).props.onPress();await Promise.resolve();});
 await renderer.act(async()=>{for(const fn of listeners)fn('background');await Promise.resolve();});assert.equal(settled,false);
 await renderer.act(async()=>{release();await Promise.resolve();});assert.equal(await promise,null);
 renderer.act(()=>view.unmount());
});
