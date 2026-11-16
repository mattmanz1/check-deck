import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import { auth } from "./firebase.js";
import { createTask, newTaskId, deleteTask, subscribeToTasks, updateTask, setTimer, startTimer, pauseTimer, expireTimer } from "./tasks.js";
import { Timestamp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

const taskForm = document.querySelector("#task-form");
const taskInput = document.querySelector("#task-input");
const addTimerInput = document.querySelector("#add-timer");
const taskList = document.querySelector("#task-list");
const emptyState = document.querySelector("#empty-state");
const taskCount = document.querySelector("#task-count");
const taskStatus = document.querySelector("#task-status");
const taskError = document.querySelector("#task-error");

let currentUser = null;
let unsubscribeTasks = null;
let sessionGeneration = 0;
let firstServerSnapshotReceived = false;
let tasks = [];
let confirmedTasks = [];
let operations = [];
let retryTimer = null;
let pendingNotice = null;
let processing = false;
const timerIntervals = new Map();
const expiringTimers = new Set();

onAuthStateChanged(auth, (user) => {
  sessionGeneration += 1;
  const generation = sessionGeneration;
  unsubscribeTasks?.();
  clearTimerIntervals();
  expiringTimers.clear();
  unsubscribeTasks = null;
  currentUser = user;
  firstServerSnapshotReceived = false;
  clearTimeout(retryTimer);
  retryTimer = null;
  clearTimeout(pendingNotice);
  operations = [];
  processing = false;
  tasks = [];
  confirmedTasks = [];
  taskForm.reset();
  taskList.replaceChildren();
  updateTaskCount();
  clearError();

  if (!user) {
    setTaskStatus("Sign in to view your tasks.");
    setTaskActionsDisabled(true);
    return;
  }

  setTaskStatus("Loading your tasks...");
  setTaskActionsDisabled(true);
  unsubscribeTasks = subscribeToTasks(
    user,
    (nextTasks, metadata) => {
      if (generation !== sessionGeneration || auth.currentUser !== user) return;
      if (!firstServerSnapshotReceived && metadata.fromCache) {
        setTaskStatus("Waiting for a connection to load your tasks...");
        return;
      }
      if (!metadata.fromCache && !metadata.hasPendingWrites) {
        confirmedTasks = nextTasks;
        firstServerSnapshotReceived = true;
      }
      if (!operations.length) confirmedTasks = nextTasks;
      refreshTasks();
      updateSyncStatus(metadata.fromCache || metadata.hasPendingWrites);
      setTaskActionsDisabled(!firstServerSnapshotReceived);
    },
    (error) => {
      if (generation !== sessionGeneration || auth.currentUser !== user) return;
      setTaskStatus("Your tasks could not be loaded.");
      showError(readableError(error));
      setTaskActionsDisabled(true);
    },
  );
});

taskForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!readyForWrites()) return;
  const title = taskInput.value.trim();
  if (!title) return;
  const user = currentUser;
  const id = newTaskId(user);
  const hasTimer = addTimerInput.checked;
  const task = { id, title, status: "not-started", timer: hasTimer ? { remainingSeconds: 1500, state: "paused", endsAt: null } : null };
  enqueue({ apply: (list) => [...list.filter((item) => item.id !== id), task], save: () => createTask(user, id, title, hasTimer) });
  taskInput.value = "";
  addTimerInput.checked = false;
  taskInput.focus();
});

