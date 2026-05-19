// ============================================================
// index.js — Main dashboard page logic
// mirrors: Index.tsx, MentorAssignedStudents.tsx, UniversalSubjectsManager.tsx
// ============================================================

document.addEventListener("DOMContentLoaded", () => {

  // ---- State ----
  let showFilters  = false;
  let query        = "";
  let classFilter  = "all";
  let poorOnly     = false;
  let minCgpa = "", maxCgpa = "";
  let minMidMarks = "", maxMidMarks = "";
  let minAttendance = "", maxAttendance = "";

  const assignedRows = buildAssignedRows(students);

  // ---- DOM refs ----
  const filterToggleBtn  = document.getElementById("filter-toggle-btn");
  const filterCountBadge = document.getElementById("filter-count-badge");
  const poorOnlyTag      = document.getElementById("poor-only-tag");
  const filtersPanel     = document.getElementById("filters-panel");
  const queryInput       = document.getElementById("filter-query");
  const classSelect      = document.getElementById("filter-class");
  const poorCheckbox     = document.getElementById("filter-poor-only");
  const minCgpaInput     = document.getElementById("filter-cgpa-min");
  const maxCgpaInput     = document.getElementById("filter-cgpa-max");
  const minMidInput      = document.getElementById("filter-mid-min");
  const maxMidInput      = document.getElementById("filter-mid-max");
  const minAttInput      = document.getElementById("filter-att-min");
  const maxAttInput      = document.getElementById("filter-att-max");
  const resetBtn         = document.getElementById("reset-filters-btn");
  const showingCount     = document.getElementById("showing-count");
  const tbody            = document.getElementById("students-tbody");

  // Subjects modal
  const subjectsBtn        = document.getElementById("manage-subjects-btn");
  const subjectsModal      = document.getElementById("subjects-modal");
  const closeSubjectsModal = document.getElementById("close-subjects-modal");
  const closeSbjFooter     = document.getElementById("subjects-footer-close");
  const subjectCodeInput   = document.getElementById("new-subject-code");
  const subjectNameInput   = document.getElementById("new-subject-name");
  const subjectShortInput  = document.getElementById("new-subject-short");
  const subjectTypeSelect  = document.getElementById("new-subject-type");
  const syllabusFileName   = document.getElementById("syllabus-file-name");
  const syllabusInput      = document.getElementById("syllabus-file-input");
  const addSubjectBtn      = document.getElementById("add-subject-btn");
  const subjectErrorEl     = document.getElementById("subject-error");
  const subjectsTableBody  = document.getElementById("subjects-tbody");
  const noSubjectsEl       = document.getElementById("no-subjects-msg");

  let syllabusFile = null;

  // ---- Populate class options ----
  const classOptions = [...new Set(assignedRows.map(r => r.className))].sort();
  classOptions.forEach(cls => {
    const opt = document.createElement("option");
    opt.value = cls; opt.textContent = cls;
    classSelect.appendChild(opt);
  });

  // ---- Filter toggle ----
  filterToggleBtn.addEventListener("click", () => {
    showFilters = !showFilters;
    filtersPanel.classList.toggle("show", showFilters);
  });

  // ---- Filter inputs ----
  queryInput.addEventListener("input",    e => { query        = e.target.value;   renderTable(); });
  classSelect.addEventListener("change",  e => { classFilter  = e.target.value;   renderTable(); });
  poorCheckbox.addEventListener("change", e => { poorOnly     = e.target.checked; renderTable(); });
  minCgpaInput.addEventListener("input",  e => { minCgpa      = e.target.value;   renderTable(); });
  maxCgpaInput.addEventListener("input",  e => { maxCgpa      = e.target.value;   renderTable(); });
  minMidInput.addEventListener("input",   e => { minMidMarks  = e.target.value;   renderTable(); });
  maxMidInput.addEventListener("input",   e => { maxMidMarks  = e.target.value;   renderTable(); });
  minAttInput.addEventListener("input",   e => { minAttendance= e.target.value;   renderTable(); });
  maxAttInput.addEventListener("input",   e => { maxAttendance= e.target.value;   renderTable(); });

  resetBtn.addEventListener("click", () => {
    query = ""; queryInput.value = "";
    classFilter = "all"; classSelect.value = "all";
    poorOnly = false; poorCheckbox.checked = false;
    minCgpa = ""; maxCgpa = ""; minCgpaInput.value = ""; maxCgpaInput.value = "";
    minMidMarks = ""; maxMidMarks = ""; minMidInput.value = ""; maxMidInput.value = "";
    minAttendance = ""; maxAttendance = ""; minAttInput.value = ""; maxAttInput.value = "";
    renderTable();
  });

  function getFilteredRows() {
    const q    = query.trim().toLowerCase();
    const minC = minCgpa      === "" ? -Infinity : Number(minCgpa);
    const maxC = maxCgpa      === "" ? Infinity  : Number(maxCgpa);
    const minM = minMidMarks  === "" ? -Infinity : Number(minMidMarks);
    const maxM = maxMidMarks  === "" ? Infinity  : Number(maxMidMarks);
    const minA = minAttendance=== "" ? -Infinity : Number(minAttendance);
    const maxA = maxAttendance=== "" ? Infinity  : Number(maxAttendance);

    return assignedRows.filter(row => {
      const matchSearch = !q || row.name.toLowerCase().includes(q) || row.rollNo.toLowerCase().includes(q);
      const matchClass  = classFilter === "all" || row.className === classFilter;
      const matchPoor   = !poorOnly || row.cgpa < 6;
      const matchCgpa   = row.cgpa >= minC && row.cgpa <= maxC;
      const matchMid    = row.avgMidMarks >= minM && row.avgMidMarks <= maxM;
      const matchAtt    = row.attendance >= minA && row.attendance <= maxA;
      return matchSearch && matchClass && matchPoor && matchCgpa && matchMid && matchAtt;
    });
  }

  function countFilters() {
    let c = 0;
    if (query.trim()) c++;
    if (classFilter !== "all") c++;
    if (poorOnly) c++;
    if (minCgpa || maxCgpa) c++;
    if (minMidMarks || maxMidMarks) c++;
    if (minAttendance || maxAttendance) c++;
    return c;
  }

  function renderTable() {
    const filtered = getFilteredRows();
    showingCount.textContent = `Showing ${filtered.length} of ${assignedRows.length} students`;

    const cnt = countFilters();
    filterCountBadge.textContent = cnt;
    filterCountBadge.style.display = cnt > 0 ? "inline-flex" : "none";
    if (poorOnlyTag) poorOnlyTag.style.display = poorOnly ? "inline-flex" : "none";

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="12" class="no-results">No students match the current filters.</td></tr>`;
      return;
    }

    const iconAlert  = `<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
    const iconChat   = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`;

    tbody.innerHTML = filtered.map(row => {
      const status      = getStudentCgpaStatus(row.cgpa);
      const attColor    = row.attendance < 75 ? "text-attention" : "";
      const cautionHtml = row.attendance < 75
        ? `<span class="badge badge-caution" style="margin-left:0.5rem;">${iconAlert} Caution</span>` : "";

      return `<tr>
        <td>${row.rollNo}</td>
        <td>${row.name}</td>
        <td>${row.className}</td>
        <td>${row.cgpa.toFixed(1)}</td>
        <td>${row.finalCgpa.toFixed(1)}</td>
        <td><span class="${status.badgeClass}"><span class="${status.dotClass}"></span>${status.label}</span></td>
        <td>${row.avgMidMarks}</td>
        <td>${row.externalMarks.toFixed(1)}</td>
        <td><span class="${attColor}">${row.attendance}%</span>${cautionHtml}</td>
        <td><a href="index.html?student=${row.studentId}&view=profile" class="text-primary">View Profile</a></td>
        <td><a href="assign-mid-marks.html?student=${row.studentId}" class="text-primary">Assign Mid Marks</a></td>
        <td><button class="btn btn-primary btn-sm chat-row-btn" data-student="${row.studentId}">${iconChat} Chat</button></td>
      </tr>`;
    }).join("");

    tbody.querySelectorAll(".chat-row-btn").forEach(btn => {
      btn.addEventListener("click", () => window.openChatForStudent && window.openChatForStudent(btn.dataset.student));
    });
  }

  // ---- Subjects Modal ----
  subjectsBtn.addEventListener("click", () => {
    subjectsModal.classList.add("show");
    renderSubjectsList();
  });
  if (closeSubjectsModal) closeSubjectsModal.addEventListener("click", () => subjectsModal.classList.remove("show"));
  if (closeSbjFooter)     closeSbjFooter.addEventListener("click",     () => subjectsModal.classList.remove("show"));
  subjectsModal.addEventListener("click", e => { if (e.target === subjectsModal) subjectsModal.classList.remove("show"); });

  syllabusInput.addEventListener("change", e => {
    syllabusFile = e.target.files[0] || null;
    syllabusFileName.textContent = syllabusFile ? syllabusFile.name : "Upload syllabus file (.pdf, .doc, .docx)";
  });

  addSubjectBtn.addEventListener("click", async () => {
    if (subjectErrorEl) subjectErrorEl.textContent = "";
    const code      = subjectCodeInput.value.trim().toUpperCase();
    const name      = subjectNameInput.value.trim();
    const shortName = subjectShortInput.value.trim().toUpperCase() || code;
    const type      = subjectTypeSelect.value;

    if (!code || !name)  { if (subjectErrorEl) subjectErrorEl.textContent = "Subject code and name are required."; return; }
    if (!syllabusFile)   { if (subjectErrorEl) subjectErrorEl.textContent = "Please upload a syllabus file."; return; }
    if (syllabusFile.size > 2 * 1024 * 1024) { if (subjectErrorEl) subjectErrorEl.textContent = "Syllabus file size should be under 2 MB."; return; }

    const subjects = readStoredSubjects();
    if (subjects.some(s => s.id === code)) { if (subjectErrorEl) subjectErrorEl.textContent = "This subject code already exists."; return; }

    let dataUrl = null;
    try {
      dataUrl = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result);
        r.onerror = () => rej();
        r.readAsDataURL(syllabusFile);
      });
    } catch {
      if (subjectErrorEl) subjectErrorEl.textContent = "Unable to process syllabus file.";
      return;
    }

    subjects.push({ id: code, code, name, shortName, subjectType: type,
      syllabusFileName: syllabusFile.name, syllabusFileType: syllabusFile.type,
      syllabusFileSize: syllabusFile.size, syllabusFileDataUrl: dataUrl });
    saveSubjects(subjects);

    subjectCodeInput.value = ""; subjectNameInput.value = ""; subjectShortInput.value = "";
    subjectTypeSelect.value = "regular"; syllabusFile = null; syllabusInput.value = "";
    syllabusFileName.textContent = "Upload syllabus file (.pdf, .doc, .docx)";
    renderSubjectsList();
  });

  function renderSubjectsList() {
    const subjects = readStoredSubjects();
    if (subjects.length === 0) {
      if (noSubjectsEl) noSubjectsEl.style.display = "block";
      subjectsTableBody.innerHTML = "";
      return;
    }
    if (noSubjectsEl) noSubjectsEl.style.display = "none";

    const iconTrash = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`;
    subjectsTableBody.innerHTML = subjects.map(s => `
      <tr>
        <td class="font-mono">${s.code}</td>
        <td>${s.name}</td>
        <td class="font-semibold">${s.shortName}</td>
        <td style="text-transform:uppercase">${s.subjectType}</td>
        <td class="text-muted">${s.syllabusFileName
          ? `<a href="${s.syllabusFileDataUrl}" download="${s.syllabusFileName}" class="text-primary">${s.syllabusFileName} (${formatFileSize(s.syllabusFileSize)})</a>`
          : "-"}</td>
        <td><button class="btn btn-outline btn-sm remove-subject-btn" data-id="${s.id}">${iconTrash} Remove</button></td>
      </tr>`).join("");

    subjectsTableBody.querySelectorAll(".remove-subject-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.id;
        const subs = readStoredSubjects().filter(s => s.id !== id);
        saveSubjects(subs);
        [KEYS.MID1, KEYS.MID2, KEYS.INTERNALS].forEach(key => {
          const raw = localStorage.getItem(key);
          if (raw) {
            try {
              const m = JSON.parse(raw);
              Object.keys(m).forEach(sid => { delete m[sid][id]; });
              localStorage.setItem(key, JSON.stringify(m));
            } catch {}
          }
        });
        renderSubjectsList();
      });
    });
  }

  // Initial render
  renderTable();
  renderSubjectsList();
});
