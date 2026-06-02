// ============================================================
// data.js — backend adapter. Demo records were removed.
// ============================================================

const students = Array.isArray(window.MENTOR_STUDENTS) ? window.MENTOR_STUDENTS : [];

const initialMessages = Array.isArray(window.MENTOR_MESSAGES) ? window.MENTOR_MESSAGES : [];

const suggestionTemplates = {
  "Academic Advice": [
    "Focus on understanding core concepts rather than memorizing.",
    "I recommend attending extra tutorial sessions for weak subjects.",
    "Let's set up a study plan for the upcoming semester.",
  ],
  "Attendance Warning": [
    "Your attendance needs immediate improvement. Please be regular.",
    "You're at risk of being detained due to low attendance.",
    "Please prioritize attending classes regularly.",
  ],
  "Motivation": [
    "Excellent work! Keep it up!",
    "Great progress! You're improving steadily.",
    "I see real potential in you. Let's aim higher!",
  ],
  "Exam Preparation": [
    "Start revising from today. Focus on previous year papers.",
    "Make a timetable and allocate time for each subject.",
    "Don't hesitate to ask doubts. I'm here to help.",
  ],
};

// ---- Helper functions (mirrors mockData.ts) ----
function getStudentStatus(student) {
  if (student.cgpa < 6 || student.attendance < 65) return "needs-attention";
  if (student.cgpa < 7 || student.attendance < 75) return "watch-list";
  return "on-track";
}

function getSmartSuggestions(student) {
  const s = [];
  if (student.cgpa < 6) s.push("Let's work together to improve your academic performance.");
  if (student.attendance < 75) s.push("Your attendance needs improvement. Please be regular.");
  if (student.cgpa >= 8) s.push("Excellent work! Keep it up!");
  if (student.trend === "improving") s.push("Great progress! You're improving steadily.");
  if (student.trend === "declining") s.push("I've noticed a dip in your performance. Let's discuss how to get back on track.");
  return s;
}

function getStudentSuggest(student) {
  const suggestions = getSmartSuggestions(student);
  return suggestions.length > 0 ? suggestions[0] : 'on_track';
}

function getUnreadCount(studentId, messages) {
  return messages.filter(m => m.studentId === studentId && m.sender === "student" && m.status !== "seen").length;
}

// ---- Build assigned student rows (mirrors mentorMetrics.ts buildAssignedRows) ----
function buildAssignedRows(students) {
  return students.map(student => {
    const subjects = Array.isArray(student.subjects) ? student.subjects : [];
    const externalMarks = subjects.length === 0
      ? 0
      : parseFloat((subjects.reduce((acc, s) => acc + s.external, 0) / subjects.length).toFixed(1));
    return {
      studentId: student.id,
      rollNo: student.rollNumber,
      name: student.name,
      className: `${student.department} ${student.section}`,
      cgpa: student.cgpa,
      finalCgpa: student.cgpa,
      avgMidMarks: student.avgMarks,
      externalMarks,
      attendance: student.attendance,
    };
  });
}

// ---- CGPA status badge (mirrors MentorAssignedStudents.tsx getStudentCgpaStatus) ----
function getStudentCgpaStatus(cgpa) {
  if (cgpa < 6)   return { label: "Poor",      badgeClass: "badge badge-poor",      dotClass: "dot dot-red" };
  if (cgpa < 7)   return { label: "Average",   badgeClass: "badge badge-average",   dotClass: "dot dot-amber" };
  if (cgpa < 8.5) return { label: "Great",     badgeClass: "badge badge-great",     dotClass: "dot dot-blue" };
  return               { label: "Excellent",  badgeClass: "badge badge-excellent",  dotClass: "dot dot-emerald" };
}

// ---- Avatar colour helper ----
function avatarClass(name) {
  return "avatar-" + (name[0] || "A").toUpperCase();
}

