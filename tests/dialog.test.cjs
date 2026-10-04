const {test}=require('node:test'),assert=require('node:assert/strict'),Module=require('node:module'),path=require('node:path'),babel=require('@babel/core');
const React=require('react'),renderer=require('react-test-renderer');
const appListeners=new Set(),storeListeners=new Set();
const native={AppState:{currentState:'active',addEventListener:(_,fn)=>{appListeners.add(fn);return{remove:()=>appListeners.delete(fn)}}},View:'View',ScrollView:'ScrollView',Text:'Text',TouchableOpacity:'Button',StyleSheet:{create:x=>x,absoluteFill:{}},BackHandler:{addEventListener:()=>({remove(){}})}};
const original=Module._load;Module._load=function(name,parent,isMain){if(name==='react-native')return native;if(name==='@expo/vector-icons')return{Ionicons:'Icon'};if(name==='../store/useStore')return{useStore:{subscribe:fn=>{storeListeners.add(fn);return()=>storeListeners.delete(fn)}}};return original.call(this,name,parent,isMain);};
const old=Module._extensions['.jsx'];Module._extensions['.jsx']=function(mod,filename){mod._compile(babel.transformFileSync(filename,{configFile:false,plugins:['@babel/plugin-transform-modules-commonjs','@babel/plugin-transform-react-jsx']}).code,filename);};
const {SecureOverlayProvider}=require('../src/components/SecureOverlay.jsx'),{Alert,AppDialogHost}=require('../src/components/AppDialog.jsx');
test('dialogs queue, execute a selected destructive action once, and dismiss on lock',async()=>{
 let view,deleted=0;
 renderer.act(()=>{view=renderer.create(React.createElement(SecureOverlayProvider,null,React.createElement(AppDialogHost)));});
 renderer.act(()=>{Alert.alert('Delete','Confirm',[{text:'Cancel',style:'cancel'},{text:'Delete',style:'destructive',onPress:()=>deleted++}]);Alert.alert('Next','Second message');});
 const press=view.root.findAllByType('Button')[1].props.onPress;
 await renderer.act(async()=>{press();press();await Promise.resolve();});
 assert.equal(deleted,1);assert.ok(view.root.findAllByType('Text').some(x=>x.children.includes('Next')));
 renderer.act(()=>{for(const fn of storeListeners)fn({isLocked:true},{isLocked:false});});
 assert.equal(view.root.findAllByType('Button').length,0);
 renderer.act(()=>{view.unmount();});assert.equal(appListeners.size,0);assert.equal(storeListeners.size,0);
});
