# 🔐 SAVE ME — React Native + Expo

## Strukti Pwojè / Project Structure

```
saveme/
├── App.js                          ← Entry point
├── app.json                        ← Expo config (Google Play + App Store)
├── eas.json                        ← Build config (.aab pou Google Play)
├── package.json                    ← Tout depandans
└── src/
    ├── i18n/
    │   ├── index.js                ← i18n setup
    │   └── translations.js         ← FR / EN / ES / HT
    ├── store/
    │   └── useStore.js             ← Zustand global state
    ├── navigation/
    │   └── AppNavigator.js         ← Stack + Tab navigation
    ├── services/
    │   ├── encryption.js           ← AES-256 chiffrement
    │   ├── biometrics.js           ← Face ID + Emprènt
    │   └── twoFactor.js            ← OTP SMS + Email
    └── screens/
        ├── WelcomeScreen.jsx       ← Ekran byenveni (4 lang)
        ├── RegisterScreen.jsx      ← Kreye kont + 2FA
        ├── LoginScreen.jsx         ← Koneksyon
        ├── BiometricScreen.jsx     ← PIN + Byometri
        └── AllScreens.jsx          ← Dashboard, Vault, Camera,
                                       Messages, Alerts, Plans,
                                       Settings, NewDevice
```

---

## ⚡ Kòmanse Rapidman / Quick Start

### 1. Enstale depandans

```bash
npm install
```

### 2. Separe AllScreens.jsx

Kopye chak `export function` nan pwòp fichye pa yo:

- `VaultScreen` → `src/screens/VaultScreen.jsx`
- `CameraScreen` → `src/screens/CameraScreen.jsx`
- `MessagesScreen` → `src/screens/MessagesScreen.jsx`
- `AlertsScreen` → `src/screens/AlertsScreen.jsx`
- `PlansScreen` → `src/screens/PlansScreen.jsx`
- `SettingsScreen` → `src/screens/SettingsScreen.jsx`
- `NewDeviceScreen` → `src/screens/NewDeviceScreen.jsx`

Oswa rete `AllScreens.jsx` epi chanje import yo nan `AppNavigator.js`:

```js
import { VaultScreen, CameraScreen, MessagesScreen,
         AlertsScreen, PlansScreen, SettingsScreen,
         NewDeviceScreen } from '../screens/AllScreens';
```

### 3. Kouri app la

```bash
# Android
npx expo start --android

# iOS
npx expo start --ios

# Expo Go (pi fasil pou teste)
npx expo start
# Enskane QR code ak Expo Go app
```

---

## 🏗️ Bati pou Google Play (.aab)

### Etap 1: Enstale EAS CLI
```bash
npm install -g eas-cli
eas login
```

### Etap 2: Konfigire
```bash
eas build:configure
```

### Etap 3: Bati AAB
```bash
eas build --platform android --profile production
```

Fichye `.aab` ap disponib sou `expo.dev` pou ou telechaje.

### Etap 4: Mete sou Google Play Console
1. Ale sou `play.google.com/console`
2. Kreye nouvo app → `Save Me — Secure Vault`
3. Package: `com.saveme.secure`
4. Upload `.aab` fichye a
5. Ranpli metadata, screenshot, icon
6. Soumèt pou revizyon (3-7 jou)

---

## 🔧 Konfigirasyon Backend (opsyonèl)

Pou SMS 2FA ak email reyèl, kreye yon backend ak:

```
POST /api/auth/send-sms    → Twilio SMS
POST /api/auth/send-email  → SendGrid Email
```

Chanje `API_BASE` nan `src/services/twoFactor.js`:
```js
const API_BASE = 'https://your-backend.com/api';
```

---

## 💳 Abonneman Stripe

Ajoute Stripe pou paieman nan `PlansScreen.jsx`:
```bash
npm install @stripe/stripe-react-native
```

---

## 🎨 Couleurs Save Me (Drapeau Ayisyen)

| Couleur | Valè |
|---------|------|
| Rouge | `#D32F2F` |
| Bleu | `#1565C0` |
| Fon | `#0A0A1A` |
| Kart | `#12122A` |
| Vèt sekirite | `#4CAF50` |
