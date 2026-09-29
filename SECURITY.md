# Security status

This project is in development and has not received an independent security audit. Do not use it for sensitive content yet.

The vault encrypts imported file bytes locally with AES-256-GCM and keeps the key in the device's SecureStore. Metadata remains in app-private AsyncStorage. Chat uses Supabase RLS and private Storage but does not provide end-to-end encryption. Android screen capture blocking does not stop another device from filming the screen; iOS screenshots cannot be reliably blocked.

The 24-hour rule is enforced by server-side RLS access checks. Permanent deletion of object bytes also requires the scheduled cleanup Edge Function described in README. A signed URL created just before expiry can work for its remaining short lifetime. Device compromise, rooted devices, external cameras, backups and cached previews require dedicated threat-model review.

Phone ownership is not verified because SMS verification was removed. Exact-number discovery has a per-account daily lookup limit, but a matched number is not proof of a person's identity.

Report suspected vulnerabilities privately to the project owner. Do not publish account tokens, private files or service-role keys in an issue.
