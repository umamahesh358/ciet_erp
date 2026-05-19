// ============================================================
// home.js — Interactive behavior for index home page
// ============================================================

document.addEventListener("DOMContentLoaded", () => {
  const greetingEl = document.getElementById("home-greeting");
  const datetimeEl = document.getElementById("home-datetime");

  const metricTotalEl = document.getElementById("metric-total-students");
  const metricAttentionEl = document.getElementById("metric-needs-attention");

  function getStudentsData() {
    if (typeof students !== "undefined" && Array.isArray(students)) return students;
    if (Array.isArray(window.students)) return window.students;
    return [];
  }

  function setContext() {
    const now = new Date();
    const hour = now.getHours();
    let greeting = "Good Evening";

    if (hour < 12) greeting = "Good Morning";
    else if (hour < 17) greeting = "Good Afternoon";

    if (greetingEl) greetingEl.textContent = `${greeting}, Mentor`;

    if (datetimeEl) {
      datetimeEl.textContent = now.toLocaleString([], {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    }
  }

  function animateNumber(el, endValue, options = {}) {
    if (!el) return;
    const {
      duration = 800,
      decimals = 0,
      suffix = "",
    } = options;

    const start = performance.now();
    const from = 0;

    function tick(time) {
      const progress = Math.min((time - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const value = from + (endValue - from) * eased;
      el.textContent = `${value.toFixed(decimals)}${suffix}`;
      if (progress < 1) requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);
  }

  function renderMetrics() {
    const studentList = getStudentsData();

    if (!Array.isArray(studentList) || studentList.length === 0) {
      if (metricTotalEl) metricTotalEl.textContent = "0";
      if (metricAttentionEl) metricAttentionEl.textContent = "0";
      return;
    }

    const total = studentList.length;
    const attention = studentList.filter(s => Number(s.cgpa) < 6 || Number(s.attendance) < 65).length;

    animateNumber(metricTotalEl, total, { duration: 700, decimals: 0 });
    animateNumber(metricAttentionEl, attention, { duration: 700, decimals: 0 });
  }

  function addRevealClasses() {
    const sections = [
      document.querySelector(".home-hero"),
      document.querySelector(".home-stats-grid"),
      document.querySelector(".home-nav-grid"),
      document.querySelector(".home-footer-note"),
    ].filter(Boolean);

    sections.forEach((el, index) => {
      el.classList.add("home-reveal");
      if (index > 0) el.classList.add(`home-reveal-delay-${Math.min(index, 3)}`);
    });
  }

  function addInteractiveTilt() {
    const cards = document.querySelectorAll('[data-card="interactive"]');

    cards.forEach(card => {
      card.addEventListener("mousemove", e => {
        const rect = card.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width;
        const y = (e.clientY - rect.top) / rect.height;
        const rotateY = (x - 0.5) * 6;
        const rotateX = (0.5 - y) * 5;
        card.style.transform = `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-2px)`;
      });

      card.addEventListener("mouseleave", () => {
        card.style.transform = "";
      });
    });
  }

  setContext();
  renderMetrics();
  addRevealClasses();
  addInteractiveTilt();

  setInterval(setContext, 30000);
});
