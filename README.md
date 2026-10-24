# study-buddy
A cute little productivity program.

This website is hosted at https://check-deck.web.app
I give you no guarentee that it is up to date, however.
So basically, ping @Adam if you need it updated.

## Local Firebase configuration

Copy `.env.example` to `.env` and fill in the Firebase web app values. Before
serving or deploying the site, run:

```sh
node scripts/build-config.mjs
```

This generates `scripts/firebase-config.js`, which is ignored by Git. The
generated config is still delivered to browsers, so the Firebase web API key is
not a secret. Keep Firebase services protected with Authentication, Security
Rules, and appropriate API key restrictions.