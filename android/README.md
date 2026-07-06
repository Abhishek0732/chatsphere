# ChatSphere — Android WebView Wrapper

A lightweight native Android app (**Kotlin + Jetpack Compose**) that runs the
entire ChatSphere web app inside a full-screen `WebView`. It's a thin, native
shell around your hosted website — JavaScript and every browser feature the app
uses are enabled.

- **~8 MB** APK, single activity, no bloat
- **minSdk 26** (Android 8.0+), **targetSdk 34** (Android 14)
- Builds **entirely inside Docker** — nothing is installed on your machine

---

## Table of contents
1. [What's enabled](#whats-enabled)
2. [Requirements](#requirements)
3. [Project structure](#project-structure)
4. [Step 1 — Configure your URL](#step-1--configure-your-url)
5. [Step 2 — Build the APK](#step-2--build-the-apk)
6. [Step 3 — Install on a phone](#step-3--install-on-a-phone)
7. [Other things you can change](#other-things-you-can-change)
8. [Making a signed release APK](#making-a-signed-release-apk)
9. [HTTPS is required for camera / mic / notifications](#https-is-required-for-camera--mic--notifications)
10. [Troubleshooting](#troubleshooting)
11. [Versions](#versions)

---

## What's enabled

| Feature | Status | How |
|---|---|---|
| JavaScript, DOM storage, IndexedDB/Web SQL | ✅ | `WebSettings` |
| Cookies (incl. third-party) | ✅ | `CookieManager` |
| Camera & microphone (voice notes, photos, calls) | ✅ | page `onPermissionRequest` granted + runtime perms |
| Notifications | ✅ | `POST_NOTIFICATIONS` requested at launch |
| Geolocation | ✅ | `onGeolocationPermissionsShowPrompt` granted |
| File upload (`input type=file`, camera capture) | ✅ | `onShowFileChooser` + activity result |
| File download (attachments) | ✅ | Android `DownloadManager` |
| Media autoplay (audio/video without a tap) | ✅ | `mediaPlaybackRequiresUserGesture=false` |
| Cleartext `http://` + mixed content | ✅ | `usesCleartextTraffic` + network security config |
| Self-signed / user CA certificates | ✅ | network security config trusts user CAs |
| Hardware **Back** navigates WebView history | ✅ | Compose `BackHandler` |

All the corresponding Android permissions are declared in the manifest and the
sensitive ones (camera, mic, location, notifications) are requested at launch.

---

## Requirements

- **Docker** installed (that's it — no Android Studio, JDK, Gradle or SDK on your
  machine).
- An Android phone running **Android 8.0+** to install the result, with
  *Install unknown apps* allowed for your file manager.

---

## Project structure

```
android/
├── Dockerfile                     # JDK 17 + Android SDK 34 + Gradle 8.9 builder
├── build.gradle.kts               # top-level plugins/versions
├── settings.gradle.kts            # repositories + module list
├── gradle.properties              # AndroidX, JVM args, caching
├── README.md                      # this file
└── app/
    ├── build.gradle.kts           # app module: SDK levels, deps (Compose)
    ├── proguard-rules.pro
    └── src/main/
        ├── AndroidManifest.xml    # permissions + launcher activity
        ├── java/com/chatsphere/app/MainActivity.kt   # the WebView shell
        └── res/
            ├── values/strings.xml        # ← YOUR URL + app name
            ├── values/colors.xml         # theme + icon colors
            ├── values/themes.xml         # dark, no action bar
            ├── xml/network_security_config.xml
            ├── drawable/ic_launcher_foreground.xml
            └── mipmap-anydpi-v26/ic_launcher.xml
```

---

## Step 1 & 2 — Set the URL and build the APK (in one go)

The website URL is **injected at build time** — you don't edit any file. The
easiest path auto-detects your Cloudflare tunnel URL and bakes it in.

### Easiest — auto-tunnel + build (recommended)

Make sure the web app is running first (`docker compose up -d` from the repo
root), then:

```bash
./android/build-apk.sh
```

This:
1. starts a Cloudflare quick tunnel on `http://localhost:5173`,
2. grabs the fresh `https://…trycloudflare.com` URL automatically,
3. builds the APK with that exact URL baked in, and
4. keeps the tunnel running (leave the terminal open so the URL stays live).

The APK lands at `android/app/build/outputs/apk/debug/app-debug.apk`, and the
live URL is printed at the end.

> On a different local port: `./android/build-apk.sh 8080`

### Fixed URL (a permanent host — no tunnel)

```bash
./android/build-apk.sh https://your-stable-url.example
```

### Manual (plain Docker, full control)

```bash
# Build the SDK + Gradle image once (~5 min, downloads the Android SDK).
docker build -t chatsphere-apk-builder android/

# Compile, passing your URL. First run pulls the Compose/AndroidX deps (~3–5 min);
# later runs are ~30s thanks to the cached Gradle volume.
docker run --rm \
  -v "$PWD/android":/project \
  -v chatsphere-gradle-cache:/root/.gradle \
  -w /project \
  chatsphere-apk-builder gradle --no-daemon assembleDebug \
  -Papp_url="https://your-url.example"
```

> Omit `-Papp_url` to fall back to the default in `app/build.gradle.kts`
> (`http://192.168.15.205:5173`).

The installable APK is always written to:

```
android/app/build/outputs/apk/debug/app-debug.apk
```

**Clean build** (if something looks stale):

```bash
docker run --rm -v "$PWD/android":/project -v chatsphere-gradle-cache:/root/.gradle \
  -w /project chatsphere-apk-builder gradle --no-daemon clean assembleDebug -Papp_url="https://your-url.example"
```

---

## Step 3 — Install on a phone

**Option A — copy the file (simplest):**
1. Transfer `app-debug.apk` to the phone (USB, email, cloud, `adb push`, etc.).
2. Tap it in a file manager → allow *Install unknown apps* → Install.

**Option B — with adb** (if you have adb and USB debugging on):
```bash
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

On first launch the app asks for camera, microphone, location and notification
permissions — allow them for full functionality.

---

## Other things you can change

| Want to change | File | Field |
|---|---|---|
| The website URL | *(build parameter)* | `-Papp_url=…` / default in `app/build.gradle.kts` |
| App display name | `res/values/strings.xml` | `app_name` |
| Package / app id | `app/build.gradle.kts` + manifest namespace | `applicationId` / `namespace` |
| Version shown to users | `app/build.gradle.kts` | `versionName`, `versionCode` |
| Min / target Android | `app/build.gradle.kts` | `minSdk`, `targetSdk` |
| Splash / status-bar / icon color | `res/values/colors.xml` | `app_background`, `ic_launcher_background` |
| Launcher icon shape | `res/drawable/ic_launcher_foreground.xml` | the vector paths |

After any change, re-run the build command in **Step 2b**.

---

## Making a signed release APK

The debug APK above is fine for personal use and testing. For a smaller,
production build (or to publish), make a **release** APK signed with your own key.

```bash
# 1. Generate a keystore once (keep this file safe — you need it for every update).
docker run --rm -v "$PWD/android":/project -w /project chatsphere-apk-builder \
  keytool -genkeypair -v -keystore release.keystore -alias chatsphere \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -storepass changeit -keypass changeit \
  -dname "CN=ChatSphere, O=ChatSphere, C=US"
```

Add a signing config to **`app/build.gradle.kts`** inside `android { }`:

```kotlin
signingConfigs {
    create("release") {
        storeFile = file("../release.keystore")
        storePassword = "changeit"
        keyAlias = "chatsphere"
        keyPassword = "changeit"
    }
}
buildTypes {
    release {
        isMinifyEnabled = false
        signingConfig = signingConfigs.getByName("release")
    }
}
```

Then build:

```bash
docker run --rm -v "$PWD/android":/project -v chatsphere-gradle-cache:/root/.gradle \
  -w /project chatsphere-apk-builder gradle --no-daemon assembleRelease
# → android/app/build/outputs/apk/release/app-release.apk
```

> Never commit `release.keystore` or its passwords. It's already covered by
> `.gitignore` patterns; keep the real passwords in a secure place.

---

## HTTPS is required for camera / mic / notifications

The wrapper enables everything on the native side, but browsers (including the
Android WebView) only expose the microphone, camera, and the Notifications API on
a **secure context** — i.e. **https://** or `localhost`. So:

| URL you point the app at | UI loads | Camera / mic / notifications |
|---|---|---|
| `https://…` (recommended) | ✅ | ✅ |
| `http://<LAN-IP>:5173` | ✅ | ❌ (blocked by the browser) |

If you host over https (or an https tunnel like Cloudflare), everything works.

---

## Troubleshooting

**Blank screen / "webpage not available"**
- The URL in `strings.xml` is wrong, or the site isn't reachable from the phone.
- If it's a LAN IP, the phone must be on the **same Wi-Fi** and your dev stack
  must be running.
- Confirm the URL opens in the phone's Chrome first.

**Camera / microphone / notifications don't work**
- The URL must be **https** (see the section above).
- Also check the app's permissions: phone **Settings → Apps → ChatSphere →
  Permissions** and enable Camera, Microphone, Location, Notifications.

**File picker or download does nothing**
- Grant Storage/Media permission when prompted, or in app settings.

**"App not installed" / "package conflicts"**
- Uninstall any previous ChatSphere build first, then reinstall.
- Make sure *Install unknown apps* is allowed for the app you're installing from.

**Gradle build fails or behaves oddly**
- Clear the cache volume and rebuild:
  `docker volume rm chatsphere-gradle-cache` then re-run Step 2b.
- Rebuild the image if the SDK seems broken:
  `docker build --no-cache -t chatsphere-apk-builder android/`.

**APK files are owned by root**
- The Docker build runs as root, so `app/build/...` is root-owned but
  world-readable — you can still copy the APK. To reclaim ownership:
  `sudo chown -R "$USER" android/app/build`.

---

## Versions

| Component | Version |
|---|---|
| Android Gradle Plugin | 8.5.2 |
| Kotlin | 2.0.21 |
| Gradle | 8.9 |
| Compose BOM | 2024.09.03 |
| compileSdk / targetSdk | 34 |
| minSdk | 26 |
| JDK | 17 |
