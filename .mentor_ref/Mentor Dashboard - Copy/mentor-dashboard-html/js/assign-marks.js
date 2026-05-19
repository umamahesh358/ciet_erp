// ============================================================
// assign-marks.js — Mirrors AssignMidMarks.tsx fully
// localStorage persistence, tab switching, save/edit, averages
// ============================================================

document.addEventListener("DOMContentLoaded", () => {

  // ---- State ----
  let subjects     = readStoredSubjects();
  let mid1Marks    = readStoredMarks(KEYS.MID1);
  let mid2Marks    = readStoredMarks(KEYS.MID2);
  let internals    = readStoredMarks(KEYS.INTERNALS);
  let external     = readStoredMarks(KEYS.EXTERNAL, "external");
  let semCgpa      = readStoredCurrentSemCgpa();
  let activeTab    = "mid1";
  let tabSaved     = { mid1: false, mid2: false, internals: false, external: false, finalCgpa: false };
  let tabEditable  = { mid1: true,  mid2: true,  internals: true,  external: true,  finalCgpa: true };

  // Detect preselected student
  const params          = new URLSearchParams(location.search);
  const highlightedId   = students.some(s => s.id === params.get("student")) ? params.get("student") : "";

  // ---- DOM refs ----
  const tabNav      = document.getElementById("marks-tab-nav");
  const sheetSection= document.getElementById("marks-sheet");

  const TABS = ["mid1","mid2","internals","external","finalCgpa"];
  const TAB_LABELS = { mid1:"Mid 1 Marks", mid2:"Mid 2 Marks", internals:"Internal Marks", external:"External Marks", finalCgpa:"Final CGPA" };

  function getCurrentMarks() {
    if (activeTab === "mid1")     return mid1Marks;
    if (activeTab === "mid2")     return mid2Marks;
    if (activeTab === "internals") return internals;
    return external;
  }
  function setCurrentMarks(newMap) {
    if (activeTab === "mid1")      mid1Marks = newMap;
    else if (activeTab === "mid2") mid2Marks = newMap;
    else if (activeTab === "internals") internals = newMap;
    else external = newMap;
  }
  function getStorageKey() {
    if (activeTab === "mid1")      return KEYS.MID1;
    if (activeTab === "mid2")      return KEYS.MID2;
    if (activeTab === "internals") return KEYS.INTERNALS;
    return KEYS.EXTERNAL;
  }

  // ---- Render tabs ----
  function renderTabs() {
    tabNav.innerHTML = TABS.map(t => `
      <button class="tab-btn ${t === activeTab ? "active" : ""}" data-tab="${t}">${TAB_LABELS[t]}</button>`
    ).join("");
    tabNav.querySelectorAll(".tab-btn").forEach(btn => {
      btn.addEventListener("click", () => { activeTab = btn.dataset.tab; renderTabs(); renderSheet(); });
    });
  }

  // ---- Render sheet ----
  function renderSheet() {
    const isEditable = tabEditable[activeTab];
    const isSaved    = tabSaved[activeTab];

    const saveIconSvg   = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>`;
    const pencilIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;

    const actionBtn = (!isSaved || isEditable)
      ? `<button id="save-tab-btn" class="btn btn-primary btn-sm">${saveIconSvg} Save</button>`
      : `<button id="edit-tab-btn" class="btn btn-outline btn-icon" title="Edit">${pencilIconSvg}</button>`;

    if (activeTab === "finalCgpa") {
      sheetSection.innerHTML = renderFinalCgpaSheet(isEditable, actionBtn);
    } else {
      sheetSection.innerHTML = renderMarksSheet(isEditable, actionBtn);
    }

    // wire save/edit buttons
    const saveBtn = document.getElementById("save-tab-btn");
    const editBtn = document.getElementById("edit-tab-btn");
    if (saveBtn) saveBtn.addEventListener("click", () => handleSave());
    if (editBtn) editBtn.addEventListener("click", () => handleEdit());

    // wire inputs
    document.querySelectorAll(".marks-input").forEach(input => {
      input.addEventListener("change", e => {
        const sid = e.target.dataset.student;
        const subId = e.target.dataset.subject;
        const val  = sanitizeMarks(e.target.value);
        e.target.value = val;
        const marks = getCurrentMarks();
        if (!marks[sid]) marks[sid] = {};
        marks[sid][subId] = val;
        setCurrentMarks(marks);
        // Update avg cell
        const avgCell = document.getElementById(`avg-${sid}`);
        if (avgCell) avgCell.textContent = calcAverage(marks[sid] ?? {}, subjects);
      });
    });

    document.querySelectorAll(".cgpa-sem-input").forEach(input => {
      input.addEventListener("change", e => {
        const sid = e.target.dataset.student;
        const val  = sanitizeCgpa(e.target.value);
        e.target.value = val;
        semCgpa[sid] = val;
        const finalCell = document.getElementById(`finalcgpa-${sid}`);
        const student   = students.find(s => s.id === sid);
        if (finalCell && student) finalCell.textContent = calcFinalCgpa(student.cgpa, val);
      });
    });
  }

  function renderMarksSheet(isEditable, actionBtn) {
    const marks = getCurrentMarks();
    const colHeaders = subjects.map(s =>
      `<th title="${s.name}" style="min-width:120px;">${s.shortName}</th>`).join("");

    const rows = students.map(s => {
      const bySubject = marks[s.id] ?? {};
      const isHighlighted = s.id === highlightedId;
      const inputs = subjects.map(sub => `
        <td><input type="number" min="0" max="100"
          class="form-control form-control-sm marks-input"
          style="width:6rem;"
          data-student="${s.id}" data-subject="${sub.id}"
          value="${bySubject[sub.id] ?? ""}"
          placeholder="-"
          ${isEditable ? "" : "disabled"}
        /></td>`).join("");
      return `<tr class="${isHighlighted ? "highlighted" : ""}">
        <td class="sticky-col-1"><strong>${s.rollNumber}</strong></td>
        <td class="sticky-col-2">${s.name}</td>
        ${inputs}
        <td id="avg-${s.id}" class="font-semibold">${calcAverage(bySubject, subjects)}</td>
      </tr>`;
    }).join("");

    const empty = subjects.length === 0
      ? `<tr><td colspan="3" class="no-results">No subject columns yet. Create a subject in Manage Subjects to start entering marks.</td></tr>`
      : "";

    return `
      <div class="card">
        <div class="card-header d-flex align-items-center justify-content-between gap-2">
          <div>
            <h2 class="font-semibold text-sm" style="margin:0;">${TAB_LABELS[activeTab]}</h2>
            <p class="text-muted text-xs mt-1" style="margin:0;">Students in rows, subject short names in columns.</p>
          </div>
          <div>${actionBtn}</div>
        </div>
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th class="sticky-col-1">Roll No</th>
                <th class="sticky-col-2">Assigned Student</th>
                ${colHeaders}
                <th style="min-width:110px;">Avg</th>
              </tr>
            </thead>
            <tbody>${rows}${empty}</tbody>
          </table>
        </div>
      </div>`;
  }

  function renderFinalCgpaSheet(isEditable, actionBtn) {
    const rows = students.map(s => {
      const isHighlighted = s.id === highlightedId;
      return `<tr class="${isHighlighted ? "highlighted" : ""}">
        <td>${s.rollNumber}</td>
        <td class="font-semibold">${s.name}</td>
        <td>${s.cgpa.toFixed(1)}</td>
        <td><input type="number" min="0" max="10" step="0.01"
          class="form-control form-control-sm cgpa-sem-input"
          style="width:6rem;"
          data-student="${s.id}"
          value="${semCgpa[s.id] ?? ""}"
          placeholder="0.00"
          ${isEditable ? "" : "disabled"}
        /></td>
        <td id="finalcgpa-${s.id}" class="font-semibold">${calcFinalCgpa(s.cgpa, semCgpa[s.id] ?? "")}</td>
      </tr>`;
    }).join("");

    return `
      <div class="card">
        <div class="card-header d-flex align-items-center justify-content-between gap-2">
          <div>
            <h2 class="font-semibold text-sm" style="margin:0;">Final CGPA</h2>
            <p class="text-muted text-xs mt-1" style="margin:0;">Final CGPA = CGPA + (SGPA / 2)</p>
          </div>
          <div>${actionBtn}</div>
        </div>
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>Roll No</th><th>Assigned Student</th>
                <th>CGPA</th><th>SGPA</th><th>Final CGPA</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>`;
  }

  function handleSave() {
    if (activeTab === "finalCgpa") {
      localStorage.setItem(KEYS.CURRENT_SEM_CGPA, JSON.stringify(semCgpa));
      const computed = {};
      students.forEach(s => {
        const n = Number(semCgpa[s.id] ?? "");
        computed[s.id] = isFinite(n) ? (s.cgpa + n/2).toFixed(2) : s.cgpa.toFixed(2);
      });
      localStorage.setItem(KEYS.FINAL_CGPA, JSON.stringify(computed));
    } else {
      localStorage.setItem(getStorageKey(), JSON.stringify(getCurrentMarks()));
    }
    tabSaved[activeTab]    = true;
    tabEditable[activeTab] = false;
    renderSheet();
  }

  function handleEdit() {
    tabEditable[activeTab] = true;
    renderSheet();
  }

  // Initial render
  renderTabs();
  renderSheet();
});
