// ============================================================
// attendance.js — Mirrors UploadAttendance.tsx fully
// Manual entry + CSV upload with full calculation logic
// ============================================================

document.addEventListener("DOMContentLoaded", () => {

  // ---- State ----
  let subjects         = readStoredSubjects();
  let attendanceMap    = readStoredAttendance();
  let totalClassesMap  = readStoredTotalClasses();
  let uploadMessage    = "";

  // Detect highlighted student
  const params        = new URLSearchParams(location.search);
  const highlightedId = students.some(s => s.id === params.get("student")) ? params.get("student") : "";

  // ---- DOM refs ----
  const csvInput         = document.getElementById("csv-upload-input");
  const uploadMsgEl      = document.getElementById("upload-message");
  const totalClassesGrid = document.getElementById("total-classes-grid");
  const attendanceBody   = document.getElementById("attendance-tbody");

  // ---- Render total classes inputs ----
  function renderTotalClassesGrid() {
    if (!totalClassesGrid) return;
    if (subjects.length === 0) {
      totalClassesGrid.innerHTML = `<p class="text-muted text-xs">No subjects yet. Add subjects first.</p>`;
      return;
    }
    totalClassesGrid.innerHTML = subjects.map(s => `
      <div class="subject-total-card">
        <p title="${s.name}">${s.shortName}</p>
        <input type="number" min="0"
          class="form-control form-control-sm total-classes-input"
          data-subject="${s.id}"
          value="${totalClassesMap[s.id] ?? ""}"
          placeholder="0">
      </div>`).join("");

    totalClassesGrid.querySelectorAll(".total-classes-input").forEach(input => {
      input.addEventListener("change", e => {
        const subId    = e.target.dataset.subject;
        const val      = sanitizeCount(e.target.value);
        e.target.value = val;
        totalClassesMap[subId] = val;
        localStorage.setItem(KEYS.TOTAL_CLASSES, JSON.stringify(totalClassesMap));
        recomputeAllSummaries();
      });
    });
  }

  // ---- Render attendance table headers ----
  function renderAttendanceHeaders() {
    const thead = document.getElementById("attendance-thead");
    if (!thead) return;
    const subjectThs = subjects.map(s =>
      `<th title="${s.name}" style="min-width:130px;">${s.shortName}</th>`).join("");
    thead.innerHTML = `<tr>
      <th class="sticky-col-1">Roll No</th>
      <th class="sticky-col-2">Assigned Student</th>
      ${subjectThs}
      <th style="min-width:130px;">Total Attended</th>
      <th style="min-width:160px;">Attendance %</th>
    </tr>`;
  }

  function calcSummary(studentId) {
    const bySubject    = attendanceMap[studentId] ?? {};
    const totalHeld    = subjects.reduce((acc, s) => {
      const v = Number(totalClassesMap[s.id] ?? "");
      return acc + (isFinite(v) ? v : 0);
    }, 0);
    const totalAttended = subjects.reduce((acc, s) => {
      const v = Number(bySubject[s.id] ?? "");
      return acc + (isFinite(v) ? v : 0);
    }, 0);
    const pct = totalHeld > 0 ? ((totalAttended / totalHeld) * 100).toFixed(1) : "0.0";
    return { totalAttended, percentage: pct };
  }

  function renderAttendanceTable() {
    if (!attendanceBody) return;
    if (subjects.length === 0) {
      attendanceBody.innerHTML = `<tr><td colspan="4" class="no-results">No subject columns yet. Create subjects first.</td></tr>`;
      return;
    }

    attendanceBody.innerHTML = students.map(s => {
      const bySubject     = attendanceMap[s.id] ?? {};
      const summary       = calcSummary(s.id);
      const isHighlighted = s.id === highlightedId;

      const cells = subjects.map(sub => {
        const maxVal = totalClassesMap[sub.id] || undefined;
        return `<td>
          <input type="number" min="0" ${maxVal ? `max="${maxVal}"` : ""}
            class="form-control form-control-sm attendance-input"
            style="width:7rem;"
            data-student="${s.id}" data-subject="${sub.id}"
            value="${bySubject[sub.id] ?? ""}"
            placeholder="0">
        </td>`;
      }).join("");

      return `<tr class="${isHighlighted ? "highlighted" : ""}">
        <td class="sticky-col-1">${s.rollNumber}</td>
        <td class="sticky-col-2 font-semibold">${s.name}</td>
        ${cells}
        <td id="total-attended-${s.id}" class="font-semibold">${summary.totalAttended}</td>
        <td id="att-pct-${s.id}" class="font-semibold">${summary.percentage}%</td>
      </tr>`;
    }).join("");

    attendanceBody.querySelectorAll(".attendance-input").forEach(input => {
      input.addEventListener("change", e => {
        const sid   = e.target.dataset.student;
        const subId = e.target.dataset.subject;
        const max   = Number(totalClassesMap[subId] ?? "");
        const val   = sanitizeCount(e.target.value);
        const final = val !== "" && isFinite(max) && max >= 0
          ? String(Math.min(Number(val), max)) : val;
        e.target.value = final;

        if (!attendanceMap[sid]) attendanceMap[sid] = {};
        attendanceMap[sid][subId] = final;
        localStorage.setItem(KEYS.ATTENDANCE, JSON.stringify(attendanceMap));
        updateSummaryRow(sid);
      });
    });
  }

  function updateSummaryRow(studentId) {
    const summary = calcSummary(studentId);
    const totalCell= document.getElementById(`total-attended-${studentId}`);
    const pctCell  = document.getElementById(`att-pct-${studentId}`);
    if (totalCell) totalCell.textContent = summary.totalAttended;
    if (pctCell)   pctCell.textContent   = summary.percentage + "%";
  }

  function recomputeAllSummaries() {
    students.forEach(s => updateSummaryRow(s.id));
  }

  // ---- CSV Upload ----
  function normalizeHeader(val) {
    return val.trim().toUpperCase().replace(/\s+/g, " ");
  }

  function parseCsvLine(line) {
    const result = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i+1] === '"') { current += '"'; i++; }
        else inQuotes = !inQuotes;
        continue;
      }
      if (ch === "," && !inQuotes) { result.push(current.trim()); current = ""; continue; }
      current += ch;
    }
    result.push(current.trim());
    return result;
  }

  function parseCsv(text) {
    return text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0).map(parseCsvLine);
  }

  function handleCsvUpload(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const rows = parseCsv(String(reader.result ?? ""));
        if (rows.length < 2) { setUploadMsg("Upload failed: CSV needs a header row and at least one data row."); return; }

        const headers      = rows[0].map(normalizeHeader);
        const rollColIdx   = headers.findIndex(h => ["ROLL NO","ROLL NUMBER","ROLLNO","ROLLNUMBER"].includes(h));
        if (rollColIdx === -1) { setUploadMsg("Upload failed: Add a 'Roll No' column."); return; }

        const subjectHeaderMap = new Map();
        const totalHeaderMap   = new Map();
        subjects.forEach(sub => {
          const keys = [normalizeHeader(sub.shortName), normalizeHeader(sub.code), normalizeHeader(sub.name)];
          for (const key of keys) {
            const idx = headers.findIndex(h => h === key);
            if (idx !== -1) { subjectHeaderMap.set(sub.id, idx); break; }
          }
          for (const key of keys) {
            const idx = headers.findIndex(h => h === `TOTAL ${key}` || h === `TOTAL_${key}`);
            if (idx !== -1) { totalHeaderMap.set(sub.id, idx); break; }
          }
        });

        const nextAtt    = { ...attendanceMap };
        const nextTotal  = { ...totalClassesMap };
        let   updatedCount = 0;

        rows.slice(1).forEach(row => {
          const rollCell = String(row[rollColIdx] ?? "").trim().toUpperCase();
          if (!rollCell) return;

          const isTotalRow = ["TOTAL_CLASSES","TOTAL CLASSES","TOTAL"].includes(rollCell);
          if (isTotalRow) {
            subjects.forEach(sub => {
              const idx = subjectHeaderMap.get(sub.id);
              if (idx === undefined) return;
              const val = sanitizeCount(String(row[idx] ?? ""));
              if (val !== "") nextTotal[sub.id] = val;
            });
            return;
          }

          const student = students.find(s => s.rollNumber.toUpperCase() === rollCell);
          if (!student) return;
          updatedCount++;

          const studentAtt = { ...(nextAtt[student.id] ?? {}) };
          subjects.forEach(sub => {
            const attIdx = subjectHeaderMap.get(sub.id);
            if (attIdx === undefined) return;
            const max = Number(nextTotal[sub.id] ?? "");
            const val = sanitizeCount(String(row[attIdx] ?? ""));
            if (val === "") return;
            studentAtt[sub.id] = isFinite(max) && max >= 0 ? String(Math.min(Number(val), max)) : val;
          });
          nextAtt[student.id] = studentAtt;
        });

        // TOTAL_<subject> column
        subjects.forEach(sub => {
          const totalIdx = totalHeaderMap.get(sub.id);
          if (totalIdx === undefined) return;
          const firstData = rows[1] ?? [];
          const val = sanitizeCount(String(firstData[totalIdx] ?? ""));
          if (val !== "") nextTotal[sub.id] = val;
        });

        totalClassesMap = nextTotal;
        attendanceMap   = nextAtt;
        localStorage.setItem(KEYS.TOTAL_CLASSES, JSON.stringify(totalClassesMap));
        localStorage.setItem(KEYS.ATTENDANCE,    JSON.stringify(attendanceMap));

        setUploadMsg(`Upload successful: attendance updated for ${updatedCount} student(s).`);
        renderTotalClassesGrid();
        renderAttendanceHeaders();
        renderAttendanceTable();
      } catch {
        setUploadMsg("Upload failed: Invalid format. Use CSV with Roll No and subject columns.");
      }
    };
    reader.onerror = () => setUploadMsg("Upload failed: Could not read file.");
    reader.readAsText(file);
  }

  function setUploadMsg(msg) {
    uploadMessage = msg;
    if (uploadMsgEl) uploadMsgEl.textContent = msg;
  }

  if (csvInput) csvInput.addEventListener("change", e => {
    const file = e.target.files[0];
    if (file) handleCsvUpload(file);
    e.target.value = "";
  });

  // Initial render
  renderTotalClassesGrid();
  renderAttendanceHeaders();
  renderAttendanceTable();
});
