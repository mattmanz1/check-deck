import { after, before, beforeEach, describe, it } from "node:test";
import { readFile } from "node:fs/promises";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, collectionGroup, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, Timestamp, updateDoc, where, writeBatch } from "firebase/firestore";

const projectId = "demo-check-deck";
let env;
const task = (db, uid = "alice", id = "task1") => doc(db, "users", uid, "tasks", id);
const marker = (db, uid = "alice") => doc(db, "users", uid);
const valid = (overrides = {}) => ({ title: "Study", status: "not-started", createdAt: serverTimestamp(), updatedAt: serverTimestamp(), timer: null, ...overrides });
const alice = () => env.authenticatedContext("alice").firestore();
const bob = () => env.authenticatedContext("bob").firestore();
const anonymous = () => env.unauthenticatedContext().firestore();

before(async () => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error("Run npm test to start the Firestore emulator; never run against production.");
  env = await initializeTestEnvironment({ projectId, firestore: { rules: await readFile(new URL("../../firestore.rules", import.meta.url), "utf8") } });
});
beforeEach(async () => { await env.clearFirestore(); });
after(async () => { if (env) await env.cleanup(); });

async function seed() {
  await env.withSecurityRulesDisabled(async (context) => {
    await setDoc(task(context.firestore()), { title: "Study", status: "not-started", createdAt: Timestamp.fromMillis(1000), updatedAt: Timestamp.fromMillis(1000), timer: null });
  });
}

describe("task ownership", () => {
  it("allows the owner to create, read, list, update and delete", async () => {
    const db = alice();
    await assertSucceeds(setDoc(task(db), valid()));
    await assertSucceeds(getDoc(task(db)));
    await assertSucceeds(getDocs(collection(db, "users", "alice", "tasks")));
    await assertSucceeds(updateDoc(task(db), { status: "completed", updatedAt: serverTimestamp() }));
    await assertSucceeds(deleteDoc(task(db)));
  });
  for (const [name, client] of [["another user", bob], ["an anonymous user", anonymous]]) {
    it(`denies ${name} all access to another user's tasks`, async () => {
      await seed();
      const db = client();
      await assertFails(getDoc(task(db)));
      await assertFails(getDocs(collection(db, "users", "alice", "tasks")));
      await assertFails(setDoc(task(db, "alice", "new"), valid()));
      await assertFails(updateDoc(task(db), { status: "completed", updatedAt: serverTimestamp() }));
      await assertFails(deleteDoc(task(db)));
    });
  }
  it("denies collection-group queries across users", async () => {
    await seed();
    await assertFails(getDocs(query(collectionGroup(alice(), "tasks"), where("status", "==", "not-started"))));
  });
});

describe("task validation", () => {
  const invalid = [
    ["empty title", { title: "" }], ["long title", { title: "x".repeat(121) }],
    ["invalid title type", { title: 12 }], ["invalid status", { status: "done" }],
    ["extra field", { extra: true }], ["missing timer", { timer: undefined }],
    ["invalid timestamp", { createdAt: "today" }],
    ["negative duration", { timer: { remainingSeconds: -1, state: "paused", endsAt: null } }],
    ["too long", { timer: { remainingSeconds: 60001, state: "paused", endsAt: null } }],
    ["fractional duration", { timer: { remainingSeconds: 1.5, state: "paused", endsAt: null } }],
    ["paused with deadline", { timer: { remainingSeconds: 1, state: "paused", endsAt: Timestamp.now() } }],
    ["running without deadline", { timer: { remainingSeconds: 1, state: "running", endsAt: null } }],
    ["timer extra field", { timer: { remainingSeconds: 1, state: "paused", endsAt: null, extra: 1 } }],
  ];
  for (const [name, changes] of invalid) {
    it(`rejects ${name}`, async () => {
      const data = valid(changes);
      if (changes.timer === undefined && Object.hasOwn(changes, "timer")) delete data.timer;
      await assertFails(setDoc(task(alice()), data));
    });
  }
  it("accepts timer boundaries and a running timestamp", async () => {
    const db = alice();
    await assertSucceeds(setDoc(task(db), valid({ timer: { remainingSeconds: 0, state: "paused", endsAt: null } })));
    await assertSucceeds(updateDoc(task(db), { timer: { remainingSeconds: 60000, state: "running", endsAt: Timestamp.now() }, updatedAt: serverTimestamp() }));
  });
  it("rejects changing creation time or omitting the server update timestamp", async () => {
    await seed();
    const ref = task(alice());
    await assertFails(updateDoc(ref, { createdAt: serverTimestamp(), updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(ref, { status: "completed" }));
  });
});

describe("deletion marker", () => {
  it("allows only the owner to create a permanent true marker", async () => {
    await assertFails(setDoc(marker(bob()), { deletionInProgress: true }));
    await assertFails(setDoc(marker(anonymous()), { deletionInProgress: true }));
    await assertFails(setDoc(marker(alice()), { deletionInProgress: false }));
    await assertFails(setDoc(marker(alice()), { deletionInProgress: true, extra: true }));
    await assertSucceeds(setDoc(marker(alice()), { deletionInProgress: true }));
    await assertFails(updateDoc(marker(alice()), { deletionInProgress: false }));
    await assertFails(deleteDoc(marker(alice())));
  });
  it("blocks new and updated tasks after locking but permits cleanup", async () => {
    await seed();
    const db = alice();
    await assertSucceeds(setDoc(marker(db), { deletionInProgress: true }));
    await assertFails(setDoc(task(db, "alice", "new"), valid()));
    await assertFails(updateDoc(task(db), { status: "completed", updatedAt: serverTimestamp() }));
    await assertSucceeds(deleteDoc(task(db)));
  });
  it("blocks later writes when a marker and task are committed together", async () => {
    const db = alice();
    const batch = writeBatch(db);
    batch.set(marker(db), { deletionInProgress: true });
    batch.set(task(db), valid());
    await assertSucceeds(batch.commit());
    await assertFails(updateDoc(task(db), { status: "completed", updatedAt: serverTimestamp() }));
    await assertSucceeds(deleteDoc(task(db)));
  });
});
