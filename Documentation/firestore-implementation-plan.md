# Firestore implementation plan

> Spark-plan update: Account deletion now runs in the client using a permanent, owner-created deletion marker and retryable batched cleanup. The Cloud Functions and scheduled recovery instructions below describe the earlier design and are not part of the current deployment. An interrupted deletion requires the user to sign in and retry. Deploy the updated rules before the updated client.

## Goal

Persist each user's tasks, completion status, and associated timers in Cloud Firestore. Users should only be able to access their own tasks, and unauthenticated requests must be denied.

The project already uses Firebase Authentication. Currently, `scripts/checklist.js` stores tasks and timers in memory, so they disappear when the page reloads.

## 1. Set up Firestore — complete

Marked complete as requested. The local Firestore configuration and rules are in the workspace root (the parent of `check-deck`); deployment status is not verified by this document.

### 1.1 Create the database

1. Open the [Firebase console](https://console.firebase.google.com/) and select the existing Check Deck project. Confirm its project ID matches the one in your local Firebase configuration.
2. In the navigation menu, open **Databases & Storage > Firestore**. If a suitable default Firestore database already exists, use it and review its current rules instead of creating another.
3. Select **Create database**, choose **Standard edition** and the default database ID, `(default)`, if prompted.
4. Choose the database location carefully based on the application's users and other Firebase services; the location cannot be changed after creation.
5. Select **Production mode** so client reads and writes are denied initially, and create the database. Do not use test mode for real user data.

See the [Firestore setup guide](https://firebase.google.com/docs/firestore/quickstart).

### 1.2 Initialize the Firestore SDK

1. Open `scripts/firebase.js`. It already initializes the Firebase app and exports `auth`.
2. Add a Firestore import using the same SDK version as the existing imports:

   ```js
   import { getFirestore } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";
   ```

3. After the existing `app` initialization, export the database instance:

   ```js
   export const db = getFirestore(app);
   ```

4. Keep the existing `auth` export and initialize the app only once. Future task code can import `db` and `auth` from this file.
5. Follow the README's local Firebase configuration instructions and run `node scripts/build-config.mjs` before serving the site. Do not enable persistent disk caching; the default web cache is in memory.

### 1.3 Add version-controlled rules and configuration

1. Install the [Firebase CLI](https://firebase.google.com/docs/cli#install_the_firebase_cli) if needed. Open a terminal in the `check-deck` directory and run `firebase login`.
2. Run `firebase init firestore`. Select the existing Firebase project and the default Firestore database if prompted. Review existing configuration and rules before accepting any overwrite prompts.
3. Choose `firestore.rules` and `firestore.indexes.json` as the rules and indexes file names. Confirm `firebase.json` points to these files and that the CLI's selected project is correct.
4. For initial setup, place the following deny-all rules in `firestore.rules`. This intentionally blocks the task feature until the owner-only rules and validation in step 3 are implemented and tested:

   ```text
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /{document=**} {
         allow read, write: if false;
       }
     }
   }
   ```

5. Add `firebase.json`, `firestore.rules`, and `firestore.indexes.json` to version control. Review `.firebaserc` before committing it to decide whether the project mapping belongs in the repository. Continue to keep local `.env` files and generated configuration out of version control as directed by `.gitignore`.

### 1.4 Deploy restrictive rules

1. Confirm the target project with `firebase projects:list` and inspect the current rules in the Firebase console. Deployment replaces the currently deployed rules, so assess the effect on any existing application data before proceeding.
2. Review the local `firestore.rules` file and deploy only the rules:

   ```sh
   firebase deploy --only firestore:rules --project YOUR_PROJECT_ID
   ```

3. Open **Firestore > Rules** in the Firebase console and confirm that the deployed rules match the intended deny-all rules.
4. Verify client access is denied while the initial rules are active. Before enabling task storage, replace these rules with the owner-only validation rules described in step 3, test them in the Firestore Emulator, and deploy them using the same rules-only command.

See [Firebase's rules deployment guide](https://firebase.google.com/docs/rules/manage-deploy).

## 2. Store one document per task

1. Create a task data module, such as `scripts/tasks.js`, that imports `auth` and `db` from `scripts/firebase.js` and the required Firestore functions from the same SDK version.
2. After authentication resolves, construct the collection reference with `collection(db, "users", user.uid, "tasks")`. Obtain `user.uid` from Firebase Authentication, never from user input.
3. Use `addDoc` or an automatically generated document reference for each new task. Replace the current incrementing in-memory task ID with the Firestore document ID.
4. Save the following fields on creation; use `serverTimestamp()` for both timestamps:

Each task document will contain:

```text
title: "Study for exam"
status: "not-started" | "in-progress" | "completed"
createdAt: timestamp
updatedAt: timestamp
timer: null or {
  remainingSeconds: 1500,
  state: "paused" | "running",
  endsAt: timestamp or null
}
```

5. Trim the title and enforce the existing 120-character input limit. Set `status` to `not-started`; set `timer` to `null`, or to `{ remainingSeconds: 1500, state: "paused", endsAt: null }` when requested.
6. Set `updatedAt` to `serverTimestamp()` on every persisted change and retain `createdAt` unchanged. Store timer data, never a browser interval ID.
7. Export functions such as `createTask(user, title, hasTimer)`, `updateTask(user, taskId, changes)`, `deleteTask(user, taskId)`, and `subscribeToTasks(user, onData, onError)`. Build each document reference from the authenticated UID and document ID; reject calls without a current user. Return the `onSnapshot` unsubscribe function.
8. Import `collection`, `doc`, `addDoc`, `updateDoc`, `deleteDoc`, `onSnapshot`, `query`, `orderBy`, and `serverTimestamp` from `https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js`. Subscribe to the user's collection ordered by `createdAt`, and map each snapshot document to `{ id: doc.id, ...doc.data() }`.
9. Keep the owner UID and generation of each active subscription alongside its unsubscribe function. Before applying async results, verify both still match the current auth session. Track interval handles separately by task ID, not in Firestore.

## 3. Enforce privacy in Firestore

1. Open `../firestore.rules` from the `check-deck` directory. Add a match for `/users/{uid}/tasks/{taskId}`. Permit reads and deletes only when `request.auth != null && request.auth.uid == uid`.
2. Apply the same owner check to creates and updates, and validate the complete `request.resource.data`. Require only the documented fields; check types, a nonempty title of at most 120 characters, and the three allowed status values.
3. Validate that `timer` is either null or a map containing only the documented fields: a nonnegative integer `remainingSeconds` no greater than 60,000, a valid state, and a timestamp for `endsAt` when running or null when paused. Ensure timestamp fields have the expected types; require `createdAt` to remain unchanged on update.
4. Leave other paths denied unless explicitly needed. Inspect all matching rules: any matching `allow` can grant access, even if another match denies it. The page's JavaScript redirect alone does not protect database data.
5. Test these rules in the emulator as described in step 7 before replacing the initial deny-all rules in production. Include malformed documents and unexpected fields in the tests.
6. Use `keys().hasAll()` and `keys().hasOnly()` to check the task and timer maps; check `is string`, `is int`, and `is timestamp` before comparisons. Validate the paused/running deadline combinations separately. Test `serverTimestamp()` writes against the actual rules in the emulator.
7. Add a backend-managed deletion marker at `users/{uid}`. Rules should deny task creates and updates when that marker indicates deletion is in progress, while never permitting clients to set or clear the marker. Include concurrent writes and marker tampering in the tests. Design deletion-state transitions so an in-flight write cannot recreate task data after cleanup begins.

See [Firebase's Security Rules documentation](https://firebase.google.com/docs/firestore/security/rules-conditions).

## 4. Connect the task UI

1. Change the checklist script reference in `main.html` to `type="module"`, and import the task data functions and Firebase Authentication state listener into `scripts/checklist.js`.
2. Disable task actions while authentication and the first server-backed task snapshot are pending. After a user is confirmed, subscribe to that user's collection with `onSnapshot`; render documents using their Firestore IDs and update the count and empty state.
3. Replace the array-only form submission, status change, and remove handlers with the corresponding Firestore operations. Render saved data from the subscription and handle optimistic updates or pending writes explicitly.
4. On logout or account change, unsubscribe, stop all local timer intervals, clear the task list and related state, and ignore callbacks or pending results belonging to the previous user before starting a new subscription.
5. Display loading, permission, network, and write errors. Avoid reporting a pending or failed write as saved; offer a retry where appropriate. Keep task titles rendered using `textContent`.
6. In `main.html`, add a task status element with `role="status"` and a separate error element with `role="alert"`. Mark controls disabled until the first non-cache snapshot arrives; use snapshot metadata and a timeout/error message to explain offline or pending states.
7. Update `renderTask` to set `status.value` from the document before registering its change handler. On write failure, show the error and restore the last confirmed state. Reconcile snapshots without leaving duplicate DOM nodes or timer intervals.

## 5. Persist timers

1. When adding a timer or setting its duration, persist a paused timer with `remainingSeconds`, `state: "paused"`, and `endsAt: null`. Validate the minute and second inputs before saving.
2. On start, use a transaction to read the latest timer state, compute and save `endsAt` from the current time plus the remaining duration, and set its state to `running`. Calculate the display locally from the saved deadline; do not write every second.
3. On pause, transactionally calculate the remaining seconds from the current deadline, clamp the value to zero, set the state to `paused`, and clear `endsAt`. Do not perform UI side effects inside transaction callbacks, which may run more than once.
4. Rebuild local display intervals from task snapshots after reload or on another device. Clamp expired timers to zero and persist a paused, zero-remaining state using a transaction that verifies the deadline has not changed.
5. Handle offline transaction failures visibly and stop intervals when tasks are deleted or the user signs out. Client-computed deadlines depend on device clocks; use a trusted backend time source if precise cross-device timing is required. See [Firestore transactions](https://firebase.google.com/docs/firestore/manage-data/transactions).
6. Implement transaction helpers in `scripts/tasks.js` for setting, starting, pausing, and expiring a timer. Read the current document inside each transaction, check its timer state, and update only the timer and `updatedAt` fields. Treat a removed task or already changed deadline as a no-op or clear error.
7. In `scripts/checklist.js`, compute remaining seconds as `Math.max(0, Math.ceil((endsAt.toMillis() - Date.now()) / 1000))`. Recalculate from the deadline each tick rather than decrementing a counter; refresh on visibility changes and clear intervals when replacing a rendered task.

## 6. Handle logout and account deletion

1. Keep persistent disk caching disabled and do not store task data in `localStorage` or other durable browser storage. Clear displayed data and in-memory task state on auth changes, and ensure a new user cannot see the previous user's cached results. See [Firestore offline persistence](https://firebase.google.com/docs/firestore/manage-data/enable-offline).
2. In `scripts/account.js`, keep the confirmation and reauthentication steps. Replace the direct `deleteUser` call with a request to the trusted deletion endpoint; the backend deletes the authentication account after task cleanup succeeds.
3. Implement a trusted backend deletion endpoint that derives the UID from a verified, recently authenticated request; never accept an arbitrary target UID from the client. Prevent new task writes during deletion, delete all task documents in bounded batches, and make the process idempotent and retryable.
4. Persist deletion progress outside the browser and arrange retries or recovery if cleanup is interrupted. Delete the authentication account only after cleanup completes; report partial failures without claiming deletion succeeded. Protect backend credentials with least-privilege IAM.
5. Test logout during a pending write, account switching in another tab, deletion with many tasks, interrupted cleanup, and reauthentication failures.
6. Implement the endpoint as an authenticated callable backend function. Require recent authentication using the verified token's `auth_time`, derive the UID from that token, and atomically set a server-controlled deletion marker before scanning tasks. The security rules from step 3 must consult that marker for client writes.
7. Store a durable deletion job and state transitions such as `pending`, `deleting`, and `complete`; retry cleanup in bounded batches until the collection is empty. Ensure interrupted jobs can resume, then remove the Firebase Authentication user with the Admin SDK. Keep the deletion marker in place so stale clients cannot recreate data. Return progress or a recoverable error to the account page.

## 7. Verify and deploy

1. Configure the Firestore Emulator in `firebase.json`, confirm it loads the intended `firestore.rules`, and install the emulator with `firebase setup:emulators:firestore`. Configure the Authentication Emulator for full sign-in tests as needed.
2. Add automated rules tests using `@firebase/rules-unit-testing`. Create authenticated contexts for users A and B and an unauthenticated context. Confirm A can create, read, list, update, and delete A's tasks; B and the unauthenticated context must fail each operation on A's path. Reject malformed fields and cross-user queries.
3. Run the suite against the emulator, for example with `firebase emulators:exec --only firestore "YOUR_TEST_COMMAND"`; use the actual test command defined by the project. See [Firestore emulator testing](https://firebase.google.com/docs/firestore/security/test-rules-emulator).
4. Test the application against the emulators: create, edit, and delete tasks; reload; switch users and tabs; sign out; restore, start, pause, and expire timers; and exercise simultaneous updates, network failures, and account deletion.
5. Review the target Firebase project, deployed rules, indexes, and any backend permissions. Deploy and verify the tested rules and backend before deploying the application. Use the project's deployment process, then smoke-test with separate test accounts and a signed-out session.
6. Run Firebase CLI commands from the workspace root, where `firebase.json` and `firestore.rules` currently live. Create the test package and scripts there or explicitly configure paths so the emulator reads the root rules file. Use a demo project ID and explicitly connect client SDKs to the emulators in local tests; never point production code at them.
7. Add assertions for expired and malformed authentication, writes while deletion is marked, immutable creation timestamps, timer bounds, invalid fields, and listener cleanup. Verify that data from a prior user is not rendered from the in-memory cache after account switching.
8. Deploy the rules with `firebase deploy --only firestore:rules --project YOUR_PROJECT_ID`, then deploy the tested backend using its configured function target. Inspect the existing `firebaseUpdate.sh` and hosting `public` directory before deploying the site: the script copies files and deploys all configured services. Verify the intended project and staged files before running it.

## Security boundary

Firestore rules block unauthorized database requests; they cannot erase information a user has already seen, copied, or captured on a device. Administrative server credentials bypass Firestore rules and must be restricted separately. See [Firebase's documentation on server access](https://firebase.google.com/docs/firestore/solutions/role-based-access).
