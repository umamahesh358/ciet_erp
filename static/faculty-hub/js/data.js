const YEAR_LABELS = { 1: "I", 2: "II", 3: "III", 4: "IV" };
const YEARS = [1, 2, 3, 4];

// Persistence Helper
const loadData = (key, defaults) => {
    const saved = localStorage.getItem(`faculty_hub_${key}`);
    return saved ? JSON.parse(saved) : defaults;
};

const saveData = (key, data) => {
    localStorage.setItem(`faculty_hub_${key}`, JSON.stringify(data));
};

let departments = loadData('departments', [
  { id: "dept-1", name: "CSE - Artificial Intelligence", code: "CSE-AI" },
  { id: "dept-2", name: "CSE - AI & Machine Learning", code: "CSE-AIML" },
  { id: "dept-3", name: "CSE - Information Technology", code: "CSE-IT" },
  { id: "dept-4", name: "CSE", code: "CSE" },
  { id: "dept-5", name: "Computer Science & Cybersecurity", code: "CSC" },
  { id: "dept-6", name: "Civil Engineering", code: "CIVIL" },
  { id: "dept-7", name: "Electronics and Communication Engineering", code: "ECE" },
  { id: "dept-8", name: "Electrical and Electronics Engineering", code: "EEE" },
]);

let sections = loadData('sections', [
  { id: "sec-1", name: "A", departmentId: "dept-1", year: 1 },
  { id: "sec-2", name: "B", departmentId: "dept-1", year: 1 },
  { id: "sec-3", name: "C", departmentId: "dept-1", year: 1 },
]);

let cohorts = loadData('cohorts', [
  { id: "coh-1", name: "Cohort Alpha", departmentId: "dept-1", sectionIds: ["sec-1", "sec-2"], year: 1 },
]);

let courses = loadData('courses', [
  { id: "crs-1", name: "Data Structures & Algorithms", departmentId: "dept-1", sectionIds: ["sec-1"], cohortIds: ["coh-1"], year: 1, published: true },
]);

let institutionCourses = loadData('inst_courses', [
  { id: "inst-1", name: "Aptitude", category: "General", sectionIds: ["sec-1"], year: 1 },
]);

let students = loadData('students', [
    { id: "stu-1", name: "Aarav Sharma", regNo: "REG20240001", sectionId: "sec-1", cohortId: "coh-1", departmentId: "dept-1", year: 1, marks: 85, courseCompletion: { "crs-1": 80 } },
]);

let hodUpdates = loadData('hod_updates', [
    { id: "upd-1", title: "New Evaluation Policy", content: "The HOD has announced a revised evaluation policy for the upcoming semester. Please review the detailed document in the department portal.", date: "2024-04-05", departmentId: "dept-1", priority: "high" },
    { id: "upd-2", title: "Faculty Meeting Schedule", content: "Monthly faculty meeting is scheduled for next Monday at 10:00 AM in the conference hall. Attendance is mandatory.", date: "2024-04-07", departmentId: "dept-2", priority: "medium" },
    { id: "upd-3", title: "Research Grant Opportunities", content: "New research grant opportunities are available for faculty members. Contact the HOD for application guidelines.", date: "2024-04-06", departmentId: "dept-4", priority: "low" },
]);

function getPerformanceLevel(marks) {
//... (existing functions) ...
  if (marks >= 80) return "high";
  if (marks >= 60) return "medium";
  return "low";
}

function getPerformanceColor(level) {
  switch (level) {
    case "high": return "text-success";
    case "medium": return "text-warning";
    case "low": return "text-danger";
  }
}
