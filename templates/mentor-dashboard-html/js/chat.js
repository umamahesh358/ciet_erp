// ============================================================
// chat.js — Chat panel (mirrors ChatPanel.tsx, FloatingChatButton.tsx,
//            ChatInsightsPanel.tsx, SuggestionTemplatesModal.tsx)
// ============================================================

document.addEventListener("DOMContentLoaded", () => {

  let messages     = initialMessages.map(m => ({ ...m, timestamp: new Date(m.timestamp) }));
  let selectedId   = null;
  let chatSearch   = "";
  let showInsights = true;
  let isTyping     = false;
  let chatOpen     = false;

  const floatingBtn      = document.getElementById("floating-chat-btn");
  const chatPanel        = document.getElementById("chat-panel");
  const closeChatBtn     = document.getElementById("close-chat-btn");
  const studentsListEl   = document.getElementById("chat-students-list");
  const chatSearchInput  = document.getElementById("chat-search");
  const chatMain         = document.getElementById("chat-main");
  const chatEmptyState   = document.getElementById("chat-empty-state");
  const chatHeaderName   = document.getElementById("chat-header-name");
  const chatHeaderBadge  = document.getElementById("chat-header-badge");
  const toggleInsightsBtn= document.getElementById("toggle-insights-btn");
  const insightsPanel    = document.getElementById("chat-insights-panel");
  const chatMessages     = document.getElementById("chat-messages");
  const chatSuggestions  = document.getElementById("chat-suggestions");
  const chatInput        = document.getElementById("chat-input");
  const chatSendBtn      = document.getElementById("chat-send-btn");
  const templatesModal   = document.getElementById("templates-modal");
  const openTemplatesBtn = document.getElementById("open-templates-btn");
  const closeTemplatesBtn= document.getElementById("close-templates-btn");
  const templatesList    = document.getElementById("templates-list");
  const unreadBadgeEl    = document.getElementById("chat-unread-badge");

  if (!floatingBtn) return;

  // Badge
  function updateBadge() {
    const total = students.reduce((acc, s) => acc + getUnreadCount(s.id, messages), 0);
    if (unreadBadgeEl) {
      unreadBadgeEl.textContent = total;
      unreadBadgeEl.style.display = total > 0 ? "flex" : "none";
    }
  }
  updateBadge();

  // Toggle chat
  floatingBtn.addEventListener("click", () => {
    chatOpen = !chatOpen;
    chatPanel.classList.toggle("show", chatOpen);
    if (chatOpen) renderStudentList();
  });
  if (closeChatBtn) closeChatBtn.addEventListener("click", () => {
    chatOpen = false;
    chatPanel.classList.remove("show");
  });

  // Search
  if (chatSearchInput) chatSearchInput.addEventListener("input", e => {
    chatSearch = e.target.value;
    renderStudentList();
  });

  function getLastMessage(studentId) {
    const msgs = messages.filter(m => m.studentId === studentId);
    return msgs[msgs.length - 1] || null;
  }

  function statusDotClass(student) {
    const s = getStudentStatus(student);
    if (s === "on-track")     return "status-dot status-dot-green";
    if (s === "watch-list")   return "status-dot status-dot-yellow";
    return "status-dot status-dot-red";
  }

  function renderStudentList() {
    if (!studentsListEl) return;
    const q = chatSearch.toLowerCase();
    const filtered = students.filter(s => s.name.toLowerCase().includes(q));

    studentsListEl.innerHTML = filtered.map(s => {
      const last    = getLastMessage(s.id);
      const unread  = getUnreadCount(s.id, messages);
      const initial = s.name[0].toUpperCase();
      const preview = last ? ((last.sender === "mentor" ? "You: " : "") + last.text) : "";
      const active  = s.id === selectedId ? " active" : "";
      const unreadHtml = unread > 0
        ? `<span style="background:var(--primary);color:white;font-size:0.625rem;font-weight:700;min-width:1rem;height:1rem;border-radius:50%;display:flex;align-items:center;justify-content:center;padding:0 2px;">${unread}</span>` : "";
      return `
        <button class="chat-student-item${active}" data-student="${s.id}">
          <div class="position-relative">
            <div class="avatar avatar-sm ${avatarClass(s.name)}">${initial}</div>
            <div class="${statusDotClass(s)}"></div>
          </div>
          <div class="flex-1 min-w-0">
            <div class="d-flex align-items-center justify-content-between">
              <span class="text-sm font-medium truncate">${s.name}</span>
              ${unreadHtml}
            </div>
            ${preview ? `<div class="text-xs text-muted truncate mt-1">${preview.length > 45 ? preview.slice(0,45)+"…" : preview}</div>` : ""}
          </div>
        </button>`;
    }).join("");

    studentsListEl.querySelectorAll(".chat-student-item").forEach(btn => {
      btn.addEventListener("click", () => selectStudent(btn.dataset.student));
    });
  }

  function selectStudent(studentId) {
    selectedId = studentId;
    renderStudentList();
    renderChatArea();
  }

  // Expose for row chat buttons on index page
  window.openChatForStudent = function(studentId) {
    chatOpen = true;
    chatPanel.classList.add("show");
    selectedId = studentId;
    renderStudentList();
    renderChatArea();
  };

  function renderChatArea() {
    if (!selectedId) {
      if (chatMain)      chatMain.style.display      = "none";
      if (chatEmptyState) chatEmptyState.style.display = "flex";
      return;
    }
    const student = students.find(s => s.id === selectedId);
    if (!student) return;

    if (chatMain)       chatMain.style.display       = "flex";
    if (chatEmptyState) chatEmptyState.style.display = "none";
    if (chatHeaderName) chatHeaderName.textContent   = student.name;

    // Status badge
    if (chatHeaderBadge) {
      const status     = getStudentStatus(student);
      const badgeCls   = status === "on-track"   ? "badge badge-excellent"
                       : status === "watch-list" ? "badge badge-average"
                       : "badge badge-poor";
      const label      = status === "on-track"   ? "On Track"
                       : status === "watch-list" ? "Watch List" : "Needs Attention";
      chatHeaderBadge.innerHTML = `<span class="${badgeCls}">${label}</span>`;
    }

    // Render messages
    if (chatMessages) {
      const studentMsgs = messages.filter(m => m.studentId === selectedId);
      let html = studentMsgs.map(msg => {
        const isMentor = msg.sender === "mentor";
        const tick     = isMentor ? (msg.status === "seen" ? "✓✓" : "✓") : "";
        return `
          <div class="${isMentor ? "chat-bubble-wrap-mentor" : "chat-bubble-wrap-student"}">
            <div class="${isMentor ? "chat-bubble-mentor" : "chat-bubble-student"}">
              <p style="margin:0;line-height:1.5;">${msg.text}</p>
              <div class="chat-bubble-time" style="justify-content:${isMentor ? "flex-end" : "flex-start"};">
                <span>${formatTime(msg.timestamp)}</span>
                ${isMentor ? `<span>${tick}</span>` : ""}
              </div>
            </div>
          </div>`;
      }).join("");

      if (isTyping) {
        html += `<div class="chat-bubble-wrap-student">
          <div class="chat-bubble-student">
            <div class="typing-dots">
              <div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>
            </div>
          </div></div>`;
      }
      chatMessages.innerHTML = html;
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // Suggestions
    if (chatSuggestions) {
      const suggestions = getSmartSuggestions(student);
      if (suggestions.length) {
        chatSuggestions.style.display = "flex";
        chatSuggestions.innerHTML = suggestions.map(s =>
          `<button class="chip chip-primary suggestion-chip">${s.length > 40 ? s.slice(0,40)+"…" : s}</button>`
        ).join("");
        chatSuggestions.querySelectorAll(".suggestion-chip").forEach((btn, i) => {
          btn.addEventListener("click", () => { if (chatInput) { chatInput.value = suggestions[i]; chatInput.focus(); } });
        });
      } else {
        chatSuggestions.style.display = "none";
      }
    }

    // Insights
    renderInsights(student);
  }

  function renderInsights(student) {
    if (!insightsPanel) return;
    insightsPanel.style.display = showInsights ? "flex" : "none";
    if (!showInsights) return;
    const status     = getStudentStatus(student);
    const statusLabel= status === "on-track" ? "On Track" : status === "watch-list" ? "Watch List" : "Needs Attention";
    const badgeCls   = status === "on-track" ? "badge badge-excellent" : status === "watch-list" ? "badge badge-average" : "badge badge-poor";
    insightsPanel.innerHTML = `
      <h4 style="font-size:0.75rem;font-weight:600;margin:0 0 0.75rem;">Student Insights</h4>
      <div style="display:flex;flex-direction:column;gap:0.625rem;">
        <div><div class="form-label">Status</div><span class="${badgeCls}">${statusLabel}</span></div>
        <div><div class="form-label">CGPA</div><div class="font-semibold">${student.cgpa.toFixed(1)}</div></div>
        <div><div class="form-label">Attendance</div><div class="font-semibold ${student.attendance < 75 ? "text-attention" : ""}">${student.attendance}%</div></div>
        <div><div class="form-label">Avg Marks</div><div class="font-semibold">${student.avgMarks}</div></div>
        <div><div class="form-label">Trend</div><div class="font-semibold">${student.trend.charAt(0).toUpperCase() + student.trend.slice(1)}</div></div>
        <hr style="border-color:var(--border);">
        <div class="text-xs text-muted">${student.rollNumber} · ${student.department} ${student.section}</div>
      </div>`;
  }

  if (toggleInsightsBtn) toggleInsightsBtn.addEventListener("click", () => {
    showInsights = !showInsights;
    if (selectedId) renderChatArea();
  });

  // Send
  function doSend() {
    if (!chatInput) return;
    const text = chatInput.value.trim();
    if (!text || !selectedId) return;
    messages.push({ id: `m${Date.now()}`, studentId: selectedId, sender: "mentor",
      text, timestamp: new Date(), status: "sent" });
    chatInput.value = "";
    if (chatSendBtn) chatSendBtn.disabled = true;
    renderChatArea();

    isTyping = true;
    renderChatArea();
    setTimeout(() => {
      isTyping = false;
      messages.push({ id: `m${Date.now()+1}`, studentId: selectedId, sender: "student",
        text: "Thank you for the message, sir. I'll keep that in mind.", timestamp: new Date(), status: "seen" });
      updateBadge();
      renderChatArea();
    }, 2000);
  }

  if (chatSendBtn) chatSendBtn.addEventListener("click", doSend);
  if (chatInput) {
    chatInput.addEventListener("keydown", e => { if (e.key === "Enter") doSend(); });
    chatInput.addEventListener("input",   () => { if (chatSendBtn) chatSendBtn.disabled = !chatInput.value.trim(); });
  }

  // Templates
  if (openTemplatesBtn) openTemplatesBtn.addEventListener("click", () => {
    if (templatesModal) templatesModal.classList.add("show");
    renderTemplates();
  });
  if (closeTemplatesBtn) closeTemplatesBtn.addEventListener("click", () => {
    if (templatesModal) templatesModal.classList.remove("show");
  });
  if (templatesModal) templatesModal.addEventListener("click", e => {
    if (e.target === templatesModal) templatesModal.classList.remove("show");
  });

  function renderTemplates() {
    if (!templatesList) return;
    templatesList.innerHTML = Object.entries(suggestionTemplates).map(([cat, msgs]) => `
      <div style="margin-bottom:1rem;">
        <div class="font-semibold text-sm mb-2">${cat}</div>
        <div style="display:flex;flex-direction:column;gap:0.375rem;">
          ${msgs.map(msg => `
            <button class="btn btn-outline btn-sm use-template-btn"
              style="text-align:left;height:auto;padding:0.5rem 0.75rem;white-space:normal;"
              data-msg="${msg.replace(/"/g,"&quot;").replace(/'/g,"&#39;")}">${msg}</button>
          `).join("")}
        </div>
      </div>`).join("");
    templatesList.querySelectorAll(".use-template-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        if (chatInput) { chatInput.value = btn.dataset.msg; chatInput.focus(); }
        if (templatesModal) templatesModal.classList.remove("show");
      });
    });
  }

  // Initial render
  renderStudentList();
  if (chatMain)       chatMain.style.display       = "none";
  if (chatEmptyState) chatEmptyState.style.display = "flex";
});
