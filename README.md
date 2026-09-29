# Save Me — Exchange 1

Android-first Expo SDK 51 test version. This is a development build, not an audited security product.

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

For a brand-new database, first run `20260929_secure_messaging.sql` once, then the two migrations above in order. Review names against any unrelated existing schema before execution.

No SQL or Edge Function deployment is performed by the mobile build. Access expiry is server-enforced; physical deletion follows the scheduled cleanup, normally within the Cron interval. Offline/terminated devices clear their temporary copies on next launch; exact physical erasure on such a device cannot be guaranteed.

## Update Android

Keep `.env` local with `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Never put a service-role key in the app.

After successfully pulling `restore-uploaded-app`, run:

```powershell
npm ci
npx expo prebuild --clean --platform android
npx expo run:android --device
```

Stop if a command fails. A Metro reload is insufficient: this update includes a new native file module, icon and permissions/backup changes. The top strip reads **SAVE ME • EXCHANGE 1** (translated) to identify the running JS version. The app's native version is 1.1.0 / versionCode 2.

**Do not uninstall or clear app data during these tests.** This pilot supports one encryption identity per account, stored on one device. It deliberately refuses silent identity replacement. Reinstallation/device migration and encrypted backup recovery are not implemented; losing the keys makes old encrypted content unreadable. Vault codes have no recovery flow.

## Signup and contact troubleshooting

Supabase Authentication → Email Templates must include `{{ .Token }}` in **both Confirm signup and Magic Link**, rather than `{{ .ConfirmationURL }}`. Keep custom SMTP configured. A successful OTP API request means Supabase accepted it, not that the inbox received it. Inspect Auth/SMTP provider delivery logs if only existing accounts receive mail. Registration includes resend cooldown and email correction.

Old accounts without a number must add their full international phone number in Settings. Numbers are not verified by SMS, so matching a number does not prove identity. Contact lookups send only the selected number; the address book is not uploaded. Both accounts must launch this new version online once to register their public keys before exchanging encrypted messages.

## Validation

```sh
npm test
npx expo export --platform android
npx expo prebuild --clean --platform android --no-install
```

Automated tests cover authenticated encryption/tamper rejection, SQL RLS with three users, key registration, code lockout, server-controlled dates, text/voice retention, blocks and chunk path validation. SQL tests run in PGlite with deterministic **test-only pgcrypto fixtures**; they do not validate real bcrypt, Supabase Storage HTTP, Cron or device behavior. See [SECURITY.md](SECURITY.md) for the security boundaries and [DEVICE_TESTS.md](DEVICE_TESTS.md) for the required phone checks.

Paid plans remain proposals. No billing or paid access is enabled. Message requests, push notifications, full Signal ratcheting, key recovery and multi-device support are not implemented in this pilot.
