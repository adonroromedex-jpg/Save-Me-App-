const {test}=require('node:test'),assert=require('node:assert/strict'),Module=require('node:module'),path=require('node:path'),babel=require('@babel/core');
const React=require('react'),renderer=require('react-test-renderer');let sent=0,restarts=0,verificationFails=true,release;
const user={id:'alice',email:'alice@example.test'},state={user,setSyncIssue(){},identityChanged(){},profileChanged(){}};
const useStore=selector=>selector(state);useStore.getState=()=>state;
const original=Module._load;Module._load=function(name,parent,isMain){
 if(name==='react-native')return{ActivityIndicator:'Spinner',AppState:{addEventListener:()=>({remove(){}})},ScrollView:'Scroll',Text:'Text',TextInput:'Input',TouchableOpacity:'Button',View:'View',StyleSheet:{create:x=>x}};
 if(name==='react-i18next')return{useTranslation:()=>({t:x=>x})};
 if(name==='./SecureOverlay')return{SecureOverlay:({visible,children})=>visible?children:null};
 if(name==='./AppDialog')return{Alert:{alert(){}}};
 if(name==='../store/useStore')return{useStore};
 if(name==='../services/auth')return{requestEmailCode:async()=>sent++,verifyEmailCode:async()=>{if(verificationFails)throw new Error('Invalid OTP');return new Promise(resolve=>{release=()=>resolve(user)})}};
 if(name==='../services/identity')return{restartIdentity:async()=>restarts++};
 return original.call(this,name,parent,isMain);
};
const file=path.resolve('src/components/IdentityRestart.jsx'),mod=new Module(file,module);mod.paths=module.paths;mod._compile(babel.transformFileSync(file,{configFile:false,plugins:['@babel/plugin-transform-modules-commonjs','@babel/plugin-transform-react-jsx']}).code,file);
const press=(view,label)=>view.root.findAllByType('Button').find(b=>b.findAllByType('Text').some(t=>t.children.includes(label))).props.onPress();
test('restart requires explicit confirmation and verified email; unmount during verification prevents rotation',async()=>{
 let view;renderer.act(()=>{view=renderer.create(React.createElement(mod.exports.default))});assert.equal(sent,0);assert.equal(restarts,0);
 renderer.act(()=>press(view,'restartIdentity'));assert.ok(view.root.findAllByType('Text').some(t=>t.children.includes('restartWarning')));
 await renderer.act(async()=>press(view,'sendCode'));assert.equal(sent,1);
 renderer.act(()=>view.root.findByType('Input').props.onChangeText('123456'));
 await renderer.act(async()=>press(view,'restartConfirm'));assert.equal(restarts,0);
 verificationFails=false;
 await renderer.act(async()=>{press(view,'restartConfirm');await Promise.resolve()});
 renderer.act(()=>view.unmount());await renderer.act(async()=>{release();await Promise.resolve()});assert.equal(restarts,0);
});
