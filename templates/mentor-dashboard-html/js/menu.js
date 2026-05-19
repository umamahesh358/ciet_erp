// ============================================================
// menu.js — Shared hamburger menu behavior
// ============================================================

document.addEventListener("DOMContentLoaded", () => {
  const menuBtn = document.getElementById("hamburger-menu-btn");
  const menu = document.getElementById("mobile-menu");

  if (!menuBtn || !menu) return;

  let backdrop = document.getElementById("mobile-menu-backdrop");
  if (!backdrop) {
    backdrop = document.createElement("div");
    backdrop.id = "mobile-menu-backdrop";
    backdrop.className = "mobile-menu-backdrop";
    backdrop.setAttribute("aria-hidden", "true");
    document.body.appendChild(backdrop);
  }

  const iconMap = {
    "index.html": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/></svg>',
    "mentor-profile.html": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
    "fully-assigned-students.html": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0"/><circle cx="17" cy="9" r="2"/><path d="M14 20a4.5 4.5 0 0 1 7 0"/></svg>',
    "assign-mid-marks.html": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4l11-11-4-4L4 16v4z"/><path d="m12 8 4 4"/></svg>',
    "upload-attendance.html": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5-5 5 5"/><path d="M12 5v12"/></svg>',
    "sessions-log.html": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M8 2v4M16 2v4M7 10h10M7 14h6"/></svg>',
    "logout": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 17l5-5-5-5"/><path d="M15 12H3"/><path d="M21 21V3"/></svg>',
    "default": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/></svg>'
  };

  const linksWrap = menu.querySelector(".mobile-menu-links");
  if (linksWrap && !linksWrap.querySelector(".mobile-menu-logout")) {
    const logoutLink = document.createElement("a");
    logoutLink.className = "mobile-menu-link mobile-menu-logout";
    logoutLink.href = "#";
    logoutLink.dataset.menuLogout = "true";
    logoutLink.dataset.iconKey = "logout";
    logoutLink.textContent = "Logout";
    linksWrap.appendChild(logoutLink);
  }

  menu.querySelectorAll("a").forEach(link => {
    if (link.querySelector(".mobile-menu-link-label")) return;
    const href = (link.getAttribute("href") || "").toLowerCase();
    const labelText = link.textContent.trim();
    const iconKey = link.dataset.iconKey || href;

    const icon = document.createElement("span");
    icon.className = "mobile-menu-link-icon";
    icon.innerHTML = iconMap[iconKey] || iconMap.default;

    const label = document.createElement("span");
    label.className = "mobile-menu-link-label";
    label.textContent = labelText;

    link.textContent = "";
    link.append(icon, label);
  });

  function closeMenu() {
    menu.classList.remove("show");
    backdrop.classList.remove("show");
    menuBtn.setAttribute("aria-expanded", "false");
    menuBtn.setAttribute("aria-label", "Open navigation menu");
    document.body.classList.remove("menu-open");
  }

  function openMenu() {
    menu.classList.add("show");
    backdrop.classList.add("show");
    menuBtn.setAttribute("aria-expanded", "true");
    menuBtn.setAttribute("aria-label", "Close navigation menu");
    document.body.classList.add("menu-open");
  }

  menuBtn.addEventListener("click", () => {
    const isOpen = menu.classList.contains("show");
    if (isOpen) closeMenu();
    else openMenu();
  });

  document.addEventListener("click", e => {
    if (!menu.classList.contains("show")) return;
    if (menu.contains(e.target) || menuBtn.contains(e.target)) return;
    closeMenu();
  });

  document.addEventListener("keydown", e => {
    if (e.key === "Escape") closeMenu();
  });

  backdrop.addEventListener("click", closeMenu);

  menu.querySelectorAll("a").forEach(link => {
    link.addEventListener("click", e => {
      if (link.dataset.menuLogout === "true") {
        e.preventDefault();
        const theme = localStorage.getItem("mentor-theme");
        localStorage.clear();
        sessionStorage.clear();
        if (theme) localStorage.setItem("mentor-theme", theme);
        closeMenu();
        window.location.href = "/accounts/logout/";
        return;
      }

      closeMenu();
    });
  });

  const path = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  menu.querySelectorAll("a").forEach(link => {
    const href = (link.getAttribute("href") || "").toLowerCase();
    if (href === path) link.classList.add("active");
  });

  closeMenu();

});
