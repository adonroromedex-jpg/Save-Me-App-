# Exchange 1 — required device tests

Use two updated Android phones and separate test accounts. Keep the installed app data. Apply the new SQL and redeploy chunk-aware cleanup first. Open both apps online to register keys.

| Test | Expected result |
| --- | --- |
| Launcher, native splash, in-app splash | White icon, no clipped mark, no black background; existing splash image animates at launch; no sound asset is supplied |
| New account / existing account | Correct Auth email template supplies a code; errors and resend cooldown visible; verify real SMTP delivery separately |
| Contact selection | Search by full number; all phone numbers on a contact can be selected; missing-number account repaired in Settings |
| Text | Both users read Unicode/emoji; unrelated account denied; Supabase body is null and encrypted_body is ciphertext |
| Voice | Record, stop, listen, discard or send; receiver listens; navigating/background stops audio; voice remains after 24h |
| Camera | Capture photo/video with audio, back/front cameras; record a full 180 seconds on each target phone; verify encoded file size and memory behavior |
| Gallery | Import own image/video to chat or vault; original stays in phone gallery; no received media appears there |
| Media code | Code + confirmation required to send; optional code text is explicit; wrong code denied; fifth failure blocks for five minutes |
| Reopen | Close then reopen same media; code always requested again; airplane mode cannot reopen it; setting clock backward does not restore expired access |
| During viewing | Disable internet; viewer closes after heartbeat/request timeout; background or tab navigation closes viewer and deletes temporary plaintext |
| Expiry | Use a test-only admin query below to shorten a disposable photo's expiry; wait; client/server deny opening; Cron removes every chunk; text/voice unaffected |
| Vault | Create separate code; capture/import requires code; wrong code denied; restart and reopen using code; personal data survives chat expiry |
| Capture prevention | Screenshot and recording attempts on chat, code prompt, photo, playing video, vault; also inspect Android recents preview |
| Blocking | Block peer; new send denied, media access denied; unblock restores new exchanges; old text history remains |
| Identity | Compare security numbers on both phones; uninstall/reinstall is NOT supported; key mismatch blocks rather than silently replacing keys |
| Navigation | Scroll long chat, load older messages, keyboard open/close, system back, tab switching while importing/downloading/recording |
| Languages | Haitian Creole, French, English, Spanish; restart to verify persistence |

Admin-only test on **one disposable photo/video**, never production rows:

```sql
update public.messages
set expires_at = now() + interval '30 seconds'
where id = 'REPLACE_WITH_DISPOSABLE_MESSAGE_UUID'
  and media_kind in ('image','video');
```

Repeat wrong-code and RLS checks against the real Supabase project; local database tests use fixtures for pgcrypto. Confirm real Storage upload/download MIME limits, successful Edge Function invocations, and deletion of all chunk objects. The code authoring environment cannot substitute for Gradle/device testing.

## Exchange 1.1 interface checks

- Search with a full formatted number, an invalid number, an accented contact name, and a phone number with spaces. Only one input should appear; the contacts icon requests phone-book access on demand.
- Confirm five footer tabs, white icons on blue, an active-tab highlight and correct spacing above the Android navigation bar. Home has no vault-count banner, duplicate action grid or Alerts shortcut.
- In Android Settings on the emulator, configure a device PIN; reopen Save Me and test successful PIN unlock, cancellation and wrong PIN. A device without a configured lock must require email sign-in instead.

## Exchange 1.2 acceptance checks

- Rebuild with `npx expo prebuild --platform android --no-install` then `npx expo run:android --variant release --device`. Do not uninstall/clear data. The config plugin registers SaveMeCrypto; a Metro-only update leaves the older JS crypto path active.
- On both phones use the same 5 MB photo and 30–50 MB video, same network, three trials each. Record time separately for vault import, vault reopening, chat send and recipient reopening. Compare medians with the previous build, alongside network upload speed; no specific latency improvement is assumed.
- Open pre-update vault files and chat media. Verify wrong PIN and tampered data remain rejected. Go offline during viewing, background during transfer, and test 24-hour expiry.
- Cancel/fail one of three concurrent uploads. Verify no ready message appears and pending chunks are removed by cancellation or cleanup.
- Register with one full international number; malformed/missing country prefix must show an error. Profile editing must expose names/photo only. Verify local profile photo persists across restart and is not exported to Gallery or shared to another account.
- Record a voice message: white mic, contrasting recording panel, timer, discard and stop; listen before sending.
- Verify dialogs fit smaller screens, long text scrolls, destructive actions require pressing the intended button, and background/lock dismisses dialogs.
- Splash: confirm the updated artwork has no “Byenvini”; large “Welcome” and small “SaveMe please” fade in, then the screen closes three seconds after image load. Check short screens and portrait tablets for uncropped artwork.

