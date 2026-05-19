/**
 * Courses Management Page
 * Handles course display, filtering, searching, and bulk actions
 */

let allCourses = [];
let filteredCourses = [];

/**
 * Initialize courses page on DOM load
 */
document.addEventListener('DOMContentLoaded', function() {
  initializeCourses();
});

/**
 * Initialize courses page
 */
async function initializeCourses() {
  await loadCourses();
  setupEventListeners();
  renderCourses();
}

/**
 * Load courses from backend
 */
async function loadCourses() {
  try {
    showStatus('Loading courses...', 'info');
    const apiUrl = window.MENTOR_COURSES_API || '/faculty-portal/mentor/courses/data/';
    const response = await fetch(apiUrl, {
      method: 'GET',
      credentials: 'same-origin',
      headers: {
        'X-Requested-With': 'XMLHttpRequest',
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const text = await response.text();
      throw new Error('Expected JSON but received non-JSON response: ' + text.slice(0, 200));
    }

    const data = await response.json();
    allCourses = data.courses || [];
    
    // Initial filter
    filteredCourses = [...allCourses];
    
    showStatus(`Loaded ${allCourses.length} courses`, 'success');
    setTimeout(() => {
      const statusEl = document.getElementById('status-message');
      if (statusEl) statusEl.classList.remove('show');
    }, 3000);
  } catch (error) {
    console.error('Error loading courses:', error);
    showStatus('Error loading courses: ' + error.message, 'error');
  }
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  // Search
  const searchInput = document.getElementById('search-courses');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      handleSearch(e.target.value);
    });
  }

  // Filter by category
  const filterCategory = document.getElementById('filter-category');
  if (filterCategory) {
    filterCategory.addEventListener('change', handleFilterChange);
  }

  // Clear filters
  const clearBtn = document.getElementById('btn-clear-filters');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      document.getElementById('search-courses').value = '';
      document.getElementById('filter-category').value = '';
      handleFilterChange();
    });
  }

  // Download template
  const downloadBtn = document.getElementById('btn-download-template');
  if (downloadBtn) {
    downloadBtn.addEventListener('click', downloadScoreTemplate);
  }

  // Modal close buttons
  const modal = document.getElementById('course-modal');
  const closeBtn = document.querySelector('.modal-close');
  const closeBtnBottom = document.querySelector('.modal-close-btn');
  
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      modal.classList.remove('active');
    });
  }
  
  if (closeBtnBottom) {
    closeBtnBottom.addEventListener('click', () => {
      modal.classList.remove('active');
    });
  }

  // Close modal on background click
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.remove('active');
      }
    });
  }
}

/**
 * Handle search input
 */
function handleSearch(query) {
  handleFilterChange();
}

/**
 * Handle filter changes
 */
function handleFilterChange() {
  const searchQuery = document.getElementById('search-courses').value.toLowerCase();
  const categoryFilter = document.getElementById('filter-category').value;

  filteredCourses = allCourses.filter(course => {
    // Search filter
    const matchesSearch = searchQuery === '' || 
      course.name.toLowerCase().includes(searchQuery) ||
      (course.description && course.description.toLowerCase().includes(searchQuery));

    // Category filter
    const matchesCategory = categoryFilter === '' || course.category === categoryFilter;

    return matchesSearch && matchesCategory;
  });

  renderCourses();
}

/**
 * Get category display name
 */
function getCategoryLabel(category) {
  const categoryMap = {
    'aptitude': 'Aptitude',
    'verbal': 'Verbal',
    'soft_skills': 'Soft Skills',
    'programming': 'Programming',
    'java': 'Java',
    'dotnet': '.NET',
    'python': 'Python',
    'abap': 'ABAP',
    'other': 'Other'
  };
  return categoryMap[category] || category;
}

/**
 * Get category class
 */
function getCategoryClass(category) {
  const classList = {
    'aptitude': 'category-aptitude',
    'verbal': 'category-verbal',
    'soft_skills': 'category-soft-skills',
    'programming': 'category-programming',
    'java': 'category-programming',
    'python': 'category-programming',
    'dotnet': 'category-programming'
  };
  return classList[category] || '';
}

/**
 * Render courses
 */
function renderCourses() {
  const grid = document.getElementById('courses-grid');
  const emptyState = document.getElementById('empty-state');

  if (filteredCourses.length === 0) {
    grid.innerHTML = '';
    emptyState.style.display = 'block';
    return;
  }

  emptyState.style.display = 'none';
  grid.innerHTML = filteredCourses.map(course => createCourseCard(course)).join('');

  // Add event listeners to course cards
  document.querySelectorAll('.course-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (!e.target.closest('.course-actions')) {
        const courseId = card.dataset.courseId;
        openCourseModal(allCourses.find(c => c.id == courseId));
      }
    });
  });

  // Add event listeners to action buttons
  document.querySelectorAll('.btn-view').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const courseId = btn.dataset.courseId;
      openCourseModal(allCourses.find(c => c.id == courseId));
    });
  });
}

/**
 * Create course card HTML
 */
function createCourseCard(course) {
  const categoryLabel = getCategoryLabel(course.category);
  const categoryClass = getCategoryClass(course.category);
  const studentCount = course.students_count || 0;
  const assessmentCount = course.assessments_count || 0;
  const description = course.description || 'No description provided';

  return `
    <div class="course-card" data-course-id="${course.id}">
      <div class="course-header">
        <h3 class="course-title">${escapeHtml(course.name)}</h3>
        <div class="course-badge ${categoryClass}">${categoryLabel}</div>
      </div>

      <div class="course-description">${escapeHtml(description)}</div>

      <div class="course-stats">
        <div class="stat-mini">
          <div class="stat-mini-value">${studentCount}</div>
          <div class="stat-mini-label">Students</div>
        </div>
        <div class="stat-mini">
          <div class="stat-mini-value">${assessmentCount}</div>
          <div class="stat-mini-label">Assessments</div>
        </div>
      </div>

      <div class="course-actions">
        <button class="btn btn-small btn-view" data-course-id="${course.id}">
          <span>View Details</span>
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
        </button>
      </div>
    </div>
  `;
}