function renderTask(task) {
  const item = document.createElement("li");
  item.className = "task-item";
  item.dataset.status = task.status;
  item.dataset.taskId = task.id;

  const main = document.createElement("div");
  main.className = "task-main";
  const title = document.createElement("span");
  title.className = "task-title";
  title.textContent = task.title;

  const actions = document.createElement("div");
  actions.className = "task-actions";
  const status = document.createElement("select");
  status.className = "status-select";
  status.setAttribute("aria-label", `Status for ${task.title}`);
  for (const [value, label] of [["not-started", "Not started"], ["in-progress", "In progress"], ["completed", "Completed"]]) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    status.append(option);
  }
  status.value = task.status;
  status.addEventListener("change", () => changeStatus(task, status));

  const remove = document.createElement("button");
  remove.className = "remove-button";
  remove.type = "button";
  remove.textContent = "Remove";
  remove.setAttribute("aria-label", `Remove ${task.title}`);
  remove.addEventListener("click", () => removeTask(task, remove));
  actions.append(status, remove);
  main.append(title, actions);
  item.append(main);

  if (task.timer) {
    item.append(createTimerPanel(task));
  } else {
    const addTimer = document.createElement("button");
    addTimer.className = "timer-toggle";
    addTimer.type = "button";
    addTimer.textContent = "Add timer";
    addTimer.addEventListener("click", () => addTaskTimer(task, addTimer));
    item.append(addTimer);
  }
  return item;
}

function addTaskTimer(task) {
  if (!readyForWrites()) return;
  queueTimer(task, { remainingSeconds: 1500, state: "paused", endsAt: null }, (user) => setTimer(user, task.id, 1500));
}

function changeStatus(task, select) {
  if (!readyForWrites()) return;
  const user = currentUser, value = select.value;
  enqueue({ apply: (list) => list.map((item) => item.id === task.id ? { ...item, status: value } : item), save: () => updateTask(user, task.id, { status: value }) });
}

function removeTask(task) {
  if (!readyForWrites()) return;
  const user = currentUser;
  enqueue({ apply: (list) => list.filter((item) => item.id !== task.id), save: () => deleteTask(user, task.id) });
}

function reconcileTasks() {
  clearTimerIntervals();
  const fragment = document.createDocumentFragment();
  for (const task of tasks) fragment.append(renderTask(task));
  taskList.replaceChildren(fragment);
  updateTaskCount();
}

function clearTimerIntervals() {
  for (const interval of timerIntervals.values()) clearInterval(interval);
  timerIntervals.clear();
}

function remaining(timer) {
  return timer.state === "running" ? Math.max(0, Math.ceil((timer.endsAt.toMillis() - Date.now()) / 1000)) : timer.remainingSeconds;
}

