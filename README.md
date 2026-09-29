# Save Me

Expo SDK 51 Android/iOS application. This branch is a security-focused development build, **not a finished security product**.

## Android setup

1. Keep `.env` local with `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Never put a service-role or secret key in the app.
2. Run `npm ci`.
3. New native modules and permissions require regeneration of the ignored native project: `npx expo prebuild --clean --platform android` and then `npx expo run:android --device`. Later JS-only changes can use Metro reload.

## Supabase setup before chat works

1. In the project's SQL Editor, run [`supabase/migrations/20260929_secure_messaging.sql`](supabase/migrations/20260929_secure_messaging.sql). Review the SQL before execution. It creates profiles, messages, exact-phone lookup, row-level security and a **private** `chat-media` bucket. Do not run it against an existing schema with similarly named tables without reviewing conflicts.
2. In Authentication → Email Templates, edit **both** `Confirm signup` (new accounts) and `Magic Link` (existing accounts). Use a subject such as `Kòd Save Me` and this HTML body for each:

   ```html
   <h2>Kòd koneksyon Save Me</h2>
   <p>Antre kòd sa a nan aplikasyon an: <strong>{{ .Token }}</strong></p>
   ```

   Remove `{{ .ConfirmationURL }}` from these templates. The registration flow uses the Confirm signup template, while login uses Magic Link. Keep the Resend SMTP configuration in Supabase Auth.
3. Deploy `supabase/functions/cleanup-expired-media` as a scheduled Edge Function with service credentials stored **only** in Supabase. Schedule it regularly through Supabase Cron/Vault or another trusted server scheduler. The service-role key must never be shared with the mobile app or committed to Git. Until this is deployed, access to expired items is denied by RLS, but their bytes remain in Storage.

## Current behavior

- Registration and login use emailed 8-digit OTPs. First name, last name, phone with country code and email are required. The phone is **not verified for ownership**; contact matching must not be treated as identity verification. Existing accounts can add a phone in Settings.
- Chat looks up only the selected contact's number, never uploads the address book. Text and gallery photo/video messages are visible to sender/recipient through RLS for 24 hours after sending. Received media opens inside chat and is not offered for vault import, gallery export or forwarding. The private bucket uses short signed URLs. Messages and media **are not end-to-end encrypted**; Supabase has access to their plaintext. An authorized recipient may still copy content by other means.
- Vault imports gallery media or camera captures into app-private storage encrypted with AES-256-GCM. Its key is in SecureStore. The imported original is still in the phone gallery until the user deletes it there. A decrypted preview is temporarily written to app-private cache and removed on close/background; abnormal termination can leave it there until the OS clears cache. Vault items stay local to this device and do not sync between devices.
- Screen capture prevention is enabled through `expo-screen-capture`: Android uses its secure window flag; iOS cannot reliably prevent screenshots. Another camera, a compromised device or an authorized user's external capture cannot be prevented.
- Plans screen shows **proposed**, unverified prices and features. Paid selection does not grant access or charge money; billing is not integrated. There is no end-to-end encryption, subscription enforcement, ad system or reliable threat-alert backend yet.

## Device test sequence

1. Create a new account and confirm the code from the **Confirm signup** email; sign out and sign back in with a code from **Magic Link**.
2. Select each language, visit Dashboard, Settings, Vault, Chat and Plans, then restart the app to verify persistence.
3. Import an image and a short video into Vault; open and close previews, restart, verify both are available and remain out of the app's own chat received-media flow.
4. On two Android phones with separate accounts and real phone numbers, select a contact, exchange text and media, try an unregistered number, then test expired access. Check RLS with each user and an unrelated third user.
5. On Android, attempt screenshot and screen recording inside the app; background/foreground and restart to test the lock. Device QA is required; Metro bundling alone does not prove any of this.

## Project layout

- `src/services/vault.js`: local AES-GCM encryption and file lifecycle.
- `src/services/messages.js`: Supabase profile, contact lookup and messaging.
- `supabase/migrations/`: server-side schema and access rules.
- `supabase/functions/`: server-side media cleanup.
- `src/screens/`: UI and media viewers.