// ---- Format time ----
function formatTime(date) {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// ---- Storage keys ----
const KEYS = {
  SUBJECTS         : "mentor-dashboard-universal-subjects",
  MID1             : "mentor-dashboard-student-mid1-marks",
  MID2             : "mentor-dashboard-student-mid2-marks",
  INTERNALS        : "mentor-dashboard-student-internals-marks",
  EXTERNAL         : "mentor-dashboard-student-external-marks",
  FINAL_CGPA       : "mentor-dashboard-student-final-cgpa",
  CURRENT_SEM_CGPA : "mentor-dashboard-student-current-sem-cgpa",
  ATTENDANCE       : "mentor-dashboard-student-attendance-by-subject",
  TOTAL_CLASSES    : "mentor-dashboard-total-classes-by-subject",
};

// ---- Build default subjects from mock data ----
function buildDefaultSubjects() {
  const byCode = new Map();
students.forEach(student => {
    const subjects = Array.isArray(student.subjects) ? student.subjects : [];
    subjects.forEach(subject => {
      const code = subject.code.trim().toUpperCase();
      if (!code || byCode.has(code)) return;
      byCode.set(code, {
        id: code, code, name: subject.name.trim(), shortName: code,
        syllabusFileName: "", syllabusFileType: "", syllabusFileSize: 0,
        syllabusFileDataUrl: "", subjectType: "regular",
      });
    });
  });
  return Array.from(byCode.values());
}

// ---- Read / write subjects from localStorage ----
function readStoredSubjects() {
  const raw = localStorage.getItem(KEYS.SUBJECTS);
  if (!raw) return buildDefaultSubjects();
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return buildDefaultSubjects();
    return parsed;
  } catch { return buildDefaultSubjects(); }
}

function saveSubjects(subjects) {
  localStorage.setItem(KEYS.SUBJECTS, JSON.stringify(subjects));
}

// ---- Read marks ----
function readStoredMarks(key, defaultType = "internal") {
  const raw = localStorage.getItem(key);
  if (!raw) return buildDefaultMarks(defaultType);
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return buildDefaultMarks(defaultType);
    return parsed;
  } catch { return buildDefaultMarks(defaultType); }
}

function buildDefaultMarks(type = "internal") {
  const map = {};
  students.forEach(s => {
    const bySubject = {};
    s.subjects.forEach(sub => {
      bySubject[sub.code.trim().toUpperCase()] = String(type === "internal" ? sub.internal : sub.external);
    });
    map[s.id] = bySubject;
  });
  return map;
}

function readStoredCurrentSemCgpa() {
  const raw = localStorage.getItem(KEYS.CURRENT_SEM_CGPA);
  if (!raw) return Object.fromEntries(students.map(s => [s.id, ""]));
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return Object.fromEntries(students.map(s => [s.id, ""]));
    return parsed;
  } catch { return Object.fromEntries(students.map(s => [s.id, ""])); }
}

// ---- Read attendance ----
function readStoredAttendance() {
  const raw = localStorage.getItem(KEYS.ATTENDANCE);
  if (!raw) return buildDefaultAttendance();
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return buildDefaultAttendance();
    return parsed;
  } catch { return buildDefaultAttendance(); }
}
function buildDefaultAttendance() {
  const map = {};
  students.forEach(s => {
    const bySubject = {};
    s.subjects.forEach(sub => { bySubject[sub.code.trim().toUpperCase()] = ""; });
    map[s.id] = bySubject;
  });
  return map;
}
function readStoredTotalClasses() {
  const raw = localStorage.getItem(KEYS.TOTAL_CLASSES);
  if (!raw) {
    const def = {};
    buildDefaultSubjects().forEach(sub => { def[sub.id] = ""; });
    return def;
  }
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      const def = {};
      buildDefaultSubjects().forEach(sub => { def[sub.id] = ""; });
      return def;
    }
    return parsed;
  } catch {
    const def = {};
    buildDefaultSubjects().forEach(sub => { def[sub.id] = ""; });
    return def;
  }
}

// ---- Sanitize helpers ----
function sanitizeMarks(val) {
  if (val === "") return "";
  const n = Number(val);
  if (!isFinite(n)) return "";
  return String(Math.max(0, Math.min(100, n)));
}
function sanitizeCgpa(val) {
  if (val === "") return "";
  const n = Number(val);
  if (!isFinite(n)) return "";
  return String(Number(Math.max(0, Math.min(10, n)).toFixed(2)));
}
function sanitizeCount(val) {
  if (val === "") return "";
  const n = Number(val);
  if (!isFinite(n)) return "";
  return String(Math.max(0, Math.min(999, Math.floor(n))));
}
function calcAverage(marksBySubject, subjects) {
  const valid = subjects.map(s => Number(marksBySubject[s.id] ?? "")).filter(v => isFinite(v) && v >= 0 && v <= 100);
  if (!valid.length) return "0.0";
  return (valid.reduce((a, b) => a + b, 0) / valid.length).toFixed(1);
}
function calcFinalCgpa(cgpa, semVal) {
  const n = Number(semVal);
  return isFinite(n) ? (cgpa + n / 2).toFixed(2) : cgpa.toFixed(2);
}

function formatFileSize(bytes) {
  if (!isFinite(bytes) || bytes <= 0) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