function createTimerPanel(task) {
  const panel = document.createElement("div");
  panel.className = "timer-panel";
  const display = document.createElement("span");
  display.className = "timer-display";
  display.setAttribute("role", "timer");
  const controls = document.createElement("div");
  controls.className = "timer-controls";
  const minutes = document.createElement("input");
  const seconds = document.createElement("input");
  for (const [input, label, max] of [[minutes, "minutes", 1000], [seconds, "seconds", 59]]) {
    input.type = "number";
    input.min = "0";
    input.max = String(max);
    input.step = "1";
    input.setAttribute("aria-label", `Timer ${label} for ${task.title}`);
  }
  const initial = remaining(task.timer);
  minutes.value = String(Math.floor(initial / 60));
  seconds.value = String(initial % 60);
  const makeButton = (label, action) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.addEventListener("click", action);
    return button;
  };
  const set = makeButton("Set time", () => {
    const m = Number(minutes.value), s = Number(seconds.value);
    if (!minutes.value.trim() || !seconds.value.trim() || !Number.isInteger(m) || !Number.isInteger(s) || m < 0 || s < 0 || s > 59 || m * 60 + s > 60000) {
      showError("Enter whole minutes and seconds, up to 1000 minutes total.");
      return;
    }
    const value = m * 60 + s;
    if (task.timer.state === "running") { showError("Pause the timer before setting its duration."); return; }
    queueTimer(task, { remainingSeconds: value, state: "paused", endsAt: null }, (user) => setTimer(user, task.id, value));
  });
  controls.append(minutes, seconds, set, makeButton("Start", () => {
    if (task.timer.state !== "paused" || task.timer.remainingSeconds <= 0) return;
    queueTimer(task, { ...task.timer, state: "running", endsAt: Timestamp.fromMillis(Date.now() + task.timer.remainingSeconds * 1000) }, (user) => startTimer(user, task.id));
  }), makeButton("Pause", () => {
    if (task.timer.state !== "running") return;
    queueTimer(task, { remainingSeconds: remaining(task.timer), state: "paused", endsAt: null }, (user) => pauseTimer(user, task.id));
  }));
  panel.append(display, controls);
  const generation = sessionGeneration;
  const tick = () => {
    const value = remaining(task.timer);
    display.textContent = `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
    if (task.timer.state === "running" && value === 0 && !expiringTimers.has(task.id)) {
      expiringTimers.add(task.id);
      const user = currentUser;
      queueMicrotask(() => {
        if (generation !== sessionGeneration) return;
        enqueue({ apply: (list) => list.map((item) => item.id === task.id && item.timer?.state === "running" && item.timer.endsAt.isEqual(task.timer.endsAt) ? { ...item, timer: { remainingSeconds: 0, state: "paused", endsAt: null } } : item), save: () => expireTimer(user, task.id, task.timer.endsAt) });
        expiringTimers.delete(task.id);
      });
      clearInterval(timerIntervals.get(task.id));
      timerIntervals.delete(task.id);
    }
  };
  if (task.timer.state === "running") timerIntervals.set(task.id, setInterval(tick, 1000));
  tick();
  return panel;
}

function queueTimer(task, timer, save) {
  if (!readyForWrites()) return;
  const user = currentUser;
  enqueue({ apply: (list) => list.map((item) => item.id === task.id ? { ...item, timer } : item), save: () => save(user) });
}

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) reconcileTasks();
});

function refreshTasks() {
  tasks = operations.reduce((list, operation) => operation.apply(list), confirmedTasks);
  reconcileTasks();
}

function enqueue(operation) {
  operations.push(operation);
  refreshTasks();
  updateSyncStatus();
  processQueue();
}

async function processQueue() {
  if (processing || retryTimer || !operations.length || !currentUser) return;
  processing = true;
  const generation = sessionGeneration;
  const operation = operations[0];
  pendingNotice = setTimeout(() => {
    if (generation === sessionGeneration) showError("Changes have not been saved yet: waiting for a connection. Firestore will keep trying.");
  }, 10000);
  try {
    await operation.save();
    if (generation !== sessionGeneration) return;
    clearTimeout(pendingNotice);
    confirmedTasks = operation.apply(confirmedTasks);
    operations.shift();
    clearError();
    refreshTasks();
    updateSyncStatus();
    processing = false;
    processQueue();
  } catch (error) {
    if (generation !== sessionGeneration) return;
    clearTimeout(pendingNotice);
    processing = false;
    showError(`Changes have not been saved: ${readableError(error)} Retrying in 10 seconds.`);
    setTaskStatus("Changes waiting to be saved.");
    retryTimer = setTimeout(() => { retryTimer = null; processQueue(); }, 10000);
  }
}

function updateSyncStatus(waitingForServer = false) {
  setTaskStatus(operations.length ? "Saving changes..." : waitingForServer ? "Waiting for a connection to sync tasks..." : "Tasks synced.");
}

function updateTaskCount() {
  const count = tasks.length;
  taskCount.textContent = `${count} ${count === 1 ? "task" : "tasks"}`;
  emptyState.hidden = count !== 0;
}

function readyForWrites() {
  return Boolean(currentUser && auth.currentUser === currentUser && firstServerSnapshotReceived);
}

function setTaskActionsDisabled(disabled) {
  taskForm.querySelectorAll("input, button").forEach((control) => { control.disabled = disabled; });
  taskList.querySelectorAll("button, select").forEach((control) => { control.disabled = disabled; });
}

function setTaskStatus(message) { taskStatus.textContent = message; }
function showError(message) { taskError.textContent = message; taskError.hidden = false; }
function clearError() { taskError.textContent = ""; taskError.hidden = true; }
function readableError(error) {
  if (error?.code === "permission-denied") return "You do not have permission to change this task.";
  if (error?.code === "unavailable") return "Check your connection and try again.";
  return error?.message || "Please try again.";
}