/**
 * Open course detail modal
 */
function openCourseModal(course) {
  const modal = document.getElementById('course-modal');
  const titleEl = document.getElementById('modal-course-title');
  const categoryEl = document.getElementById('modal-course-category');
  const descriptionEl = document.getElementById('modal-course-description');
  const studentCountEl = document.getElementById('modal-course-student-count');
  const assessmentsListEl = document.getElementById('modal-assessments-list');
  const studentsListEl = document.getElementById('modal-students-list');
  const exportBtn = document.getElementById('modal-export-btn');

  titleEl.textContent = course.name;
  categoryEl.textContent = getCategoryLabel(course.category);
  descriptionEl.textContent = course.description || 'No description';
  studentCountEl.textContent = (course.students || []).length;

  // Render assessments
  if (course.assessments && course.assessments.length > 0) {
    assessmentsListEl.innerHTML = course.assessments.map(assessment => `
      <div class="assessment-item">
        <div class="assessment-name">${escapeHtml(assessment.name)}</div>
        <div class="assessment-meta">
          <span>Max Score: ${assessment.max_score}</span>
          <span>${assessment.is_published ? '✓ Published' : 'Draft'}</span>
        </div>
      </div>
    `).join('');
  } else {
    assessmentsListEl.innerHTML = '<p style="text-align: center; color: var(--muted-foreground);">No assessments created yet</p>';
  }

  // Render students
  if (course.students && course.students.length > 0) {
    studentsListEl.innerHTML = course.students.map(student => `
      <div class="student-card">
        <div class="student-roll">${student.roll_no}</div>
        <div class="student-name">${escapeHtml(student.first_name + ' ' + student.last_name)}</div>
        <div class="student-info">
          <span>${student.batch || 'N/A'}</span>
          <span>${student.department}</span>
        </div>
      </div>
    `).join('');
  } else {
    studentsListEl.innerHTML = '<p style="text-align: center; color: var(--muted-foreground);">No students enrolled</p>';
  }

  exportBtn.onclick = () => exportCourseData(course);

  modal.classList.add('active');
}

/**
 * Export course data to CSV
 */
function exportCourseData(course) {
  try {
    // Prepare CSV data
    let csv = 'Course Information\n';
    csv += `Name,${course.name}\n`;
    csv += `Category,${getCategoryLabel(course.category)}\n`;
    csv += `Description,"${course.description || ''}"\n`;
    csv += `Total Students,${course.students ? course.students.length : 0}\n`;
    csv += '\n';

    // Add students
    csv += 'Enrolled Students\n';
    csv += 'Roll No,Name,Batch,Department\n';
    if (course.students && course.students.length > 0) {
      course.students.forEach(student => {
        csv += `${student.roll_no},"${student.first_name} ${student.last_name}",${student.batch || 'N/A'},${student.department}\n`;
      });
    }
    csv += '\n';

    // Add assessments
    csv += 'Assessments\n';
    csv += 'Name,Max Score,Status\n';
    if (course.assessments && course.assessments.length > 0) {
      course.assessments.forEach(assessment => {
        csv += `"${assessment.name}",${assessment.max_score},"${assessment.is_published ? 'Published' : 'Draft'}"\n`;
      });
    }

    // Create download link
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `course-${course.id}-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    showStatus('Course data exported successfully', 'success');
  } catch (error) {
    console.error('Error exporting course data:', error);
    showStatus('Error exporting course data: ' + error.message, 'error');
  }
}

/**
 * Download score template for a course
 */
async function downloadScoreTemplate() {
  try {
    if (filteredCourses.length === 0) {
      showStatus('No courses available to download template for', 'error');
      return;
    }

    // If only one course, download its template; otherwise show selection
    if (filteredCourses.length === 1) {
      downloadCourseTemplate(filteredCourses[0]);
    } else {
      showStatus('Select a course first to download its template', 'info');
    }
  } catch (error) {
    console.error('Error downloading template:', error);
    showStatus('Error downloading template: ' + error.message, 'error');
  }
}

/**
 * Download template for specific course
 */
function downloadCourseTemplate(course) {
  if (!course.score_template) {
    showStatus(`No template available for ${course.name}`, 'error');
    return;
  }

  try {
    const link = document.createElement('a');
    link.href = course.score_template;
    link.download = `${course.name.replace(/\s+/g, '_')}_template.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showStatus('Template downloaded successfully', 'success');
  } catch (error) {
    console.error('Error downloading template:', error);
    showStatus('Error downloading template', 'error');
  }
}

/**
 * Show status message
 */
function showStatus(message, type = 'info') {
  const statusEl = document.getElementById('status-message');
  if (statusEl) {
    statusEl.textContent = message;
    statusEl.className = `status-message show status-${type}`;
  }
}

/**
 * Get CSRF token from cookies
 */
function getCsrfToken() {
  const name = 'csrftoken';
  let cookieValue = null;
  if (document.cookie && document.cookie !== '') {
    const cookies = document.cookie.split(';');
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim();
      if (cookie.substring(0, name.length + 1) === (name + '=')) {
        cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
        break;
      }
    }
  }
  return cookieValue || '';
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}
