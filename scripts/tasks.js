import {
  addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query,
  serverTimestamp, updateDoc, runTransaction, Timestamp,
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import { auth, db } from "./firebase.js";

function taskCollection(user) {
  if (!user || auth.currentUser !== user) {
    throw new Error("A current authenticated user is required.");
  }
  return collection(db, "users", user.uid, "tasks");
}

function taskDocument(user, taskId) {
  if (typeof taskId !== "string" || !taskId || taskId.includes("/")) {
    throw new Error("A valid task ID is required.");
  }
  return doc(taskCollection(user), taskId);
}

export function createTask(user, title, hasTimer = false) {
  const tasks = taskCollection(user);
  if (typeof title !== "string" || !title.trim() || title.trim().length > 120) {
    throw new Error("Task title must contain between 1 and 120 characters.");
  }
  return addDoc(tasks, {
    title: title.trim(),
    status: "not-started",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    timer: hasTimer ? { remainingSeconds: 1500, state: "paused", endsAt: null } : null,
  });
}

export function updateTask(user, taskId, changes) {
  const task = taskDocument(user, taskId);
  if (!changes || typeof changes !== "object" || Array.isArray(changes) ||
      Object.keys(changes).some((key) => !["title", "status", "timer"].includes(key))) {
    throw new Error("Invalid task changes.");
  }
  if ("title" in changes && (typeof changes.title !== "string" ||
      !changes.title.trim() || changes.title.trim().length > 120)) {
    throw new Error("Task title must contain between 1 and 120 characters.");
  }
  if ("status" in changes && !["not-started", "in-progress", "completed"].includes(changes.status)) {
    throw new Error("Invalid task status.");
  }
  const updates = { ...changes, updatedAt: serverTimestamp() };
  if ("title" in updates) updates.title = updates.title.trim();
  return updateDoc(task, updates);
}

export function deleteTask(user, taskId) {
  return deleteDoc(taskDocument(user, taskId));
}

function changeTimer(user, taskId, calculate) {
  const reference = taskDocument(user, taskId);
  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(reference);
    if (!snapshot.exists()) throw new Error("This task no longer exists.");
    const timer = calculate(snapshot.data().timer);
    if (timer) transaction.update(reference, { timer, updatedAt: serverTimestamp() });
  });
}

export function setTimer(user, taskId, seconds) {
  if (!Number.isInteger(seconds) || seconds < 0 || seconds > 60000) throw new Error("Enter a duration between 0 and 60000 seconds.");
  return changeTimer(user, taskId, (timer) => {
    if (timer?.state === "running") throw new Error("Pause the timer before setting its duration.");
    return { remainingSeconds: seconds, state: "paused", endsAt: null };
  });
}

export function startTimer(user, taskId) {
  return changeTimer(user, taskId, (timer) => {
    if (!timer || timer.state !== "paused" || timer.remainingSeconds <= 0) return null;
    return { ...timer, state: "running", endsAt: Timestamp.fromMillis(Date.now() + timer.remainingSeconds * 1000) };
  });
}

export function pauseTimer(user, taskId) {
  return changeTimer(user, taskId, (timer) => {
    if (!timer || timer.state !== "running") return null;
    return { remainingSeconds: Math.max(0, Math.ceil((timer.endsAt.toMillis() - Date.now()) / 1000)), state: "paused", endsAt: null };
  });
}

export function expireTimer(user, taskId, deadline) {
  return changeTimer(user, taskId, (timer) => {
    if (!timer || timer.state !== "running" || !timer.endsAt.isEqual(deadline) || timer.endsAt.toMillis() > Date.now()) return null;
    return { remainingSeconds: 0, state: "paused", endsAt: null };
  });
}

export function subscribeToTasks(user, onData, onError) {
  const tasks = query(taskCollection(user), orderBy("createdAt"));
  let active = true;
  const stop = () => {
    active = false;
    unsubscribeSnapshot();
    unsubscribeAuth();
  };
  const unsubscribeSnapshot = onSnapshot(tasks, { includeMetadataChanges: true }, (snapshot) => {
    if (active && auth.currentUser === user) {
      onData(snapshot.docs.map((item) => ({ ...item.data(), id: item.id })), snapshot.metadata);
    }
  }, (error) => {
    if (active && auth.currentUser === user && onError) onError(error);
  });
  const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
    if (currentUser !== user && active) stop();
  });
  return stop;
}
