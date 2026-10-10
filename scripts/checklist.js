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
  status.addEventListener("change", () => {
    task.status = status.value;
    item.dataset.status = task.status;
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
    item.append(createTimerPanel(task));
  } else {
    const enableTimer = document.createElement("button");
    enableTimer.className = "timer-toggle";
    enableTimer.type = "button";
    enableTimer.textContent = "Add timer";
    enableTimer.addEventListener("click", () => {
      task.timer = { remaining: 25 * 60, interval: null };
      enableTimer.replaceWith(createTimerPanel(task));
    });
    item.append(enableTimer);
  }

  taskList.append(item);
  updateTaskCount();
}

function createTimerPanel(task) {
  const panel = document.createElement("div");
  panel.className = "timer-panel";

  const display = document.createElement("span");
  display.className = "timer-display";
  display.setAttribute("role", "timer");
  display.textContent = formatTime(task.timer.remaining);

  const controls = document.createElement("div");
  controls.className = "timer-controls";

  const minutes = document.createElement("input");
  minutes.type = "number";
  minutes.min = "0";
  minutes.max = "999";
  minutes.value = String(Math.floor(task.timer.remaining / 60));
  minutes.setAttribute("aria-label", `Timer minutes for ${task.title}`);

  const seconds = document.createElement("input");
  seconds.type = "number";
  seconds.min = "0";
  seconds.max = "59";
  seconds.value = String(task.timer.remaining % 60).padStart(2, "0");
  seconds.setAttribute("aria-label", `Timer seconds for ${task.title}`);

  const setTime = document.createElement("button");
  setTime.type = "button";
  setTime.textContent = "Set time";
  setTime.addEventListener("click", () => {
    const minuteValue = Number(minutes.value);
    const secondValue = Number(seconds.value);
    if (!minutes.value || !seconds.value || minuteValue < 0 || minuteValue > 999 || secondValue < 0 || secondValue > 59) {
      minutes.setCustomValidity("Enter 0-999 minutes and 0-59 seconds.");
      minutes.reportValidity();
      return;
    }

    minutes.setCustomValidity("");
    task.timer.remaining = minuteValue * 60 + secondValue;
    display.textContent = formatTime(task.timer.remaining);
  });

  const start = document.createElement("button");
  start.type = "button";
  start.textContent = "Start";
  start.addEventListener("click", () => {
    if (task.timer.interval || task.timer.remaining <= 0) return;
    task.timer.interval = window.setInterval(() => {
      task.timer.remaining -= 1;
      display.textContent = formatTime(task.timer.remaining);
      if (task.timer.remaining <= 0) stopTimer(task);
    }, 1000);
  });

  const stop = document.createElement("button");
  stop.className = "stop-timer";
  stop.type = "button";
  stop.textContent = "Stop";
  stop.addEventListener("click", () => stopTimer(task));

  controls.append(minutes, seconds, setTime, start, stop);
  panel.append(display, controls);
  return panel;
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