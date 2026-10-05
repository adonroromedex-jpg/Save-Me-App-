const {test}=require('node:test'),assert=require('node:assert/strict'),Module=require('node:module'),path=require('node:path'),babel=require('@babel/core');
let rows=[],existing={phone_e164:null},conflict=false,patch;
const user={id:'alice',user_metadata:{phoneNumber:'+50912345678'}};
const store={user:{id:'alice'},patchUser:value=>{patch=value},profileChanged(){},setSyncIssue(){}};
const db={auth:{getUser:async()=>({data:{user}}),updateUser:async()=>({})},from:()=>({select(){return this},eq(){return this},maybeSingle:async()=>({data:existing}),upsert:async row=>{rows.push(row);return conflict&&row.phone_e164?{error:{code:'23505'}}:{data:null}}})};
const original=Module._load;Module._load=function(name,parent,isMain){
 if(name==='./supabase')return{getSupabaseClient:()=>db};
 if(name==='../store/useStore')return{useStore:{getState:()=>store}};
 if(parent?.filename?.endsWith('/services/messages.js'))return{};
 return original.call(this,name,parent,isMain);
};
const file=path.resolve('src/services/messages.js'),mod=new Module(file,module);mod.paths=module.paths;mod.filename=file;mod._compile(babel.transformFileSync(file,{configFile:false,plugins:['@babel/plugin-transform-modules-commonjs']}).code,file);
test('name edits never claim the duplicate legacy phone; registration still rejects duplicates',async()=>{
 conflict=true;await mod.exports.updateProfile({firstName:'New',name:'Name'});
 assert.equal(rows.length,1);assert.equal(Object.hasOwn(rows[0],'phone_e164'),false);assert.deepEqual(patch,{firstName:'New',name:'Name'});
 await assert.rejects(mod.exports.updateProfile({firstName:'New',name:'Name',phoneNumber:'+50912345678'}),/deja asosye/);
 rows=[];const repaired=await mod.exports.syncProfile({...user,user_metadata:{...user.user_metadata,firstName:'New',name:'Name'}});
 assert.equal(repaired.phone_e164,null);assert.equal(rows.at(-1).phone_e164,null);assert.equal(rows.at(-1).first_name,'New');
});
