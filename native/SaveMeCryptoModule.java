package com.saveme.secure;

import android.net.Uri;
import android.util.Base64;
import com.facebook.react.bridge.*;
import java.io.*;
import java.util.Arrays;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import javax.crypto.Cipher;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.PBEKeySpec;
import javax.crypto.spec.SecretKeySpec;

/** Bounded background work; retains the existing v2 AES-GCM byte format. */
public final class SaveMeCryptoModule extends ReactContextBaseJavaModule {
  private final ExecutorService workers = Executors.newFixedThreadPool(2);
  public SaveMeCryptoModule(ReactApplicationContext context) { super(context); }
  @Override public String getName() { return "SaveMeCrypto"; }
  @Override public void invalidate() { workers.shutdown(); super.invalidate(); }
  private byte[] decode(String value) { return Base64.decode(value, Base64.NO_WRAP); }
  private File file(String uri) throws IOException {
    Uri parsed = Uri.parse(uri);
    if (!"file".equals(parsed.getScheme())) throw new IOException("Private file URI required");
    File result = new File(parsed.getPath()).getCanonicalFile();
    File root = getReactApplicationContext().getApplicationInfo().dataDir == null ? null :
      new File(getReactApplicationContext().getApplicationInfo().dataDir).getCanonicalFile();
    if (root == null || !result.getPath().startsWith(root.getPath() + File.separator)) throw new IOException("Private file required");
    return result;
  }
  private Cipher cipher(int mode, String key, String nonce, String aad) throws Exception {
    byte[] bytes = decode(key);
    try {
      if (bytes.length != 32 || decode(nonce).length != 12) throw new IOException("Invalid key or nonce");
      Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
      cipher.init(mode, new SecretKeySpec(bytes, "AES"), new GCMParameterSpec(128, decode(nonce)));
      cipher.updateAAD(decode(aad));
      return cipher;
    } finally { Arrays.fill(bytes, (byte) 0); }
  }
  @ReactMethod public void encryptPart(String source, String target, double offset, int length,
      String key, String nonce, String aad, Promise promise) {
    workers.execute(() -> {
      byte[] plain = null;
      try {
        if (offset < 0 || offset != Math.floor(offset) || length < 1 || length > 1048576) throw new IOException("Invalid chunk");
        plain = new byte[length];
        try (RandomAccessFile input = new RandomAccessFile(file(source), "r")) { input.seek((long) offset); input.readFully(plain); }
        byte[] encrypted = cipher(Cipher.ENCRYPT_MODE, key, nonce, aad).doFinal(plain);
        try (FileOutputStream output = new FileOutputStream(file(target))) { output.write(encrypted); }
        promise.resolve(null);
      } catch (Exception e) { promise.reject("MEDIA_CRYPTO", "Pa kapab chifre fichye a.", e); }
      finally { if (plain != null) Arrays.fill(plain, (byte) 0); }
    });
  }
  @ReactMethod public void decryptAppend(String encrypted, String target, int length,
      String key, String nonce, String aad, Promise promise) {
    workers.execute(() -> {
      byte[] plain = null;
      try {
        if (length < 1 || length > 1048576 || encrypted.length() > 1400000) throw new IOException("Invalid chunk");
        // Authenticate the entire chunk before appending any plaintext.
        plain = cipher(Cipher.DECRYPT_MODE, key, nonce, aad).doFinal(decode(encrypted));
        if (plain.length != length) throw new IOException("Incomplete chunk");
        try (FileOutputStream output = new FileOutputStream(file(target), true)) { output.write(plain); }
        promise.resolve(null);
      } catch (Exception e) { promise.reject("MEDIA_CRYPTO", "Fichye a pa konplè oswa li modifye.", e); }
      finally { if (plain != null) Arrays.fill(plain, (byte) 0); }
    });
  }
  @ReactMethod public void decryptFileAppend(String source, String target, int length,
      String key, String nonce, String aad, Promise promise) {
    workers.execute(() -> {
      byte[] plain = null;
      try {
        if (length < 1 || length > 1048576) throw new IOException("Invalid chunk");
        File inputFile = file(source);
        if (inputFile.length() != length + 16) throw new IOException("Incomplete encrypted chunk");
        byte[] encrypted = new byte[length + 16];
        try (DataInputStream input = new DataInputStream(new FileInputStream(inputFile))) { input.readFully(encrypted); }
        plain = cipher(Cipher.DECRYPT_MODE, key, nonce, aad).doFinal(encrypted);
        if (plain.length != length) throw new IOException("Incomplete chunk");
        try (FileOutputStream output = new FileOutputStream(file(target), true)) { output.write(plain); }
        promise.resolve(null);
      } catch (Exception e) { promise.reject("MEDIA_CRYPTO", "Fichye a pa konplè oswa li modifye.", e); }
      finally { if (plain != null) Arrays.fill(plain, (byte) 0); }
    });
  }
  @ReactMethod public void deriveVaultKey(String pin, String salt, Promise promise) {
    workers.execute(() -> {
      PBEKeySpec spec = null; byte[] derived = null;
      try {
        if (!pin.matches("[0-9]{6}") || decode(salt).length != 16) throw new IOException("Invalid vault code");
        spec = new PBEKeySpec(pin.toCharArray(), decode(salt), 210000, 256);
        derived = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).getEncoded();
        promise.resolve(Base64.encodeToString(derived, Base64.NO_WRAP));
      } catch (Exception e) { promise.reject("VAULT_KDF", "Pa kapab louvri kle vault la.", e); }
      finally { if (spec != null) spec.clearPassword(); if (derived != null) Arrays.fill(derived, (byte) 0); }
    });
  }
}
