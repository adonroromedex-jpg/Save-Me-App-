# Security status — Exchange 1

This implementation has not received an independent security audit. Use test data until the Android and hosted Supabase checks in DEVICE_TESTS.md pass.

## Cryptography and identity

- NaCl `crypto_box` (TweetNaCl 1.0.3) encrypts text and file manifests to the recipient's pinned Curve25519 public key; a second envelope permits sender access. Payloads bind message ID and both account IDs. Device private keys are generated with Expo native CSPRNG and stored in SecureStore, device-only on iOS. Ordinary registration never overwrites published keys. Explicit lost-key restart has a separate verified flow described below.
- Each file gets a random 256-bit AES-GCM key. Chunks use a random 64-bit per-file nonce prefix plus a 32-bit chunk index; a fresh file key is generated for each file. Authenticated data binds ID, total size, MIME, kind and index. Encrypted manifests bind the chunk count and key. Reordering, modifying and truncating chunks fails authentication/length validation.
- This is **not Signal Protocol / Double Ratchet**. Static account keys do not provide ratchet-based forward secrecy or post-compromise recovery. First contact is trust-on-first-use. Users can compare full public-key fingerprints through an independent channel. A malicious key directory at first contact remains a risk until verification. Key changes fail closed.
- One account/device identity. Never silently replace published keys after reinstall. Version 1.3.2 permits explicit restart for future exchanges, not recovery of lost private keys.
- Metadata (participants, time, media type, size/chunk count, existence of a conversation) remains visible to the service. Legacy text rows remain marked as unencrypted; legacy media cannot be opened by the new viewer and expires under the old rules.

## Codes and online access

The six-digit chat code is an additional online access gate, **not the encryption key**. Supabase receives it over TLS and stores a bcrypt hash. The key envelopes are in a separate table with no direct authenticated/anonymous grants or RLS read policy. An authenticated participant obtains them only through `unlock_media`. Five failures trigger a five-minute lock per account/message. Failure returns commit the attempt counter instead of rolling it back with an exception.

Sending the code in the same encrypted chat is convenient but does not protect against someone who can already read that chat. A malicious server administrator can bypass the code gate but still lacks the device keys needed to decrypt the envelopes. A modified recipient device can retain envelopes/keys after a successful unlock; no app can make an authorized recipient forget decrypted content.

Every photo/video reopening performs fresh online authorization; there is no offline reopen cache or code auto-fill. Open previews use a monotonic deadline calculated from server time and recheck authorization every five seconds with an eight-second network timeout. Changing the device wall clock cannot extend server access. Audio uses the same encrypted file transport, but has no code or 24-hour expiry.

## Vault, temporary files and screen protection

The vault master key is wrapped by AES-GCM using a PBKDF2-SHA256 key (210,000 iterations) derived from the separate six-digit vault code and random salt; the wrapped master is stored in SecureStore. Old vault masters migrate without discarding their encrypted files. Failed unlocks are rate-limited in SecureStore. These local limits are not tamper-proof on a compromised/rooted device; a short PIN is not sufficient protection against offline attacks if secure storage is extracted.

Vault contents use the chunked file format; each per-file manifest/key is sealed under the vault master. Photo/video capture and playback necessarily produce temporary plaintext **inside app-private cache**, never MediaStore/gallery. Preview close, app background, navigation away and launch cleanup remove temporary copies. A crash can leave private temporary files until next launch or OS cleanup. Imported originals remain in the user's original phone gallery. Physical secure erasure on flash storage, exact deletion on an offline/terminated phone and protection from a rooted device are not guaranteed.

Android capture prevention uses the secure Activity window. Sensitive code/media overlays render within that Activity rather than RN 0.74 native Modal dialogs. Video uses inline controls with no native fullscreen presentation. Android backups are disabled. Real phone screenshot/recording and recents-thumbnail tests remain required. iOS cannot reliably block screenshots. Another camera can always record the screen.

## Server boundaries

RPCs own message mutations; authenticated clients cannot change sender, recipient, envelopes, expiry or ready status directly. Server send completion sets the fixed 24-hour photo/video expiry. Text and voice expiry is null. All object bytes are encrypted; RLS restricts chunk upload/download to the appropriate participants and lifecycle. Blocks stop new messages and media authorizations, while existing text history remains visible.

The scheduled cleanup must use the new chunk-aware implementation. It removes object bytes via the Storage API before deleting message rows and their secret envelopes. SQL row deletion alone would orphan Storage data. The five-minute schedule means physical cleanup may occur after access has already expired. Overall account/storage quotas, abuse reporting, message consent requests and production monitoring need separate work.

