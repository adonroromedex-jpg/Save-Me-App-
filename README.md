# Save Me

React Native / Expo prototype for Android and iOS. Authentication uses Supabase email one-time codes.

## Set up

1. Copy `.env.example` to `.env` and add the project URL and **publishable** key from Supabase Connect. Never add a secret or service-role key to the app.
2. In Supabase Dashboard → Authentication → Email Templates → Magic Link / OTP, include `{{ .Token }}` in the message so the user receives a code instead of only a link.
3. For delivery to anyone outside the Supabase project team, set up a custom SMTP provider under Authentication settings. The default sender is for limited testing with project team email addresses.
4. Run `npm install`, then `npm start` (or `npm run android`).

## Current state

- Register: enter name and email, request an email code, then verify it.
- Login: request a code for an existing account, then verify it. Supabase stores and restores the session.
- Logout: ends the Supabase session.
- The vault, camera, messages, alerts, plans and local lock screens are prototypes. Vault file data is not stored in Supabase. `src/services/encryption.js` uses a demo XOR operation and does **not** encrypt media content. Do not store real private files in this prototype.
- A successful Android Metro export verifies bundling, not email delivery or end-to-end security.

## Project layout

- `App.js`: navigation, session restoration, auto-lock hook.
- `src/screens/`: app screens.
- `src/navigation/`: stack and tab navigation.
- `src/services/auth.js`: email OTP request, verification and logout.
- `src/services/supabase.js`: Supabase client initialization.
- `src/store/`: local Zustand state.
- `src/i18n/`: translations.
- `assets/`: icons and splash images.