## Exchange 1.3 gates

Apply 20261004_chat_experience.sql first, install dependencies, prebuild and build a new release APK. Settings must say 1.3 with native Android crypto active.

- Cold-launch: Welcome/SaveMe please show for three seconds even while network/profile sync is pending. Returning to an already-running process does not restart the splash.
- Compare same-size media over the same connection using Settings transfer timings on both phones. Preparation/transfer/final check must total approximately total time. No latency target has yet been measured on real phones.
- Record/play/send/reopen a vocal; test speaker playback, pause, resume and finish. Voice is automatically decrypted, photo/video still ask for codes.
- Change name/photo in Settings and verify Home, then the peer's voice bubble (allow its 30-second profile refresh). Check that profile cards are encrypted and are not readable by a third account.
- Log out/in: existing threads and non-expired history load without contact search. Duplicate address-book entries resolve to the same account/thread. Different account IDs must remain distinct.
- Send text: one gray check while receiver is disconnected; two gray when receiver app polls; blue only after text is substantially visible. Media becomes blue after successfully opened. Never equate server push acceptance with delivered/read.
- Long-press own text and delete: verify both devices lose it on refresh/reopen; received text and every media type must reject deletion through the RPC.
- First-send notice hides and persists across reopen. Test server timestamps 23 hours old: warning appears within 30 seconds and stops after media expiration.
- Test vault with original personal PIN, wrong PIN and cooldown. Do not reset SecureStore or clear app data to work around an unknown PIN.
- Enable notifications. Verify Home/tab badges, generic Android notification content, notification tap routes to the proper chat after unlocking, and logout token cleanup. For closed-app push, complete NOTIFICATIONS_SETUP.md and measure scheduler/FCM latency separately.

## 1.3.1 regression checks (physical devices still required)

- Name-only profile edits must succeed for a legacy account whose Auth phone is already owned by another profile. The other account keeps that number; this is not account merging or phone recovery.
- In Camera → Vault and Gallery → Vault, enter a wrong existing Vault PIN, then the correct PIN. The same selected/captured file remains available while the prompt is open. Cancel/background closes the operation and removes the temporary source after in-flight work settles.
- In Chat → attachment → Vault, choose a personal photo/video, unlock with the Vault PIN, then create the separate chat media PIN. Confirm the original encrypted Vault item remains and the sent copy has the normal server-based 24-hour expiry. Verify PNG/WebP/MOV as well as JPEG/MP4.
- The first inbox scan acknowledges old undelivered records silently. A new message received while another chat is open alerts once. Reading/deleting/expiry removes the corresponding presented notification on the next active inbox scan; unread badges follow server read receipts, not just opening a conversation.
- Cold-start splash fills tall phone displays without white letterboxing and keeps the central logo and animated greeting visible; inspect SM_S911U1 and SM_S921U.
- Missing/mismatched chat keys still block encryption. Do NOT delete chat_keys, overwrite server keys, uninstall or clear device storage as a troubleshooting step. Identify the account and original key-bearing device first. The update cannot reconstruct a lost private key.

Code verification: prompt retry/cancellation, identity preservation/session checks, duplicate-phone name editing, and notification reconciliation have dedicated regression tests. Android JavaScript export was checked; no physical-device or APK installation test was performed in the workspace.


## 1.3.2 lost-key restart

Use separate disposable test accounts for this scenario; never uninstall a user's only key-bearing installation. After applying the migration, simulate loss on a test installation, request an email OTP in Settings and confirm restart. Wrong/expired OTPs must leave the server key unchanged. Verify re-opening Settings after a device lock accepts the already requested email code. Verify reauthentication is required server-side even if a client bypasses the UI.

Update both phones, compare the displayed full security numbers independently, and accept changed keys on both. New text/photo/video/voice must work; old ciphertext remains unavailable rather than deleted. Notifications/badges must exclude inaccessible old generations without marking those messages read. Test a dropped network response after server commit: relaunch must complete with the saved staged key. Database/unit tests cover permissions, stale verification, expected-key mismatch, idempotent retry, staged-key recovery and peer approval races. Real Supabase email delivery and physical-device SecureStore behavior still require device testing.


## 1.3.3 re-entry and transfer regression gate

Test enrolled fingerprint/face success, cancellation, no enrollment, immediate background/foreground, screen off/on, and biometric system-dialog transitions. There must be no frame of chat/media or PIN overlays while locked. External gallery selection must survive behind the gate and continue only after biometric success for the same account; switching accounts must clean/reject it. Confirm the camera is inactive behind the lock screen.

Repeat logout/login A→B→A on one phone and verify separate chat/profile/Vault state without key restart. Measure the same media on the same network before/after; signing-call unit tests are not end-to-end speed benchmarks. Photograph the reported splash defect using another phone; its visual alignment remains unverified.
