const navToggle = document.querySelector("#nav-toggle");

navToggle.addEventListener("click", () => {
  const isExpanded = navToggle.getAttribute("aria-expanded") === "true";
  navToggle.setAttribute("aria-expanded", String(!isExpanded));
  navToggle.setAttribute(
    "aria-label",
    isExpanded ? "Expand navigation" : "Collapse navigation",
  );
  navToggle.querySelector("span").textContent = isExpanded ? "☰" : "×";
  document.body.classList.toggle("sidebar-collapsed", isExpanded);
});


const taskPanel = document.getElementById("checklist");
const taskPanelToggle = document.getElementById("task-panel-toggle");
const taskPanelContent = document.getElementById("task-panel-content");

taskPanelToggle.addEventListener("click", () => {
  const isCollapsed = taskPanel.classList.toggle("collapsed");

  taskPanelToggle.setAttribute("aria-expanded", String(!isCollapsed));
  taskPanelToggle.setAttribute(
    "aria-label",
    isCollapsed ? "Expand task list" : "Collapse task list"
  );

  taskPanelContent.inert = isCollapsed;
});
