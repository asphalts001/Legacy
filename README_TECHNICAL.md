# Legacy Technical README

This document describes the implementation architecture of Legacy in more depth. For a shorter reviewer overview, see `README.md`.

## Runtime Model

Legacy is a static HTML/CSS/JavaScript app under `www/`, wrapped by Cordova through `config.xml`. There is no bundler, package manifest, transpilation step, or module graph beyond one ES module import for `sync.js` in `index.html`.

The app relies on browser APIs in web preview and Cordova APIs in native builds:

- DOM APIs for rendering and interaction.
- `localStorage` for durable client state.
- `fetch()` for JSON-set loading and Supabase sync calls.
- Cordova `Media` for audio playback.
- Cordova File plus Social Sharing for native export/share behavior.

## Entry Points

### `www/index.html`

Dashboard and navigation shell.

Responsibilities:

- Shows links into the study/practice modules.
- Renders dashboard stats from `Tracker.getStats()`.
- Renders recent activity from `Tracker.getRecent()`.
- Provides text export through `Tracker.exportJSON()`.
- Hosts account menu, Supabase auth controls, and manual sync controls.
- Loads scripts in this effective order:
  - `cordova.js`
  - Supabase CDN SDK
  - `auth.js`
  - `StateManager.js`
  - `tracker.js`
  - `sync.js` as an ES module
  - `audio.js`

Important detail: `auth.js` calls `Auth.checkSession()` as soon as it loads. The account menu elements already exist by that point because scripts are placed near the bottom of the document.

### `www/phiross_factory.html`

Primary reusable MCQ engine.

Flow:

1. On `DOMContentLoaded`, call `renderHistory()` and `loadManifest()`.
2. `loadManifest()` fetches `data/manifest.json`.
3. Selecting a set fetches the selected JSON file.
4. `parseAndValidateQuestions()` validates every question object.
5. `loadQuiz()` initializes quiz state and renders cards.
6. `selectOpt()` records selected options.
7. `checkOne()` reveals the correct answer for one question.
8. `submitAll()` checks all remaining questions and calls `showResults()`.
9. `showResults()` calculates:
   - `correct`
   - `wrong`
   - `skipped`
   - NEET score: `correct * 4 - wrong`
   - accuracy over attempted questions
10. Results are persisted with `Tracker.logScore()`.

Timer policy: one minute per question. When time reaches zero, the quiz auto-submits.

### `www/germania.html`

Standalone fixed chemistry quiz.

Characteristics:

- Contains 45 hardcoded questions in the page.
- Uses a 45-minute timer.
- Supports selection, per-question checking, flags, explanations, progress, and final summary.
- Calculates NEET marks with the same `correct * 4 - wrong` rule.

This page does not depend on the JSON-set manifest.

### `www/pbl_full_pasha.html`

Chemistry reference compendium.

Characteristics:

- Tabbed sections for inorganic, physical, and organic chemistry.
- Search clones matching cards/reactions/flows into a search-results view.
- Self-contained CSS and page script.

### `www/egyptian.html`

Physics reference compendium.

Characteristics:

- Tabbed content for concepts, mechanics, thermodynamics/waves, electromagnetism, optics/modern physics, graphs/logic, and traps.
- Mostly self-contained static reference UI.

### `www/phiross.html`

Additional quiz/practice page with its own inline quiz engine and audio initialization. It uses the shared visual language and Cordova/audio setup, but the implementation is page-local rather than JSON-manifest driven.

## Shared Modules

### `www/StateManager.js`

Global namespace: `window.StateManager`

State key:

```text
app_state
```

Current version:

```text
2
```

Default shape:

```js
{
  version: 2,
  sessions: [],
  stats: { totalSessions: 0, avgScore: 0 }
}
```

API:

- `loadState()`
- `saveState(state)`
- `computeStats(sessions)`
- `defaultState`
- `STATE_VERSION`
- `STORAGE_KEY`

There is no migration path. If the stored version differs from `STATE_VERSION`, `loadState()` returns the default state.

### `www/tracker.js`

Global namespace: `window.Tracker`

Tracker wraps `StateManager` and exposes the app-level study history API.

Primary methods:

- `logScore(details)`
- `logRead(setId, subject)`
- `reload()`
- `getStats()`
- `getRecent(limit)`
- `exportJSON()`
- `timeAgo(timestamp)`
- `resetToDefault()`

Session shape:

```js
{
  type: "score",
  timestamp: Date.now(),
  details: {
    subject: "MCQ",
    topic: "Set 01",
    score: 120,
    correct: 35,
    wrong: 20,
    skipped: 5,
    total: 60,
    accuracy: 64
  }
}
```

Stats are recomputed from `score` sessions. The current override returns:

```js
{
  totalSessions,
  totalQuestions,
  avgAccuracy
}
```

On every local persistence event, `tracker.js` dispatches `tracker:update`. If `window.SyncEngine` exists, it also calls:

```js
window.SyncEngine.saveAndSync(state.sessions)
```

Note: `saveAndSync()` receives the full `state.sessions` array as the payload, so sync snapshots are arrays of sessions rather than single session objects.

### `www/auth.js`

Page-global binding: `Auth`.

Uses Supabase JS v2 from CDN:

```text
https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2
```

Supported auth methods:

- Email/password sign-up.
- Email/password sign-in.
- Google OAuth.
- Sign-out.
- Session check with dashboard UI toggling.

When a session is active, the auth panel is hidden, sync controls are shown, the user email is displayed, and `SyncEngine.processQueue()` is called if available.

