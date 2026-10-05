# Save Me — Exchange 1.3.2

Android-first Expo SDK 51 test version. This is a development build, not an audited security product.

## Exchange 1.3 — chat, delivery and profile fixes

**Apply `supabase/migrations/20261004_chat_experience.sql` and then `supabase/migrations/20261005_identity_restart.sql` before using 1.3.2. A new native Android build is required.** Existing ciphertext and vault keys keep their format. Do not uninstall or clear app data.

- Splash starts before profile/network synchronization, with large Welcome and small SaveMe please in a three-second animation. Diagnostic strips are removed; version/native crypto status and exact sync errors are in Settings.
- Android downloads decrypt directly from temporary encrypted files instead of base64 roundtrips. Three chunks remain the concurrency limit. One redundant authorization request is removed; the code gate, server-clock expiry, final online authorization and five-second viewer checks remain.
- Foreground chat refresh uses Realtime when available and a two-second polling fallback. Unchanged text is not decrypted repeatedly; the in-memory cache is dropped on background/blur. Voice recordings use mono AAC 48 kb/s rather than the previous stereo high-quality preset, and have an explicit Play control and automatic decryption (no media PIN, as specified for voice).
- Settings displays actual session transfer timings (preparation, transfer plus crypto, final verification, total). These are measured durations, not estimates or cross-device delivery-time guarantees.
- Profile names are synchronized from the canonical profile row; Home and voice bubbles show the profile photo. A 96-pixel thumbnail is stored encrypted locally and shared in pair-encrypted profile cards; full photos are not published. Names/avatars from another already-open conversation may take up to its profile refresh interval to update.
- Persistent server threads survive media expiry, text deletion, logout and login. There is one thread per pair of account IDs, independent of duplicate address-book entries. Separate accounts/identities are NOT merged by matching names or phone numbers. Already expired/deleted media is not restored.
- A gray single check means the server accepted the send; gray double checks mean the recipient app acknowledged arrival; blue double checks mean visible decrypted text, or opened media. Receipts are recipient-only server operations. Long-press an own text to delete it for both parties; media deletion is rejected by the server.
- The introductory 24-hour notice hides after the user's first send. A server-time warning returns when any photo/video in the conversation has under one hour remaining; checked every 30 seconds.
- Notification permission, Home bell, tab badge, local notices, push registration and an outbox worker are implemented. **Closed-app push still requires EAS/FCM and server deployment.** See [NOTIFICATIONS_SETUP.md](NOTIFICATIONS_SETUP.md). Email is the only configured OTP channel.

The vault has ONE personal six-digit code for all its local files, distinct from per-media chat codes. Forgetting it cannot be fixed by entering a new arbitrary code; no recovery/reset that destroys existing files is provided.

## What this version does

- Text, voice notes with playback before sending, photos and videos; phone contact selection and exact-number search.
- App camera with audio and a three-minute recording limit at 480p (device support can affect quality).
- Photo/video chat messages expire **24 hours after the server accepts the completed send**. Uploads have a separate 24-hour cleanup window. Text and voice notes remain.
- Each photo/video send requires a six-digit code. The sender may explicitly choose to send the code as an encrypted text message. Every reopening requires the code and a fresh server authorization. An open viewer rechecks every five seconds and closes on authorization/network failure (an eight-second request timeout applies).
- Text and media key envelopes use NaCl authenticated public-key encryption; file bytes use AES-256-GCM. Private keys remain in device SecureStore. Supabase receives encrypted bodies and media, plus routing/expiry metadata and a bcrypt hash of media codes.
- Personal camera captures and gallery imports stay in the encrypted, local vault until deleted. The separate vault code is required to save/open them. Received content is never offered for vault import, forwarding, export or gallery saving.
- Files are processed in 1 MiB authenticated chunks. The client cap is **200 MiB per file**, with each encrypted Storage object below 2 MiB. This avoids the old 20/50 MiB *per-file* limit and avoids loading a whole video into JS memory. Overall Storage quota and bandwidth still apply. Imported videos are not guaranteed automatic compression on Android.
- Contact blocking, per-chat colors, security-number comparison, scrollable paginated history, app locking and Android capture prevention.
- White launcher icon with safe padding, white native splash and the existing animated in-app splash image. No original splash audio was supplied.

## Upgrade Supabase before testing chat

For an existing installation that already ran the initial chat migration:

1. Run [`supabase/migrations/20260929_repair_profiles_and_media_limits.sql`](supabase/migrations/20260929_repair_profiles_and_media_limits.sql) in SQL Editor if not already applied.
2. Run [`supabase/migrations/20260929_encrypted_exchange.sql`](supabase/migrations/20260929_encrypted_exchange.sql) **after** the repair migration. This migration is rerunnable. It rejects old clients' message writes; both test phones must update.
3. Replace and redeploy the existing [`cleanup-expired-media`](supabase/functions/cleanup-expired-media/index.ts) Edge Function. Keep the existing five-minute Cron schedule and Vault secret. The new function deletes all chunks before deleting their parent message. Using the old cleanup function would leave orphaned chunks.
4. Verify the project's global Storage upload limit is at least 2 MiB. The new migration configures the private bucket for encrypted chunks of up to 2 MiB. Do not run the old media-limit migration again after it.

