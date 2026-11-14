# study-buddy
A cute little productivity program.

This website is hosted at https://check-deck.web.app
I give you no guarentee that it is up to date, however.
So basically, just ping @Adam if you need it updated.

## Local Firebase configuration

Copy `.env.example` to `.env` and fill in the Firebase web app values. Before
serving or deploying the site, run:

```sh
node scripts/build-config.mjs
```

This generates the untracked firebase-config.js, which is required for the website to talk to firebase correctly.

## Account deletion

Account deletion runs in the browser and does not require Cloud Functions. A permanent Firestore marker blocks new task writes while the signed-in user deletes their tasks in batches, then deletes their authentication account. Keep the page open until it finishes; if interrupted, sign in and retry to resume. The marker remains after deletion. Deploy and test the updated Firestore rules before deploying the updated site. Any deletion jobs started by an older backend need administrator review and cleanup.

## Tests

Install Node.js 20 or newer and a Java runtime supported by the Firebase Firestore emulator, then run from `check-deck`:

```sh
npm install
npm test
```

The command starts a local Firestore emulator using the workspace root's `firebase.json` and `firestore.rules`, with the demo project `demo-check-deck`. The first run may download the emulator. The tests cover ownership, field validation, timer constraints, and deletion markers; they do not connect to production. For an already running emulator, set `FIRESTORE_EMULATOR_HOST` and run `npm run test:rules`.

Browser flows, authentication token expiry, cross-tab switching, offline retry, and full account deletion still need end-to-end tests; these rules tests do not verify them.
