// ============================================================
// theme.js — Dark/Light mode toggle (mirrors ThemeToggle.tsx)
// ============================================================
(function () {
  const html = document.documentElement;
  const saved = localStorage.getItem("mentor-theme") || "light";
  html.setAttribute("data-theme", saved);

  document.addEventListener("DOMContentLoaded", () => {
    const btn = document.getElementById("theme-toggle");
    if (!btn) return;

    btn.addEventListener("click", () => {
      const current = html.getAttribute("data-theme");
      const next = current === "dark" ? "light" : "dark";
      html.setAttribute("data-theme", next);
      localStorage.setItem("mentor-theme", next);
    });
  });
})();
