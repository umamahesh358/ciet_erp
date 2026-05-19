// ============================================================
// assign-marks.js — Mirrors AssignMidMarks.tsx fully
// localStorage persistence, tab switching, save/edit, averages
// ============================================================

document.addEventListener("DOMContentLoaded", () => {
  const SEMESTERS = ["1", "2", "3", "4", "5", "6", "7", "8"];

  // ---- State ----
  let subjects     = readStoredSubjects();
  let activeSemester = "1";

  function buildEmptyMarksMap() {
    const map = {};
    students.forEach(s => {
      map[s.id] = {};
      subjects.forEach(sub => {
        map[s.id][sub.id] = "";
      });
    });
    return map;
  }

  function cloneMap(map) {
    return JSON.parse(JSON.stringify(map));
  }

  function addSubjectToSemesterStore(store, subjectId) {
    SEMESTERS.forEach(sem => {
      if (!store[sem] || typeof store[sem] !== "object") store[sem] = {};
      students.forEach(s => {
        if (!store[sem][s.id] || typeof store[sem][s.id] !== "object") store[sem][s.id] = {};
        if (typeof store[sem][s.id][subjectId] === "undefined") store[sem][s.id][subjectId] = "";
      });
    });
  }

  function removeSubjectFromSemesterStore(store, subjectId) {
    SEMESTERS.forEach(sem => {
      if (!store[sem] || typeof store[sem] !== "object") return;
      students.forEach(s => {
        if (store[sem][s.id] && typeof store[sem][s.id] === "object") {
          delete store[sem][s.id][subjectId];
        }
      });
    });
  }

  function isSemesterWiseMarksStore(raw) {
    if (!raw || typeof raw !== "object") return false;
    const sem1 = raw["1"];
    if (!sem1 || typeof sem1 !== "object") return false;
    return students.some(s => sem1[s.id] && typeof sem1[s.id] === "object");
  }

  function normalizeSemesterMarksStore(raw) {
    const empty = buildEmptyMarksMap();
    const bySem = {};

    SEMESTERS.forEach(sem => {
      bySem[sem] = cloneMap(empty);
    });

    if (!raw || typeof raw !== "object") {
      return bySem;
    }

    if (isSemesterWiseMarksStore(raw)) {
      SEMESTERS.forEach(sem => {
        if (raw[sem] && typeof raw[sem] === "object") {
          bySem[sem] = { ...bySem[sem], ...raw[sem] };
        }
      });
      return bySem;
    }

    bySem["1"] = { ...bySem["1"], ...raw };
    return bySem;
  }

  function buildEmptySgpaMap() {
    const map = {};
    students.forEach(s => {
      map[s.id] = "";
    });
    return map;
  }

  function normalizeSemesterSgpaStore(raw) {
    const empty = buildEmptySgpaMap();
    const bySem = {};

    SEMESTERS.forEach(sem => {
      bySem[sem] = { ...empty };
    });

    if (!raw || typeof raw !== "object") {
      return bySem;
    }

    if (raw["1"] && typeof raw["1"] === "object") {
      SEMESTERS.forEach(sem => {
        if (raw[sem] && typeof raw[sem] === "object") {
          bySem[sem] = { ...bySem[sem], ...raw[sem] };
        }
      });
      return bySem;
    }

    bySem["1"] = { ...bySem["1"], ...raw };
    return bySem;
  }

  let mid1Marks    = normalizeSemesterMarksStore(readStoredMarks(KEYS.MID1));
  let mid2Marks    = normalizeSemesterMarksStore(readStoredMarks(KEYS.MID2));
  let internals    = normalizeSemesterMarksStore(readStoredMarks(KEYS.INTERNALS));
  let external     = normalizeSemesterMarksStore(readStoredMarks(KEYS.EXTERNAL, "external"));
  let semCgpa      = normalizeSemesterSgpaStore(readStoredCurrentSemCgpa());
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
    if (activeTab === "mid1")     return mid1Marks[activeSemester] ?? buildEmptyMarksMap();
    if (activeTab === "mid2")     return mid2Marks[activeSemester] ?? buildEmptyMarksMap();
    if (activeTab === "internals") return internals[activeSemester] ?? buildEmptyMarksMap();
    return external[activeSemester] ?? buildEmptyMarksMap();
  }
  function setCurrentMarks(newMap) {
    if (activeTab === "mid1")      mid1Marks[activeSemester] = newMap;
    else if (activeTab === "mid2") mid2Marks[activeSemester] = newMap;
    else if (activeTab === "internals") internals[activeSemester] = newMap;
    else external[activeSemester] = newMap;
  }
  function getStorageKey() {
    if (activeTab === "mid1")      return KEYS.MID1;
    if (activeTab === "mid2")      return KEYS.MID2;
    if (activeTab === "internals") return KEYS.INTERNALS;
    return KEYS.EXTERNAL;
  }

  function getMarkLimits() {
    if (activeTab === "mid1" || activeTab === "mid2") {
      return { min: 0, max: 25, step: 1, label: "Marks out of 25" };
    }

    if (activeTab === "internals") {
      return { min: 0, max: 30, step: 1, label: "Marks out of 30" };
    }

    if (activeTab === "external") {
      return { min: 0, max: 70, step: 1, label: "Marks out of 70" };
    }

    return { min: 0, max: 100, step: 1, label: "Marks out of 100" };
  }

  function isMidTab() {
    return activeTab === "mid1" || activeTab === "mid2";
  }

  function isInternalTab() {
    return activeTab === "internals";
  }

  function isExternalTab() {
    return activeTab === "external";
  }

  function isSemesterWiseMarksTab() {
    return activeTab === "mid1" || activeTab === "mid2" || activeTab === "internals" || activeTab === "external";
  }

  function getLabSubjects() {
    return subjects.filter(s => (s.subjectType || "regular") === "lab");
  }

  function getVisibleSubjectsForActiveTab() {
    if (activeTab === "mid1" || activeTab === "mid2") {
      return subjects.filter(s => (s.subjectType || "regular") !== "lab");
    }

    if (activeTab === "internals" || activeTab === "external") {
      return getLabSubjects();
    }

    return subjects;
  }

  function calcMidAveragePercent(bySubject, subjectList) {
    if (!subjectList.length) return "0.0%";

    const total = subjectList.reduce((sum, sub) => {
      const raw = Number(bySubject?.[sub.id] ?? "");
      const mark = isFinite(raw) ? Math.max(0, Math.min(25, raw)) : 0;
      return sum + mark;
    }, 0);

    const avg = total / subjectList.length;
    const percent = (avg / 25) * 100;
    return `${percent.toFixed(1)}%`;
  }

  function calcInternalAveragePercent(bySubject, subjectList) {
    if (!subjectList.length) return "0.0%";

    const total = subjectList.reduce((sum, sub) => {
      const raw = Number(bySubject?.[sub.id] ?? "");
      const mark = isFinite(raw) ? Math.max(0, Math.min(30, raw)) : 0;
      return sum + mark;
    }, 0);

    const avg = total / subjectList.length;
    const percent = (avg / 30) * 100;
    return `${percent.toFixed(1)}%`;
  }

  function calcExternalAveragePercent(bySubject, subjectList) {
    if (!subjectList.length) return "0.0%";

    const total = subjectList.reduce((sum, sub) => {
      const raw = Number(bySubject?.[sub.id] ?? "");
      const mark = isFinite(raw) ? Math.max(0, Math.min(70, raw)) : 0;
      return sum + mark;
    }, 0);

    const avg = total / subjectList.length;
    const percent = (avg / 70) * 100;
    return `${percent.toFixed(1)}%`;
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
    const semesterSelect = document.getElementById("marks-semester-select");
    const addLabBtn = document.getElementById("add-lab-subject-btn");
    if (saveBtn) saveBtn.addEventListener("click", () => handleSave());
    if (editBtn) editBtn.addEventListener("click", () => handleEdit());
    if (semesterSelect) {
      semesterSelect.addEventListener("change", e => {
        activeSemester = e.target.value;
        renderSheet();
      });
    }
    if (addLabBtn) {
      addLabBtn.addEventListener("click", () => {
        const nameInput = document.getElementById("lab-subject-name");
        const codeInput = document.getElementById("lab-subject-code");
        const name = (nameInput?.value || "").trim();
        const code = (codeInput?.value || "").trim().toUpperCase();

        if (!name || !code) {
          alert("Enter lab subject name and subject code.");
          return;
        }

        if (subjects.some(s => s.id === code || s.code.toUpperCase() === code)) {
          alert("Subject code already exists. Use a unique code.");
          return;
        }

        subjects.push({
          id: code,
          code,
          name,
          shortName: code,
          syllabusFileName: "",
          syllabusFileType: "",
          syllabusFileSize: 0,
          syllabusFileDataUrl: "",
          subjectType: "lab",
        });

        addSubjectToSemesterStore(mid1Marks, code);
        addSubjectToSemesterStore(mid2Marks, code);
        addSubjectToSemesterStore(internals, code);
        addSubjectToSemesterStore(external, code);

        saveSubjects(subjects);
        if (nameInput) nameInput.value = "";
        if (codeInput) codeInput.value = "";
        renderSheet();
      });
    }

    document.querySelectorAll("[data-remove-lab-subject]").forEach(btn => {
      btn.addEventListener("click", () => {
        const subjectId = btn.dataset.removeLabSubject;
        if (!subjectId) return;

        subjects = subjects.filter(s => s.id !== subjectId);
        removeSubjectFromSemesterStore(mid1Marks, subjectId);
        removeSubjectFromSemesterStore(mid2Marks, subjectId);
        removeSubjectFromSemesterStore(internals, subjectId);
        removeSubjectFromSemesterStore(external, subjectId);

        saveSubjects(subjects);
        renderSheet();
      });
    });

    // wire inputs
    document.querySelectorAll(".marks-input").forEach(input => {
      input.addEventListener("change", e => {
        const sid = e.target.dataset.student;
        const subId = e.target.dataset.subject;
        const markLimits = getMarkLimits();
        const rawValue = e.target.value;
        const n = Number(rawValue);
        const val = rawValue === "" || !isFinite(n)
          ? ""
          : String(Math.max(markLimits.min, Math.min(markLimits.max, n)));
        e.target.value = val;
        const marks = getCurrentMarks();
        const visibleSubjects = getVisibleSubjectsForActiveTab();
        if (!marks[sid]) marks[sid] = {};
        marks[sid][subId] = val;
        setCurrentMarks(marks);
        // Update avg cell
        const avgCell = document.getElementById(`avg-${sid}`);
        if (avgCell) {
          if (isMidTab()) {
            avgCell.textContent = calcMidAveragePercent(marks[sid] ?? {}, visibleSubjects);
          } else if (isInternalTab()) {
            avgCell.textContent = calcInternalAveragePercent(marks[sid] ?? {}, visibleSubjects);
          } else if (isExternalTab()) {
            avgCell.textContent = calcExternalAveragePercent(marks[sid] ?? {}, visibleSubjects);
          } else {
            avgCell.textContent = calcAverage(marks[sid] ?? {}, visibleSubjects);
          }
        }
      });
    });

    document.querySelectorAll(".cgpa-sem-input").forEach(input => {
      input.addEventListener("change", e => {
        const sid = e.target.dataset.student;
        const val  = sanitizeCgpa(e.target.value);
        e.target.value = val;
        if (!semCgpa[activeSemester]) semCgpa[activeSemester] = buildEmptySgpaMap();
        semCgpa[activeSemester][sid] = val;
        const finalCell = document.getElementById(`finalcgpa-${sid}`);
        const student   = students.find(s => s.id === sid);
        if (finalCell && student) finalCell.textContent = calcFinalCgpa(student.cgpa, val);
      });
    });
  }

  function renderMarksSheet(isEditable, actionBtn) {
    const marks = getCurrentMarks();
    const visibleSubjects = getVisibleSubjectsForActiveTab();
    const labSubjects = getLabSubjects();
    const markLimits = getMarkLimits();
    const showSemesterSelect = isSemesterWiseMarksTab();
    const avgHeaderLabel = (isMidTab() || isInternalTab() || isExternalTab()) ? "Avg %" : "Avg";
    const semesterOptions = SEMESTERS.map(sem =>
      `<option value="${sem}" ${sem === activeSemester ? "selected" : ""}>Sem ${sem}</option>`
    ).join("");
    const semesterControl = showSemesterSelect
      ? `<label class="text-xs text-muted" style="display:flex; align-items:center; gap:0.5rem;">
          <span>Semester</span>
          <select id="marks-semester-select" class="form-control form-control-sm" style="width:7rem;">
            ${semesterOptions}
          </select>
        </label>`
      : "";
    const labControl = isInternalTab()
      ? `<div class="d-flex align-items-center gap-2" style="flex-wrap:wrap; margin-top:0.5rem;">
          <input id="lab-subject-name" class="form-control form-control-sm" style="width:12rem;" placeholder="Lab Subject Name">
          <input id="lab-subject-code" class="form-control form-control-sm" style="width:8rem;" placeholder="Lab Code">
          <button id="add-lab-subject-btn" type="button" class="btn btn-outline btn-sm">Add Lab Subject</button>
          <span class="text-xs text-muted">Internal shows only lab subjects.</span>
        </div>
        <div class="d-flex align-items-center gap-2" style="flex-wrap:wrap; margin-top:0.5rem;">
          ${labSubjects.length ? labSubjects.map(s => `<span class="badge">${s.code} - ${s.name} <button type="button" class="btn btn-icon" data-remove-lab-subject="${s.id}" title="Remove lab subject" style="margin-left:0.25rem;">x</button></span>`).join("") : `<span class="text-xs text-muted">No lab subjects added yet.</span>`}
        </div>`
      : "";
    const colHeaders = visibleSubjects.map(s =>
      `<th title="${s.name}" style="min-width:120px;">${s.shortName}</th>`).join("");

    const rows = students.map(s => {
      const bySubject = marks[s.id] ?? {};
      const isHighlighted = s.id === highlightedId;
      const inputs = visibleSubjects.map(sub => `
        <td><input type="number" min="${markLimits.min}" max="${markLimits.max}" step="${markLimits.step}"
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
        <td id="avg-${s.id}" class="font-semibold">${isMidTab() ? calcMidAveragePercent(bySubject, visibleSubjects) : (isInternalTab() ? calcInternalAveragePercent(bySubject, visibleSubjects) : (isExternalTab() ? calcExternalAveragePercent(bySubject, visibleSubjects) : calcAverage(bySubject, visibleSubjects)))}</td>
      </tr>`;
    }).join("");

    const empty = visibleSubjects.length === 0
      ? `<tr><td colspan="3" class="no-results">No subject columns available for this tab.</td></tr>`
      : "";

    return `
      <div class="card">
        <div class="card-header d-flex align-items-center justify-content-between gap-2">
          <div>
            <h2 class="font-semibold text-sm" style="margin:0;">${TAB_LABELS[activeTab]}</h2>
            <p class="text-muted text-xs mt-1" style="margin:0;">Students in rows, subject short names in columns.</p>
            <p class="text-muted text-xs mt-1" style="margin:0;">${markLimits.label}. The Avg column is calculated from the marks entered for that student${showSemesterSelect ? ` in Sem ${activeSemester}` : ""}.</p>
            ${labControl}
          </div>
          <div class="d-flex align-items-center gap-2">${semesterControl}${actionBtn}</div>
        </div>
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th class="sticky-col-1">Roll No</th>
                <th class="sticky-col-2">Assigned Student</th>
                ${colHeaders}
                <th style="min-width:110px;">${avgHeaderLabel}</th>
              </tr>
            </thead>
            <tbody>${rows}${empty}</tbody>
          </table>
        </div>
      </div>`;
  }

  function renderFinalCgpaSheet(isEditable, actionBtn) {
    const sgpaByStudent = semCgpa[activeSemester] ?? buildEmptySgpaMap();
    const semesterOptions = SEMESTERS.map(sem =>
      `<option value="${sem}" ${sem === activeSemester ? "selected" : ""}>Sem ${sem}</option>`
    ).join("");

    const rows = students.map(s => {
      const isHighlighted = s.id === highlightedId;
      const sgpaValue = sgpaByStudent[s.id] ?? "";
      return `<tr class="${isHighlighted ? "highlighted" : ""}">
        <td>${s.rollNumber}</td>
        <td class="font-semibold">${s.name}</td>
        <td>${s.cgpa.toFixed(1)}</td>
        <td><input type="number" min="0" max="10" step="0.01"
          class="form-control form-control-sm cgpa-sem-input"
          style="width:6rem;"
          data-student="${s.id}"
          value="${sgpaValue}"
          placeholder="0.00"
          ${isEditable ? "" : "disabled"}
        /></td>
        <td id="finalcgpa-${s.id}" class="font-semibold">${calcFinalCgpa(s.cgpa, sgpaValue)}</td>
      </tr>`;
    }).join("");

    return `
      <div class="card">
        <div class="card-header d-flex align-items-center justify-content-between gap-2">
          <div>
            <h2 class="font-semibold text-sm" style="margin:0;">Final CGPA</h2>
            <p class="text-muted text-xs mt-1" style="margin:0;">Final CGPA = CGPA + (SGPA / 2), for Sem ${activeSemester}</p>
          </div>
          <div class="d-flex align-items-center gap-2">
            <label class="text-xs text-muted" style="display:flex; align-items:center; gap:0.5rem;">
              <span>Semester</span>
              <select id="marks-semester-select" class="form-control form-control-sm" style="width:7rem;">
                ${semesterOptions}
              </select>
            </label>
            ${actionBtn}
          </div>
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
      SEMESTERS.forEach(sem => {
        const semMap = {};
        students.forEach(s => {
          const n = Number((semCgpa[sem] ?? {})[s.id] ?? "");
          semMap[s.id] = isFinite(n) ? (s.cgpa + n/2).toFixed(2) : s.cgpa.toFixed(2);
        });
        computed[sem] = semMap;
      });
      localStorage.setItem(KEYS.FINAL_CGPA, JSON.stringify(computed));
    } else if (activeTab === "mid1") {
      localStorage.setItem(KEYS.MID1, JSON.stringify(mid1Marks));
    } else if (activeTab === "mid2") {
      localStorage.setItem(KEYS.MID2, JSON.stringify(mid2Marks));
    } else if (activeTab === "internals") {
      localStorage.setItem(KEYS.INTERNALS, JSON.stringify(internals));
    } else if (activeTab === "external") {
      localStorage.setItem(KEYS.EXTERNAL, JSON.stringify(external));
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
