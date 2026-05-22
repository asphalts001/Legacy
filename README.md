# Legacy

Legacy is a mobile-first study app built as a static web application and packaged with Cordova. It combines revision compendiums, timed MCQ practice, local progress tracking, optional Supabase login/sync, audio ambience, and exportable study logs.

The app is currently focused on NEET-style preparation content:

- Chemistry compendium and reaction/reagent reference.
- Physics concept/revision reference.
- Fixed 45-question chemistry practice test.
- JSON-driven MCQ practice engine with 24 bundled question sets.
- Dashboard with recent attempts, accuracy, question count, and export.
- Optional cloud sync after sign-in.

## Project Layout

```text
.
|-- config.xml                 # Cordova app metadata, plugins, Android/iOS settings
`-- www/
    |-- index.html             # Main dashboard and account/sync menu
    |-- pbl_full_pasha.html    # Chemistry reference compendium
    |-- egyptian.html          # Physics revision/reference compendium
    |-- germania.html          # Built-in 45-question chemistry quiz
    |-- phiross_factory.html   # JSON-set MCQ engine
    |-- phiross.html           # Additional quiz/practice page
    |-- StateManager.js        # Local app-state persistence
    |-- tracker.js             # Session logging and stats
    |-- auth.js                # Supabase auth UI bridge
    |-- sync.js                # Supabase Edge Function sync queue
    |-- audio.js               # Cordova Media audio helper
    |-- theme.css              # Shared visual system
    |-- gm.css                 # Germania quiz styles
    |-- audio/                 # Bundled .m4a background tracks
    `-- data/                  # Manifest plus bundled MCQ JSON sets
```

## Main Screens

`www/index.html` is the hub. It links to all study modes, shows activity stats, exposes sign-in/sign-up, provides manual cloud sync controls, and exports study history as a text file.

`www/phiross_factory.html` loads question-set metadata from `www/data/manifest.json`, validates the chosen JSON file, renders a timed quiz, calculates NEET-style marks, and records the result through `Tracker.logScore()`.

`www/germania.html` is a standalone 45-question chemistry quiz with timer, per-question checking, flags, progress, results, and performance summary.

`www/pbl_full_pasha.html` and `www/egyptian.html` are tabbed reference pages with search/navigation for chemistry and physics review.

## Data

The bundled MCQ bank lives in `www/data/`.

- `manifest.json` lists 24 available sets.
- Set files use arrays of question objects.
- Total bundled JSON questions: 789.
- Expected question shape:

```json
{
  "id": "set_01_q1",
  "question": "Question text",
  "options": ["A", "B", "C", "D"],
  "correctIndex": 2,
  "explanation": "",
  "tags": [],
  "difficulty": "medium"
}
```

## Running Locally

Because the app fetches local JSON files, use a local static server instead of opening files directly:

```bash
cd www
python3 -m http.server 8080
```

Then open:

```text
http://localhost:8080/index.html
```

For Cordova builds, this repo contains `config.xml` and `www/`, but no committed `package.json` or generated `platforms/` directory. A Cordova CLI setup must add/install platforms and plugins before building.

## Cordova Features

Configured plugins:

- `cordova-plugin-media` for background audio.
- `cordova-plugin-file` for file writing/export support.
- `cordova-plugin-x-socialsharing` for native share-sheet export.

Android configuration targets SDK 34, minimum SDK 29, package id `com.asphalts.legacy`, app version `2.0.0`, and deep link scheme `com.asphalts.legacy://login`.

## Sync And Storage

Local progress is stored in `localStorage`:

- `app_state` stores sessions and computed stats.
- `musicOn` stores audio preference.
- `user_sync_data` stores queued sync snapshots.

Cloud sync uses Supabase Auth plus an Edge Function endpoint at:

```text
https://oscpkrgxjpsyoylxdpxg.supabase.co/functions/v1/sync-api
```

The app signs users in with email/password or Google OAuth, queues local snapshots, pushes unsynced data, and can restore server data manually.

## Review Notes

- The project is intentionally framework-free: no React/Vue build step, no bundler, and no backend code in this repo.
- Most page logic is inline inside HTML files, with shared persistence/sync/audio scripts under `www/`.
- Supabase project URL and publishable anon key are embedded client-side, which is normal for Supabase public clients, but Row Level Security and Edge Function authorization must be correct server-side.