For a brand-new database, first run `20260929_secure_messaging.sql` once, then the two migrations above and `20261004_chat_experience.sql` in order. Review names against any unrelated existing schema before execution.

No SQL or Edge Function deployment is performed by the mobile build. Access expiry is server-enforced; physical deletion follows the scheduled cleanup, normally within the Cron interval. Offline/terminated devices clear their temporary copies on next launch; exact physical erasure on such a device cannot be guaranteed.

## Update Android

Keep `.env` local with `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Never put a service-role key in the app.

After successfully pulling `restore-uploaded-app` and applying the new SQL migration, run (or use `scripts/update-two-phones.ps1` for the two Samsung devices):

```powershell
npm ci
npx expo prebuild --platform android --no-install
npx expo run:android --variant release --device
```

Stop if a command fails. A Metro reload is insufficient: this update includes a new native file module, icon and permissions/backup changes. Settings identifies this version as **Save Me 1.3.2** and reports whether direct-file native crypto is active. The app's native version is 1.3.2 / versionCode 6.

**Do not uninstall or clear app data during these tests.** This pilot supports one encryption identity per account, stored on one device. It deliberately refuses silent identity replacement. Reinstallation can explicitly restart future exchanges after fresh email verification; private-key transfer and encrypted backup recovery are not implemented; losing the keys makes old encrypted content unreadable. Vault codes have no recovery flow.

## Signup and contact troubleshooting

Supabase Authentication → Email Templates must include `{{ .Token }}` in **both Confirm signup and Magic Link**, rather than `{{ .ConfirmationURL }}`. Keep custom SMTP configured. A successful OTP API request means Supabase accepted it, not that the inbox received it. Inspect Auth/SMTP provider delivery logs if only existing accounts receive mail. Registration includes resend cooldown and email correction.

Accounts created without a phone number need an administrative correction; Settings no longer changes phone numbers. Numbers are not verified by SMS, so matching a number does not prove identity. Contact lookups send only the selected number; the address book is not uploaded. Both accounts must launch this new version online once to register their public keys before exchanging encrypted messages.

## Validation

```sh
npm test
npx expo export --platform android
npx expo prebuild --clean --platform android --no-install
```

Native compatibility tests compile the production Java module with Android/React bridge stubs and exercise JDK AES-GCM/PBKDF2 against independent Node crypto vectors. They do not replace an Android APK/device test. They require a JDK (otherwise that test is explicitly skipped). Transfer tests check concurrency bounds and draining before cleanup.

Automated tests cover authenticated encryption/tamper rejection, SQL RLS with three users, key registration, code lockout, server-controlled dates, text/voice retention, blocks and chunk path validation. SQL tests run in PGlite with deterministic **test-only pgcrypto fixtures**; they do not validate real bcrypt, Supabase Storage HTTP, Cron or device behavior. See [SECURITY.md](SECURITY.md) for the security boundaries and [DEVICE_TESTS.md](DEVICE_TESTS.md) for the required phone checks.

Paid plans remain proposals. No billing or paid access is enabled. Message requests, full Signal ratcheting, key recovery and multi-device support are not implemented. Background push requires the deployment described above.

### Exchange 1.3.1

Name edits no longer reassign phone numbers. Media code errors remain in the prompt so the user can retry the same selection. Chat attachments now include the personal Vault: unlock the source with its Vault PIN, then choose a separate PIN for the sent copy. Incoming notifications are reconciled with server read state; historical undelivered messages are not replayed as fresh local alerts on startup. The welcome artwork fills tall screens while retaining its aspect ratio.

No additional SQL migration is required beyond the 1.3 migration. Redeploy `send-message-notifications` if using remote push to include per-message notification IDs; old sender-only notifications are still reconciled by thread. Identity diagnostics now distinguish a missing local private key from a mismatched key. This does not implement private-key recovery, key rotation, account merging or multi-device login.


### Exchange 1.3.2: restart after losing a device key

1. Apply `supabase/migrations/20261005_identity_restart.sql` in the same Supabase project as the app. It is additive/idempotent and does not itself rotate keys or delete messages.
2. Update both phones to 1.3.2 without uninstalling or clearing data.
3. On each affected account: Settings → Security → Restart secure exchanges. Read the loss warning, request a fresh code to that account's email, then enter it and confirm. If the app locks while reading email, reopen Settings and enter the already requested code.
4. Open the conversation. Tap the changed-key notice or Chat menu → Security numbers. Compare the full numbers on both phones in person or through an independent trusted channel, then explicitly accept each changed contact key.
5. Send a new text, photo and voice message in both directions. Old ciphertext remains; messages requiring missing keys cannot be recovered. Their unread state is not falsely changed to "read", but unread badges exclude inaccessible key generations.

The app requests email OTP. Server rotation requires an email-confirmed account and a recent OTP authentication timestamp no older than five minutes in the signed Supabase JWT. It uses a row lock, expected-key comparison and an audit record. A staged private key is durably saved before the request, allowing interrupted completion without another rotation. Existing local secrets are archived in SecureStore before replacement. This is neither backup recovery nor multi-device support.
