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
- Original splash image replacement awaits the user's attachment.
