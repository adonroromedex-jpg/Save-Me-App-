// Runs the production Java module with tiny Android/bridge stubs and the real JDK crypto provider.
// This checks format compatibility, not Android UI/provider performance or APK packaging.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),cp=require('node:child_process');
const java=process.env.JAVA_HOME?path.join(process.env.JAVA_HOME,'bin',process.platform==='win32'?'java.exe':'java'):'java';
const available=cp.spawnSync(java,['-version']).status===0;
test('native AES chunks and PBKDF2 remain compatible; tampering never appends plaintext',{skip:!available},()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'saveme-native-'));
 const put=(name,text)=>{const file=path.join(root,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,text);};
 const sources={
 'android/net/Uri.java':'package android.net; public class Uri { private java.net.URI uri; public static Uri parse(String s){Uri u=new Uri();u.uri=java.net.URI.create(s);return u;} public String getScheme(){return uri.getScheme();} public String getPath(){return uri.getPath();}}',
 'android/util/Base64.java':'package android.util; public class Base64 { public static int NO_WRAP=2; public static byte[] decode(String s,int f){return java.util.Base64.getDecoder().decode(s);} public static String encodeToString(byte[] b,int f){return java.util.Base64.getEncoder().encodeToString(b);}}',
 'com/facebook/react/bridge/NativeModule.java':'package com.facebook.react.bridge; public interface NativeModule {}',
 'com/facebook/react/bridge/ReactApplicationContext.java':'package com.facebook.react.bridge; public class ReactApplicationContext { public static class Info { public String dataDir=System.getProperty("test.root"); } public Info getApplicationInfo(){return new Info();}}',
 'com/facebook/react/bridge/ReactContextBaseJavaModule.java':'package com.facebook.react.bridge; public abstract class ReactContextBaseJavaModule implements NativeModule { private ReactApplicationContext c; public ReactContextBaseJavaModule(ReactApplicationContext c){this.c=c;} public ReactApplicationContext getReactApplicationContext(){return c;} public abstract String getName(); public void invalidate(){} }',
 'com/facebook/react/bridge/ReactMethod.java':'package com.facebook.react.bridge; public @interface ReactMethod {}',
 'com/facebook/react/bridge/Promise.java':'package com.facebook.react.bridge; public interface Promise { void resolve(Object value); void reject(String code,String message,Throwable e); }',
 'com/facebook/react/uimanager/ViewManager.java':'package com.facebook.react.uimanager; public class ViewManager {}',
 'com/facebook/react/ReactPackage.java':'package com.facebook.react; import java.util.List; import com.facebook.react.bridge.*; import com.facebook.react.uimanager.ViewManager; public interface ReactPackage { List<NativeModule> createNativeModules(ReactApplicationContext c); List<ViewManager> createViewManagers(ReactApplicationContext c); }',
 };
 for(const [name,source] of Object.entries(sources))put(name,source);
 for(const name of ['SaveMeCryptoModule.java','SaveMeCryptoPackage.java'])put('com/saveme/secure/'+name,fs.readFileSync('native/'+name,'utf8'));
 const key=crypto.randomBytes(32),nonce=crypto.randomBytes(12),plain=crypto.randomBytes(1048576),aad=Buffer.from(JSON.stringify(['fixture',1048576,'video/mp4','video',0]));
 const cipher=crypto.createCipheriv('aes-256-gcm',key,nonce);cipher.setAAD(aad);const encrypted=Buffer.concat([cipher.update(plain),cipher.final(),cipher.getAuthTag()]);
 put('source',plain);put('expected',encrypted);
 const salt=crypto.randomBytes(16);const derived=crypto.pbkdf2Sync('012345',salt,210000,32,'sha256');
 put('Harness.java',`import com.saveme.secure.*; import com.facebook.react.bridge.*; import java.nio.file.*; import java.util.*; import java.util.concurrent.*;
 public class Harness {
 static class Result implements Promise { Object value; Throwable error; CountDownLatch latch=new CountDownLatch(1); public void resolve(Object v){value=v;latch.countDown();} public void reject(String c,String m,Throwable e){error=e;latch.countDown();} Object waitFor()throws Exception{if(!latch.await(30,TimeUnit.SECONDS))throw new Exception("timeout");if(error!=null)throw new Exception(error);return value;} }
 public static void main(String[] args)throws Exception{
 Path root=Paths.get(System.getProperty("test.root")); SaveMeCryptoModule module=new SaveMeCryptoModule(new ReactApplicationContext());
 String key="${key.toString('base64')}", nonce="${nonce.toString('base64')}", aad="${aad.toString('base64')}";
 try {
 Result result=new Result();module.encryptPart(root.resolve("source").toUri().toString(),root.resolve("encrypted").toUri().toString(),0,1048576,key,nonce,aad,result);result.waitFor();
 byte[] encrypted=Files.readAllBytes(root.resolve("encrypted"));if(!Arrays.equals(encrypted,Files.readAllBytes(root.resolve("expected"))))throw new Exception("format changed");
 result=new Result();module.decryptAppend(Base64.getEncoder().encodeToString(encrypted),root.resolve("output").toUri().toString(),1048576,key,nonce,aad,result);result.waitFor();
 if(!Arrays.equals(Files.readAllBytes(root.resolve("source")),Files.readAllBytes(root.resolve("output"))))throw new Exception("roundtrip");
 encrypted[5]^=1;result=new Result();module.decryptAppend(Base64.getEncoder().encodeToString(encrypted),root.resolve("output").toUri().toString(),1048576,key,nonce,aad,result);boolean rejected=false;try{result.waitFor();}catch(Exception e){rejected=true;}
 if(!rejected || Files.size(root.resolve("output"))!=1048576)throw new Exception("tamper accepted or appended");
 result=new Result();module.deriveVaultKey("012345","${salt.toString('base64')}",result);if(!"${derived.toString('base64')}".equals(result.waitFor()))throw new Exception("KDF changed");
 result=new Result();module.encryptPart(root.resolve("source").toUri().toString(),root.getParent().resolve("forbidden").toUri().toString(),0,1,key,nonce,aad,result);rejected=false;try{result.waitFor();}catch(Exception e){rejected=true;}if(!rejected)throw new Exception("external write accepted");
 System.out.println("native compatibility OK");
 } finally {module.invalidate();}
 }}
 `);
 try {
 const names=[...Object.keys(sources),'com/saveme/secure/SaveMeCryptoModule.java','com/saveme/secure/SaveMeCryptoPackage.java','Harness.java'].map(n=>path.join(root,n));
 cp.execFileSync(java,['-m','jdk.compiler/com.sun.tools.javac.Main','-d',root,...names],{stdio:'pipe'});
 assert.match(cp.execFileSync(java,['-Dtest.root='+root,'-cp',root,'Harness'],{encoding:'utf8'}),/native compatibility OK/);
 } finally {fs.rmSync(root,{recursive:true,force:true});}
});
