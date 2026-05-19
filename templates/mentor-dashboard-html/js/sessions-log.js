// ============================================================
// sessions-log.js — Sessions Log page logic
// ============================================================

document.addEventListener("DOMContentLoaded", () => {
  const STORAGE_KEY = "mentor-dashboard-sessions-log";

  const form = document.getElementById("sessions-form");
  const studentSelect = document.getElementById("session-student");
  const dateInput = document.getElementById("session-date");
  const actionItemsInput = document.getElementById("session-action-items");
  const followUpInput = document.getElementById("session-follow-up");
  const statusSelect = document.getElementById("session-status");
  const notesInput = document.getElementById("session-notes");
  const resetBtn = document.getElementById("session-reset-btn");
  const errorEl = document.getElementById("session-form-error");
  const tbody = document.getElementById("sessions-tbody");
  const countEl = document.getElementById("sessions-count");
  const saveBtn = document.getElementById("session-save-btn");

  let editingId = null;
  let sessions = readSessions();

  populateStudentOptions();
  renderSessions();

  form.addEventListener("submit", e => {
    e.preventDefault();
    if (errorEl) errorEl.textContent = "";

    const studentId = studentSelect.value;
    const student = students.find(s => s.id === studentId);
    const meetingDate = dateInput.value;
    const actionItems = actionItemsInput.value.trim();
    const followUpDate = followUpInput.value;
    const status = statusSelect.value;
    const notes = notesInput.value.trim();

    if (!student || !meetingDate || !actionItems || !followUpDate || !status) {
      if (errorEl) errorEl.textContent = "Please fill all required fields.";
      return;
    }

    const payload = {
      id: editingId || `s-${Date.now()}`,
      studentId,
      studentName: student.name,
      meetingDate,
      actionItems,
      followUpDate,
      status,
      notes,
      updatedAt: new Date().toISOString(),
    };

    if (editingId) {
      sessions = sessions.map(row => row.id === editingId ? payload : row);
    } else {
      sessions.unshift(payload);
    }

    saveSessions(sessions);
    clearForm();
    renderSessions();
  });

  resetBtn.addEventListener("click", clearForm);

  function populateStudentOptions() {
    const options = students
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(s => `<option value="${s.id}">${s.name} (${s.rollNumber})</option>`)
      .join("");

    studentSelect.insertAdjacentHTML("beforeend", options);
  }

  function renderSessions() {
    const sorted = sessions
      .slice()
      .sort((a, b) => new Date(b.meetingDate) - new Date(a.meetingDate));

    if (countEl) countEl.textContent = `${sorted.length} ${sorted.length === 1 ? "record" : "records"}`;

    if (sorted.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="sessions-empty">No sessions logged yet. Add your first mentoring session.</td></tr>`;
      return;
    }

    tbody.innerHTML = sorted.map(row => {
      const statusChipClass = row.status === "done" ? "sessions-chip sessions-chip-done" : "sessions-chip sessions-chip-upcoming";
      const statusLabel = row.status === "done" ? "Completed" : "Upcoming";

      return `<tr>
        <td>${escapeHtml(row.studentName)}</td>
        <td>${formatDate(row.meetingDate)}</td>
        <td>${escapeHtml(row.actionItems)}</td>
        <td>${formatDate(row.followUpDate)}</td>
        <td><span class="${statusChipClass}">${statusLabel}</span></td>
        <td>${row.notes ? escapeHtml(row.notes) : "-"}</td>
        <td>
          <div class="d-flex gap-2">
            <button class="btn btn-outline btn-sm session-edit-btn" data-id="${row.id}">Edit</button>
            <button class="btn btn-danger btn-sm session-delete-btn" data-id="${row.id}">Delete</button>
          </div>
        </td>
      </tr>`;
    }).join("");

    tbody.querySelectorAll(".session-edit-btn").forEach(btn => {
      btn.addEventListener("click", () => startEdit(btn.dataset.id));
    });

    tbody.querySelectorAll(".session-delete-btn").forEach(btn => {
      btn.addEventListener("click", () => removeEntry(btn.dataset.id));
    });
  }

  function startEdit(id) {
    const row = sessions.find(s => s.id === id);
    if (!row) return;

    editingId = row.id;
    studentSelect.value = row.studentId;
    dateInput.value = row.meetingDate;
    actionItemsInput.value = row.actionItems;
    followUpInput.value = row.followUpDate;
    statusSelect.value = row.status;
    notesInput.value = row.notes || "";
    if (saveBtn) saveBtn.textContent = "Update Session";
    if (errorEl) errorEl.textContent = "Editing existing entry.";
  }

  function removeEntry(id) {
    sessions = sessions.filter(row => row.id !== id);
    saveSessions(sessions);
    if (editingId === id) clearForm();
    renderSessions();
  }

  function clearForm() {
    editingId = null;
    form.reset();
    if (saveBtn) saveBtn.textContent = "Save Session";
    if (errorEl) errorEl.textContent = "";
  }

  function readSessions() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(row => row && typeof row === "object" && row.id);
    } catch {
      return [];
    }
  }

  function saveSessions(entries) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  }

  function formatDate(value) {
    if (!value) return "-";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleDateString([], { year: "numeric", month: "short", day: "numeric" });
  }

  function escapeHtml(text) {
    return text
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }
});