Phone ownership is not verified. Do not equate phone lookup with identity authentication. Do not publish tokens, media codes or private keys in logs/issues.

### Exchange 1.2 implementation notes
Android uses platform AES/GCM/NoPadding with a 128-bit tag and the same 96-bit per-chunk nonce/AAD as v2. PBKDF2-HMAC-SHA256 remains 210,000 iterations (native on Android 26+). Chunk plaintext is authenticated before append; native buffers are cleared in finally blocks. Crypto work uses two worker threads and uploads at most three requests. Failed upload workers drain before cleanup. JS fallback and legacy vault readers remain. Native code is installed by the checked-in Expo config plugin, not an external dependency.

Profile photos are an explicitly local-only feature, encrypted with a random SecureStore key. They are rendered from memory rather than exported plaintext files. As with other JS strings, immediate erasure of in-memory base64 cannot be guaranteed. Names can change; phone/email editing is removed from the app, which is not a server-wide prohibition on a separately authorized Auth API email change.

### Exchange 1.3

Direct-file native decrypt authenticates each complete AES-GCM chunk before append; app-private path restrictions and cleanup remain. Delivery/read times are stamped by the server for the recipient only. Text deletion is sender-only and rejects all media. Text read receipts rely on client viewability (70%/700 ms), not merely fetching history. A compromised client can still assert its own read status.

Profile photos are no longer local-only: the requested small thumbnail is stored in authenticated NaCl envelopes for each selected chat peer. SQL and RLS restrict card access; ciphertext is not public. Full gallery photos are not included in cards. One profile card can persist after photo/video chat expiry because it is profile data, not expiring chat media.

Push metadata consists of account routing IDs and generic text; it excludes message bodies, PINs and encryption keys. Push provider acceptance is not delivery. Thread/receipt metadata and profile cards persist until account deletion. These changes require the new SQL migration; they are not installed by building an APK.


### Explicit identity restart (1.3.2)

The Settings flow warns that old ciphertext requiring a lost key remains unreadable, requests a fresh email OTP, and requires the user's confirmation. The RPC checks authenticated account ownership, confirmed email, and an `otp` AMR timestamp within five minutes (30-second forward tolerance) from the signed Auth JWT. User metadata cannot satisfy this check. Supabase AMR identifies OTP authentication but does not distinguish email from SMS; the app requests email codes and the current deployment uses email Auth. Enabling other OTP channels would broaden accepted server reauthentication. Email-account compromise remains a risk, as with account login; this does not prove possession of the lost private key.

`restart_chat_identity` locks the caller's key row, compares the expected old key, increments its version and appends a private audit row. It never accepts another account ID, never deletes ciphertext, and leaves normal registration immutable. Same-key retries are idempotent. Direct table writes remain forbidden to clients. The new private key is staged in SecureStore before the server call; startup can finalize a committed change after a lost response. Prior local private material is archived rather than discarded, though automatic historical-key decryption is not provided.

Contacts with an old pin fail closed. A reinstalled client with no pin also requires explicit approval for a server key whose version exceeds one. The UI presents the full pair fingerprints and instructs comparison through an independent trusted channel. Acceptance checks that the server key is still exactly the reviewed key. A directory administrator can still lie about a first-seen key/version; this is not a key-transparency system. Legacy builds cannot approve changed pins; update both devices.

Unread counts exclude encrypted messages whose participant keys no longer match the current generation, without forging read receipts. Old ciphertext is retained under existing retention rules. No private-key backup, Vault recovery, multi-device sync or account merging is introduced.


### Re-entry and account isolation (1.3.3)

Background transition locks immediately; successful enrolled biometrics are required to reopen, with native device-PIN fallback disabled. Fresh email sign-in also lands locked. A brief `inactive` system dialog alone does not count as app background. Screens remain mounted but hidden from display/accessibility behind the biometric gate so external picker results can survive; sensitive portal overlays are completely suppressed while locked. Camera activity stops and media previews/PIN prompts clear on locking. The picker result is processed only after the same account unlocks; logout/account switch rejects the wait and cleans the temporary source.

Sender/receiver file operations and Vault operations check the initiating account as well as active/unlocked state. Account switches remount the navigation tree and clear UI metadata. Logout does not delete per-account SecureStore keys. File URL signing batches now cover 24 chunks, but URLs still expire after 15 seconds, refresh after 10 seconds, and plaintext assembly still checks active authorization. This reduces control requests without removing the online gate.