### `www/sync.js`

ES module export:

```js
export const SyncEngine = { ... }
```

Also bridges itself to `window.SyncEngine`.

Sync endpoint:

```text
https://oscpkrgxjpsyoylxdpxg.supabase.co/functions/v1/sync-api
```

Local sync key:

```text
user_sync_data
```

Core behavior:

- `saveAndSync(payload)` appends a pending snapshot to `user_sync_data`.
- `processQueue()` exits in degraded mode when offline.
- Pending records are sent with `PUT` to the Supabase Edge Function.
- Successful pushes mark all non-synced local records as `synced`.
- `pullFromServer()` fetches server data and writes it to `user_sync_data`.
- A heartbeat runs every 60 seconds and again shortly after window load.

Auth token lookup reads from:

```text
sb-oscpkrgxjpsyoylxdpxg-auth-token
```

The sync request includes both the Bearer token and the Supabase publishable key in headers.

### `www/audio.js`

Page-global binding: `AudioManager`.

State key:

```text
musicOn
```

Behavior:

- Waits for Cordova `deviceready`.
- Creates a Cordova `Media` instance for `/android_asset/www/audio/<filename>`.
- Loops playback by seeking to zero when playback stops.
- Sets volume to `0.3` after media starts.
- Renders a simple toggle button if `#music-toggle` exists.

Bundled audio files:

- `chem.m4a`
- `dashboard.m4a`
- `mcq.m4a`
- `physics.m4a`

## Data Contract

`www/data/manifest.json` is an array:

```json
[
  { "id": "set_01", "label": "Set 01", "file": "data/set_01.json" }
]
```

Each set file is an array of questions:

```json
{
  "id": "set_01_q1",
  "question": "Question text",
  "options": ["Option A", "Option B", "Option C", "Option D"],
  "correctIndex": 2,
  "explanation": "",
  "tags": [],
  "difficulty": "medium"
}
```

Validation rules in `phiross_factory.html`:

- Question must be an object.
- `id` must be a non-empty string.
- `question` must be a non-empty string.
- `options` must be an array with at least two non-empty strings.
- `correctIndex` must be a valid numeric index.
- `explanation`, when present, must be a string.
- `tags`, when present, must be an array of strings.
- `difficulty`, when present, must be one of `easy`, `medium`, or `hard`.

Bundled set sizes:

```text
set_01: 39  set_02: 39  set_03: 39  set_04: 39
set_05: 39  set_06: 39  set_07: 39  set_08: 39
set_09: 37  set_10: 36  set_11: 34  set_12: 32
set_13: 28  set_14: 24  set_15: 24  set_16: 21
set_17: 20  set_18: 18
set_s1: 40  set_s2: 40  set_s3: 40  set_s4: 40
set_s5: 40  set_s6: 33
```

Total bundled JSON-set questions: 789.

## Persistence And Events

Local persistence is centered on `localStorage`.

Keys:

```text
app_state
musicOn
user_sync_data
sb-oscpkrgxjpsyoylxdpxg-auth-token
```

Events:

- `statemanager:saved` is dispatched by `StateManager.saveState()`.
- `tracker:update` is dispatched by `tracker.js` after tracker persistence and reloads.

Dashboard and MCQ history views listen for `tracker:update` to re-render.

## Native Export Flow

The dashboard export function creates a formatted text log from score sessions.

Browser preview:

- Creates a `Blob`.
- Downloads `study-log-YYYY-MM-DD.txt` through a temporary anchor.

Cordova/native:

- Writes the file into `cordova.file.cacheDirectory` when available.
- Falls back to `cordova.file.dataDirectory`.
- Opens `plugins.socialsharing.shareWithOptions()` with the generated file.

## Cordova Configuration

`config.xml`:

- Widget id: `com.asphalts.legacy`
- Version: `2.0.0`
- App name: `Legacy`
- Entry point: `index.html`
- Android engine: `^12.0.0`
- Android min SDK: `29`
- Android target SDK: `34`
- Deep link: `com.asphalts.legacy://login`

Plugins:

```xml
<plugin name="cordova-plugin-media" spec="^6.1.0" />
<plugin name="cordova-plugin-file" spec="^7.0.0" />
<plugin name="cordova-plugin-x-socialsharing" spec="^6.0.0" />
```

The Android config requests `MODIFY_AUDIO_SETTINGS` and sets `android:requestLegacyExternalStorage="true"` for Android 10 file behavior.

## Local Development

Static preview:

```bash
cd www
python3 -m http.server 8080
```

Open:

```text
http://localhost:8080/index.html
```

Cordova build preparation, assuming Cordova CLI is installed:

```bash
cordova platform add android
cordova prepare android
cordova build android
```

This repository does not currently include `package.json`, `platforms/`, `plugins/`, or generated native projects.

## Risks And Maintenance Notes

- There is no formal test suite.
- Several large pages keep CSS and JavaScript inline, which makes reuse and review harder.
- `StateManager` has no migration logic despite versioned state.
- Sync currently stores snapshots separately from `app_state`; pulled data is written to `user_sync_data`, then `Tracker.reload()` reloads from `app_state`. Confirm server response shape and restore behavior before relying on cloud restore.
- Supabase URL and publishable key are public client config. Server-side RLS and Edge Function checks are the actual security boundary.
- `audio.js` uses Android asset paths, so browser playback is not equivalent to native Cordova playback.
- The app contains informal UI copy that should be reviewed before broad release.
