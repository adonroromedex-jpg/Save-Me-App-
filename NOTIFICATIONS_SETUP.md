# Notifications: deployment required

The app can show local notifications while it is running, a Home bell, and a Messages unread badge. Android status-bar notifications require the notification permission. Enable them in Settings. Launcher badge appearance depends on Samsung launcher/system settings.

Closed-app push is implemented but is NOT configured or deployed by this change. The current app.json EAS project ID is a placeholder. Do not claim background delivery until the steps below pass on both phones.

1. Apply `supabase/migrations/20261004_chat_experience.sql` after the three 20260929 migrations.
2. Configure a real Expo/EAS project and set `EXPO_PUBLIC_EAS_PROJECT_ID` locally. Add Android FCM v1 credentials to that EAS project. Keep the FCM service-account private key out of this repository and out of the app.
3. Supply your matching Firebase Android client `google-services.json` locally (ignored by git), or point `GOOGLE_SERVICES_FILE` at it. Its package must be `com.saveme.secure`. `app.config.js` includes it only when present. Rebuild the native app on both phones.
4. Deploy `supabase/functions/send-message-notifications/index.ts`. Invoke it with the Supabase service-role Bearer from a server-only scheduler, e.g. Supabase Cron once per minute using Vault-held secrets. Never put that service key in Expo environment variables or the phone. If Expo enhanced push security is enabled, set `EXPO_ACCESS_TOKEN` as an Edge Function secret.
5. Enable notifications in app Settings. Confirm the device reports registered, then send a message with the receiving app closed and check the Android status bar. Check function logs and Expo push receipts when investigating delivery failures.

The scheduled worker adds up to the scheduling interval to background notification delay, plus Expo/FCM/OS delivery latency. The worker records Expo acceptance, NOT a device delivery receipt; retries are bounded to five attempts. OS notification arrival is never used to fake a blue read check. Delivery/read checks come only from the recipient app acknowledging messages. No background push latency guarantee is made.

Push payloads contain generic text and routing account IDs; no message body, PIN, media key, photo, voice or video is sent to Expo/FCM. Foreground local notifications also hide content. Logging out unregisters the account token and clears notifications; token transfer replaces the previous association on this one-device-per-account pilot.

Email OTP remains the only registration method. SMS/WhatsApp needs a configured provider (and associated billing/templates), plus verified phone authentication and account-linking design. There are no dummy SMS/WhatsApp choices in the signup form.
