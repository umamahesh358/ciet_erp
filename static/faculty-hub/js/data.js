const YEAR_LABELS = { 1: "I", 2: "II", 3: "III", 4: "IV" };
const YEARS = [1, 2, 3, 4];

const backendData = window.FACULTY_HUB_DATA || {};

const loadBackendArray = (key) => Array.isArray(backendData[key]) ? backendData[key] : [];

const saveData = () => {
  console.warn("Faculty Hub data is now managed by the Django backend.");
};

let departments = loadBackendArray("departments");
let sections = loadBackendArray("sections");
let cohorts = loadBackendArray("cohorts");
let courses = loadBackendArray("courses");
let institutionCourses = loadBackendArray("institutionCourses");
let students = loadBackendArray("students");
let hodUpdates = loadBackendArray("hodUpdates");

function getPerformanceLevel(marks) {
  if (marks >= 80) return "high";
  if (marks >= 60) return "medium";
  return "low";
}

function getPerformanceColor(level) {
  switch (level) {
    case "high": return "text-success";
    case "medium": return "text-warning";
    case "low": return "text-danger";
    default: return "text-muted";
  }
}
