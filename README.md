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
