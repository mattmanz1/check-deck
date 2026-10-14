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
