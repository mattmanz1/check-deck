const taskForm = document.querySelector("#task-form");
const taskInput = document.querySelector("#task-input");
const addTimerInput = document.querySelector("#add-timer");
const taskList = document.querySelector("#task-list");
const emptyState = document.querySelector("#empty-state");
const taskCount = document.querySelector("#task-count");

const tasks = [];
let nextTaskId = 1;

taskForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const title = taskInput.value.trim();
  if (!title) return;

  const task = {
    id: nextTaskId++,
    title,
    status: "not-started",
    timer: addTimerInput.checked ? { remaining: 25 * 60, interval: null } : null,
  };
  tasks.push(task);
  renderTask(task);
  taskInput.value = "";
  addTimerInput.checked = false;
  taskInput.focus();
});

function renderTask(task) {
  const item = document.createElement("li");
  item.className = "task-item";
  item.dataset.status = task.status;
  item.dataset.taskId = String(task.id);

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
  for (const [value, label] of [
    ["not-started", "Not started"],
    ["in-progress", "In progress"],
    ["completed", "Completed"],
  ]) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    status.append(option);
  }

  // Updates both the data model and the visible dropdown/attribute
  const setTaskStatus = (newStatus) => {
    task.status = newStatus;
    item.dataset.status = newStatus;
    status.value = newStatus;
  };

  // Manual dropdown changes still work anytime
  status.addEventListener("change", () => {
    setTaskStatus(status.value);
  });

  const remove = document.createElement("button");
  remove.className = "remove-button";
  remove.type = "button";
  remove.textContent = "Remove";
  remove.setAttribute("aria-label", `Remove ${task.title}`);
  remove.addEventListener("click", () => {
    stopTimer(task);
    tasks.splice(tasks.indexOf(task), 1);
    item.remove();
    updateTaskCount();
  });

  actions.append(status, remove);
  main.append(title, actions);
  item.append(main);

  if (task.timer) {
    item.append(createTimerPanel(task, setTaskStatus));
  } else {
    const enableTimer = document.createElement("button");
    enableTimer.className = "timer-toggle";
    enableTimer.type = "button";
    enableTimer.textContent = "Add timer";
    enableTimer.addEventListener("click", () => {
      task.timer = { remaining: 25 * 60, interval: null };
      enableTimer.replaceWith(createTimerPanel(task, setTaskStatus));
    });
    item.append(enableTimer);
  }

  taskList.append(item);
  updateTaskCount();
}

function createTimerPanel(task, setTaskStatus) {
  const panel = document.createElement("div");
  panel.className = "timer-panel";

  const display = document.createElement("span");
  display.className = "timer-display";
  display.setAttribute("role", "timer");
  display.textContent = formatTime(task.timer.remaining);

  const controls = document.createElement("div");
  controls.className = "timer-controls";

  const timeInput = document.createElement("input");
  timeInput.className = "quick-time-input";
  timeInput.type = "text";
  timeInput.placeholder = "e.g. 25 or 15:30";
  timeInput.title = "Type minutes (25), mm:ss (15:30), or 1h 20m and press Enter";
  timeInput.setAttribute("aria-label", `Set timer for ${task.title}`);

  const applyTime = () => {
    const raw = timeInput.value.trim();
    if (!raw) return;

    const seconds = parseDuration(raw);
    if (seconds === null || seconds <= 0 || seconds > 59999) {
      timeInput.setCustomValidity("Try formats like 25, 15:30, or 1h 15m");
      timeInput.reportValidity();
      return;
    }

    timeInput.setCustomValidity("");
    stopTimer(task);
    task.timer.remaining = seconds;
    display.textContent = formatTime(task.timer.remaining);
    timeInput.value = "";
  };

  timeInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      applyTime();
    }
  });
  timeInput.addEventListener("change", applyTime);

  const start = document.createElement("button");
  start.className = "start-timer";
  start.type = "button";
  start.textContent = "Start";
  start.addEventListener("click", () => {
    if (task.timer.interval || task.timer.remaining <= 0) return;

    // Automatically set status to "In progress" when timer starts
    setTaskStatus("in-progress");

    task.timer.interval = window.setInterval(() => {
      task.timer.remaining -= 1;
      display.textContent = formatTime(task.timer.remaining);
      if (task.timer.remaining <= 0) {
        stopTimer(task);
        // Automatically set status to "Completed" when timer finishes
        setTaskStatus("completed");
      }
    }, 1000);
  });

  const stop = document.createElement("button");
  stop.className = "stop-timer";
  stop.type = "button";
  stop.textContent = "Stop";
  stop.addEventListener("click", () => stopTimer(task));

  controls.append(timeInput, start, stop);
  panel.append(display, controls);
  return panel;
}

function parseDuration(input) {
  const clean = input.toLowerCase().trim();

  if (/^\d{1,3}:\d{1,2}$/.test(clean)) {
    const [mins, secs] = clean.split(":").map(Number);
    if (secs >= 60) return null;
    return mins * 60 + secs;
  }

  if (/^\d+(\.\d+)?$/.test(clean)) {
    return Math.round(Number(clean) * 60);
  }

  const unitRegex = /(\d+(?:\.\d+)?)\s*(h|m|s)/g;
  let totalSeconds = 0;
  let matched = false;
  let match;

  while ((match = unitRegex.exec(clean)) !== null) {
    matched = true;
    const value = Number(match[1]);
    const unit = match[2];
    if (unit === "h") totalSeconds += value * 3600;
    if (unit === "m") totalSeconds += value * 60;
    if (unit === "s") totalSeconds += value;
  }

  return matched ? Math.round(totalSeconds) : null;
}

function stopTimer(task) {
  if (task.timer?.interval) {
    window.clearInterval(task.timer.interval);
    task.timer.interval = null;
  }
}

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function updateTaskCount() {
  const count = tasks.length;
  taskCount.textContent = `${count} ${count === 1 ? "task" : "tasks"}`;
  emptyState.hidden = count !== 0;
}

updateTaskCount();
