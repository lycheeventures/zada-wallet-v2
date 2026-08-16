# Deep links, the PIN lock, and batch import — how they interact (and how they break)

Written after the Aug 2026 batch-migration debugging run (PRs #29, #31, #32). Read this before
touching `+native-intent.tsx`, `BackgroundLockProvider`, `authenticate.tsx`, the `(app)/_layout`
lock redirect, or `MigrateBatchScreen` — every bug here came from a plausible-looking change to one
of those files interacting badly with the others.

## The flow

The migration / ZADA ID web flow runs in an in-app browser (`WebBrowser.openBrowserAsync`):
SFSafariViewController on iOS, a Chrome Custom Tab on Android. When the user taps "Add (all) to
wallet" on the web page, it fires a deep link
(`id.animo.paradym:///wallet/credential-offer-batch?batch=<token>` for batch, or a single
credential-offer link). From there:

1. **`+native-intent.tsx` → `redirectSystemPath` (sync!)** maps the URL to a route. If the wallet
   is (or might be) locked it wraps it: `/authenticate?redirectAfterUnlock=<encoded target>`.
   On iOS it also dismisses the browser overlay here (see "The two Android bugs" below for why
   that call must stay iOS-only).
2. **`authenticate.tsx`** takes the PIN and then redirects to `redirectAfterUnlock`.
3. **`(app)/_layout.tsx`** is the safety net for in-app locking: when the wallet locks while a
   route is focused, it stores the pathname and redirects to `/authenticate?redirectAfterUnlock=…`.
4. **`BackgroundLockProvider`** locks the wallet when the app has been backgrounded/inactive
   for >60s. The in-app browser counts as inactive on iOS and as background on Android, so a
   long web session (reading the migration page, OTP entry…) always re-locks the wallet —
   **batch migration virtually always arrives at a locked wallet.**

## Why Android is special

On iOS the deep link arrives, then the app becomes active — one order, always. On Android the
deep-link `VIEW` intent, the AppState `active` transition, the >60s lock, and the (app) layout's
locked-redirect all land in the same beat, and the interleaving is **not deterministic** (observed
on device and emulator: same steps landed on the batch screen, the PIN gate, or the dashboard on
different runs). When the layout's bare locked-redirect wins the race, the
`redirectAfterUnlock` param is dropped: the user unlocks and lands on the dashboard, and the
import is silently lost.

## Defense in depth (current design)

Route params remain the primary mechanism, but the deep-link target is ALSO recorded out-of-band
in `apps/easypid/src/utils/pendingDeeplink.ts` (module state, 5-minute TTL, dies with the JS
process):

- `+native-intent.tsx` calls `setPendingDeeplink(target)` for batch and invitation deep links.
- `authenticate.tsx` falls back to `peekPendingDeeplink()` if it unlocks with **no**
  `redirectAfterUnlock` param.
- The home dashboard (`FunkeWalletScreen`) subscribes via `onPendingDeeplink` for the
  no-navigation-happened-at-all case (wallet already unlocked on the dashboard); the push is
  deferred and focus-gated.
- `(app)/_layout.tsx` calls `clearPendingDeeplink(pathname)` when the target route actually
  mounts — this ends the lifecycle on every successful path, which is what guarantees the
  fallbacks can never **double**-navigate. That matters because batch tokens and OID4VCI offers
  are single-use: mounting the import screen twice consumes the token twice and the second mount
  shows "Nothing to add".

If you change navigation in this area, preserve all four pieces, and keep `redirectSystemPath`
**sync** (an async handler breaks cold-start deep links — see the note in the file).

## The two Android bugs this design came from

1. **Blank blue screen (crash) on the batch screen.** `WebBrowser.dismissBrowser()` is an
   iOS-only API — but on Android it does not reject, it returns **`undefined`**, so
   `WebBrowser.dismissBrowser().catch(…)` throws `TypeError: Cannot read property 'catch' of
   undefined` and takes the whole React tree down → the user sees the bare window background
   (solid blue) and nothing responds. **Rule: never call `WebBrowser.dismissBrowser()` without a
   `Platform.OS === 'ios'` guard.** The crash was masked for weeks because the redirect race
   (bug 2) meant >60s sessions never actually reached the batch screen on Android.
2. **Redirect param lost in the lock race** — the non-determinism described above. Fixed by the
   pending-deeplink store.

The bugs were sequential: fixing the race exposed the crash; fixing the crash exposed that the
race fix via params alone was still insufficient on real devices.

## Emulator repro recipe

Local AVD (`zada-test`, Android 35 arm64) + the preview APK (`com.zadanetwork.wallet.preview`,
launcher activity `.MainActivity` under that package — NOT `com.zadanetwork.wallet/.MainActivity`).
The lock race + batch flow reproduces without any web flow:

```bash
adb shell input keyevent KEYCODE_HOME     # background the app
sleep 70                                  # cross the 60s lock threshold
adb shell am start -a android.intent.action.VIEW \
  -d "id.animo.paradym:///wallet/credential-offer-batch?batch=<token-or-fake>" \
  com.zadanetwork.wallet.preview
# enter PIN, then:
adb logcat -d | grep -E "ReactNativeJS|AndroidRuntime"
```

A fake token exercises the full navigation path and ends on the (correct) "Nothing to add" error
state; a crash shows up as a `ReactNativeJS` fatal in logcat. Note the emulator's event timing is
even less deterministic than real devices (host clock jumps) — a passing emulator run does NOT
prove the race is gone; it only proves a crash is. Real-device verification is required for the
race.
