# Shipping Operate to the App Store & Google Play

Operate is a PWA. To put it in the stores it's wrapped in a native shell with
[Capacitor](https://capacitorjs.com/) that **bundles the web assets inside the
app** (works offline; no dependency on the Netlify site being up). This repo now
contains everything needed to build and submit. What's here vs. what only you can
do:

| Done in this repo | Only you can do (needs your accounts / a Mac) |
| --- | --- |
| Capacitor config, `www/` build step | Create Apple Developer + Google Play accounts |
| Native `ios/` and `android/` projects | Sign the builds (certs / keystore) |
| App icons + splash (both platforms) | Archive & upload to App Store Connect / Play Console |
| Deep-link sign-in wiring | Fill in store listings, screenshots, privacy answers |
| This guide | Press "Submit for review" |

---

## 0. One-time decisions before you submit

- **App ID / bundle identifier: `app.operate.mobile`.** This is currently a
  placeholder. **It is permanent once you create the store listings** — you can
  never change it afterwards. If you own a domain, change it now to your own
  reverse-DNS id (e.g. `com.yourband.operate`). To change it:
  ```bash
  npx cap migrate    # not needed; instead edit the id in these 3 places:
  ```
  Edit `appId` in `capacitor.config.json`, then update the native projects:
  - iOS: Xcode → target **App** → *Signing & Capabilities* → Bundle Identifier
  - Android: `android/app/build.gradle` → `applicationId`
  Then also update `CFBundleURLName` in `ios/App/App/Info.plist`.
- **App name:** "Operate" (set in both projects already).
- **Version:** starts at `1.0` (build `1`). Bump for every upload (see §6).

---

## 1. Prerequisites

**Accounts (paid):**
- Apple Developer Program — **$99/year** — https://developer.apple.com/programs/
- Google Play Console — **$25 one-time** — https://play.google.com/console/signup

**Tools:**
- Node 20+ and npm (you already have this).
- **iOS: a Mac with Xcode 15+** (from the Mac App Store). There is no way to build
  or upload an iOS app without macOS.
- **Android: [Android Studio](https://developer.android.com/studio)** (any OS).

Install JS dependencies once:
```bash
npm install
```

---

## 2. Point the app at your Supabase project

The bundled app needs real Supabase credentials compiled in (`js/config.js`,
which is git-ignored). The `www/` build step generates it from environment
variables — the same ones Netlify uses:

```bash
export SUPABASE_URL="https://YOUR-PROJECT.supabase.co"
export SUPABASE_ANON_KEY="your-anon-key"
export SYNC_ENABLED="true"        # optional, if you use cloud sync
export REQUIRE_AUTH="true"        # optional, force sign-in
# ...plus any OPERATE_* vars you set on Netlify
```

(Alternatively, hand-write `js/config.js` from `js/config.example.js`; the build
keeps an existing real config if no env vars are set.)

The anon key is a public client key and is safe to ship in a client app — it's
already public on your website. Row-Level Security in Supabase is what protects
your data.

### Make magic-link sign-in work in the native app

Inside the app the web page is served from a local scheme, so the emailed
sign-in link can't return to the page the way it does in a browser. The app
handles this with a deep link (`js/native.js`), but **you must allow-list the
redirect URL in Supabase**:

1. Supabase dashboard → **Authentication → URL Configuration → Redirect URLs**
2. Add: `operate://auth-callback`
3. Save.

That's it — `sendMagicLink()` automatically uses that redirect when running
inside the app, and `js/native.js` completes the session when the link opens.

> **iOS notifications caveat:** the reminder notifications (incl. the USB
> reminder) use the Web Notifications API, which Apple's in-app web view does
> **not** support. Reminders will still fire in-app while Operate is open on
> iOS, but not in the background. Android supports them. If background iOS
> reminders become important, add `@capacitor/local-notifications` later — it's
> not required to ship. Nothing here blocks submission.

---

## 3. Build the web assets and sync into the native projects

Run this **every time you change any web code** (`index.html`, `js/…`, `styles.css`):

```bash
npm run sync
```

This builds `www/` (with your `config.js`) and copies it into both native
projects. If you changed icons, also run `npm run icons`.

---

## 4. iOS — build & submit (on a Mac)

1. **Open the project:**
   ```bash
   npm run open:ios      # opens ios/App in Xcode
   ```
   The first open resolves Swift Package dependencies automatically (Capacitor 8
   uses SPM, not CocoaPods).
2. **Signing:** Xcode → target **App** → *Signing & Capabilities* → check
   *Automatically manage signing* → select your Team. Xcode creates the
   provisioning profile.
3. **App Store Connect record:** at https://appstoreconnect.apple.com → *Apps →
   +* → New App. Platform iOS, name "Operate", bundle id `app.operate.mobile`,
   pick an SKU.
4. **Archive:** in Xcode set the run destination to *Any iOS Device (arm64)* →
   menu **Product → Archive**.
5. **Upload:** in the Organizer window that opens → *Distribute App → App Store
   Connect → Upload*.
6. **Fill in the listing** in App Store Connect (see §7), attach the build once
   it finishes processing (~10–30 min), then **Submit for Review**.

---

## 5. Android — build & submit

1. **Open the project:**
   ```bash
   npm run open:android      # opens android/ in Android Studio
   ```
   Let Gradle sync finish.
2. **Create an upload keystore** (once — keep it safe forever; losing it means you
   can't update the app):
   ```bash
   keytool -genkey -v -keystore operate-upload.keystore \
     -alias operate -keyalg RSA -keysize 2048 -validity 10000
   ```
   Reference it in `android/app/build.gradle` under a `signingConfigs` block, or
   use Android Studio → *Build → Generate Signed Bundle / APK* and point it at
   the keystore there. **Do not commit the keystore or its passwords.**
3. **Build an Android App Bundle (.aab):** Android Studio → *Build → Generate
   Signed Bundle / APK → Android App Bundle*. (Play requires `.aab`, not `.apk`.)
4. **Play Console:** https://play.google.com/console → *Create app* → fill
   details → *Production → Create new release* → upload the `.aab`.
5. Complete the content questionnaires (§7) and **roll out to production**
   (first release goes through review).

> Consider enabling **Play App Signing** (Play manages the release signing key) —
> recommended by Google and the default for new apps.

---

## 6. Versioning (every update after the first)

Bump before each upload:

- **iOS:** Xcode → target **App** → *General* → Version (`MARKETING_VERSION`) and
  Build (`CURRENT_PROJECT_VERSION`). Build must increase every upload.
- **Android:** `android/app/build.gradle` → increment `versionCode` (integer,
  every upload) and update `versionName` (user-facing string).

---

## 7. Store listing checklist

You'll need these for both stores:

- **App name & subtitle**, **description**, **keywords** (iOS), **category**
  (Business or Productivity fits).
- **Screenshots** — take them in the iOS Simulator / an Android emulator or
  device. iOS requires 6.7" (iPhone) sizes at minimum; Play requires at least 2
  phone screenshots. A **512×512 icon** (Play) and **1024×1024 icon** (App Store —
  already in `icons/icon-1024.png`).
- **Privacy policy URL** — **required by both stores.** Host a page (e.g. add
  `/privacy` to the Netlify site) describing what data Operate stores (tour data
  in Supabase, email for sign-in) and how to delete it.
- **Data safety / App Privacy answers:** Operate collects **Email** (sign-in) and
  **User content** (your tour data), used for app functionality, not for
  tracking/ads. It does **not** use device location, camera, or contacts in the
  background — camera/photos are only accessed when *you* attach a file.
- **Account deletion:** both stores require an in-app way to delete your account
  and data. Operate already has this: **Account & sync → Delete all cloud data**.
  Point the reviewer to it in the review notes.

**Review notes for both stores** — provide a **demo account** (email + how to get
a magic link, or set `OPERATE_DEV_MODE`) so reviewers can see past the sign-in
screen. Apps that block review behind an un-testable login get rejected.

---

## 8. Avoiding the common rejection reasons

- **Apple 4.2 "minimum functionality" (thin web wrappers):** Operate bundles its
  assets and behaves as a real app (offline, native icon/splash, file attach,
  deep-link auth) — not a Safari shortcut. That's what Apple looks for. Don't
  switch to loading the remote URL in a bare web view.
- **Crash on camera/photos:** handled — usage-description strings are in
  `Info.plist`. Don't remove them.
- **Login wall with no demo access:** give reviewers a working account (§7).
- **Missing privacy policy / account deletion:** covered in §7 — make sure both
  are actually live before submitting.

---

## 9. Everyday workflow, summarized

```bash
# after editing web code:
npm run sync

# iOS:
npm run open:ios      # → Xcode → Archive → Distribute

# Android:
npm run open:android  # → Generate Signed Bundle → upload .aab
```

That's the whole loop. The web app, Netlify deploy, and Supabase backend are all
unchanged — the native shells are an additive layer on top.
