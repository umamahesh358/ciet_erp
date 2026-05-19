/**
 * Courses Management Page
 * Handles course display, filtering, searching, and bulk actions
 */

let allCourses = [];
let filteredCourses = [];
let courseModalEscListener = null;
let currentCourseForDetailModal = null;

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
    // Capture available students pool from API (fallback for Add Students modal)
    window.availableStudentsData = data.available_students || [];
    
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
  // New Course button
  const newCourseBtn = document.getElementById('btn-new-course');
  if (newCourseBtn) {
    newCourseBtn.addEventListener('click', () => {
      document.getElementById('create-course-modal').classList.add('active');
    });
  }

  // Course form submission
  const courseForm = document.getElementById('course-form');
  if (courseForm) {
    courseForm.addEventListener('submit', handleCreateCourse);
  }

  // Edit course form submission
  const editCourseForm = document.getElementById('edit-course-form');
  if (editCourseForm) {
    editCourseForm.addEventListener('submit', handleEditCourse);
  }

  // File upload area handlers
  const fileUploadArea = document.getElementById('file-upload-area');
  if (fileUploadArea) {
    fileUploadArea.addEventListener('click', () => {
      document.getElementById('course-materials').click();
    });

    fileUploadArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      fileUploadArea.classList.add('dragover');
    });

    fileUploadArea.addEventListener('dragleave', () => {
      fileUploadArea.classList.remove('dragover');
    });

    fileUploadArea.addEventListener('drop', (e) => {
      e.preventDefault();
      fileUploadArea.classList.remove('dragover');
      if (e.dataTransfer.files.length > 0) {
        document.getElementById('course-materials').files = e.dataTransfer.files;
      }
    });
  }

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
      if (!e.target.closest('.course-actions-bottom')) {
        const courseId = card.dataset.courseId;
        openCourseModal(allCourses.find(c => c.id == courseId));
      }
    });
  });

  // Add event listeners to view details buttons
  document.querySelectorAll('.btn-view-details').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const courseId = btn.dataset.courseId;
      const course = allCourses.find(c => String(c.id) === String(courseId));
      if (!course) {
        showStatus('Unable to open course details for this item.', 'error');
        return;
      }
      openCourseModal(course);
    });
  });

  // Add event listeners to edit buttons
  document.querySelectorAll('.btn-edit').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const courseId = btn.dataset.courseId;
      const course = allCourses.find(c => c.id == courseId);
      openEditModal(course);
    });
  });

  // Add event listeners to delete buttons
  document.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const courseId = btn.dataset.courseId;
      const course = allCourses.find(c => c.id == courseId);
      if (confirm(`Delete course "${escapeHtml(course.name)}"? This action cannot be undone.`)) {
        deleteCourse(courseId);
      }
    });
  });
}

/**
 * Create course card HTML
 */
function createCourseCard(course) {
  const categoryLabel = getCategoryLabel(course.category);
  const categoryClass = getCategoryClass(course.category);
  
  // Extract metadata from course or use defaults
  const dept = course.department || 'CSE-AI';
  const year = course.academic_year || 'Year I';
  const section = course.section || 'Sec A';
  const cohortInfo = course.cohort_name || (course.cohorts && course.cohorts.length > 0 ? course.cohorts.map(c => c.name).join(', ') : 'Cohort Alpha');
  const materialsCount = course.materials_count || 0;
  const isPublished = course.published || course.is_published_to_profile || false;
  const isInstitutional = course.is_institutional || false;

  return `
    <div class="course-card" data-course-id="${course.id}">
      <div class="course-header-new">
        <h3 class="course-title-new">${escapeHtml(course.name)}</h3>
      </div>

      <div class="course-badges-row">
        <span class="badge-pill badge-dept">${escapeHtml(dept)}</span>
        <span class="badge-pill badge-year">${escapeHtml(year)}</span>
        <span class="badge-pill badge-status">${isPublished ? 'Published' : 'Draft'}</span>
        ${isInstitutional ? '<span class="badge-pill badge-institutional">Institutional</span>' : ''}
      </div>

      <div class="course-metadata">
        <div class="metadata-item">
          <span class="metadata-icon">📎</span>
          <span class="metadata-text">${materialsCount} materials</span>
        </div>
        <div class="metadata-item">
          <span class="metadata-label">Sec ${escapeHtml(section)}</span>
        </div>
      </div>

      <div class="course-cohorts-info">
        <span class="cohorts-label">Cohorts:</span>
        <span class="cohorts-value">${escapeHtml(cohortInfo)}</span>
      </div>

      <div class="course-actions-bottom">
        <button class="btn-view-details" data-course-id="${course.id}">View Details →</button>
        <div class="card-action-icons">
          <button class="btn-icon btn-edit" data-course-id="${course.id}" title="Edit Course">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="btn-icon btn-delete" data-course-id="${course.id}" title="Delete Course">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
          </button>
        </div>
      </div>
    </div>
  `;
}

/**
 * Open course detail modal
 */
function openCourseModal(course) {
  if (!course) {
    showStatus('Course details not available.', 'error');
    return;
  }

  const modal = document.getElementById('course-modal');
  const titleEl = document.getElementById('modal-course-title');
  const courseNameEl = document.getElementById('modal-course-name');
  const courseMetaEl = document.getElementById('modal-course-meta');
  const deptPillEl = document.getElementById('modal-pill-dept');
  const yearPillEl = document.getElementById('modal-pill-year');
  const statusPillEl = document.getElementById('modal-pill-status');
  const statsStudentsEl = document.getElementById('modal-stat-students');
  const statsSectionsEl = document.getElementById('modal-stat-sections');
  const statsMaterialsEl = document.getElementById('modal-stat-materials');
  const studentsCountPillEl = document.getElementById('modal-students-count-pill');
  const sectionsListEl = document.getElementById('modal-sections-list');
  const materialsListEl = document.getElementById('modal-materials-list');
  const materialsCountEl = document.getElementById('modal-materials-count');
  const studentsListEl = document.getElementById('modal-students-list');
  const studentSearchEl = document.getElementById('modal-student-search');
  const studentSortEl = document.getElementById('modal-student-sort');
  const backBtn = document.getElementById('course-modal-back-btn');
  const allCoursesBtn = document.querySelector('.btn-all-courses');

  if (!modal || !titleEl || !courseNameEl || !courseMetaEl || !statsStudentsEl ||
      !statsSectionsEl || !statsMaterialsEl || !sectionsListEl || !materialsListEl ||
      !materialsCountEl || !studentsListEl || !studentSearchEl || !studentSortEl ||
      !deptPillEl || !yearPillEl || !statusPillEl || !studentsCountPillEl ||
      !backBtn || !allCoursesBtn) {
    showStatus('Course details UI is not fully available on this page.', 'error');
    return;
  }

  const normalizedName = course.name || 'Untitled Course';
  const normalizedDepartment = course.department || 'Department';
  const normalizedYear = course.academic_year || course.year_level || 'Year';
  const published = Boolean(course.published ?? course.is_published ?? course.is_published_to_profile);
  const statusLabel = published ? 'Published' : 'Draft';
  const sections = Array.isArray(course.sections)
    ? course.sections
    : (course.section ? [course.section] : []);
  const students = Array.isArray(course.students) ? course.students : [];
  const materialObjects = Array.isArray(course.materials) ? course.materials : [];
  const materialsCountFallback = Number(course.materials_count || 0);
  const materialsCount = materialObjects.length > 0 ? materialObjects.length : materialsCountFallback;
  const cohortLabel = course.cohort_name || 'Cohort not assigned';

  // Set title
  titleEl.textContent = normalizedName;
  courseNameEl.textContent = normalizedName;
  
  // Set metadata
  courseMetaEl.textContent = `${normalizedDepartment} • ${normalizedYear} • ${cohortLabel}`;
  deptPillEl.textContent = normalizedDepartment;
  yearPillEl.textContent = normalizedYear;
  statusPillEl.textContent = statusLabel;

  // Set stats
  const studentCount = students.length;
  const sectionCount = sections.length;
  
  statsStudentsEl.textContent = studentCount;
  statsSectionsEl.textContent = sectionCount;
  statsMaterialsEl.textContent = materialsCount;
  studentsCountPillEl.textContent = String(studentCount);

  // Render sections
  if (sections.length > 0) {
    sectionsListEl.innerHTML = sections.map(section => `
      <div class="section-badge">${escapeHtml(section.name || section.code || section)}</div>
    `).join('');
  } else {
    sectionsListEl.innerHTML = '<p style="color: #999; margin: 0;">No sections assigned yet.</p>';
  }

  // Render materials
  if (materialObjects.length > 0) {
    materialsCountEl.textContent = `${materialsCount} ${materialsCount === 1 ? 'file' : 'files'}`;
    materialsListEl.innerHTML = materialObjects.map(material => `
      <div class="material-item">
        <span class="material-name">${escapeHtml(material.name || material.title || 'Untitled Material')}</span>
        <a href="#" class="material-link">View</a>
      </div>
    `).join('');
  } else if (materialsCount > 0) {
    materialsCountEl.textContent = `${materialsCount} files`;
    materialsListEl.innerHTML = `
      <div class="material-item">
        <span class="material-name">${materialsCount} files are attached to this course.</span>
        <a href="#" class="material-link">Open</a>
      </div>
    `;
  } else {
    materialsCountEl.textContent = '0 files';
    materialsListEl.innerHTML = '<p style="color: #999; margin: 0; text-align: center;">No study materials uploaded yet.</p>';
  }

  // Store students data for filtering
  let allStudents = students;
  let filteredStudents = [...allStudents];

  // Render students table
  const renderStudentsTable = () => {
    if (filteredStudents.length === 0) {
      studentsListEl.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem; color: #999;">No students found</td></tr>';
    } else {
      studentsListEl.innerHTML = filteredStudents.map(student => {
        const initials = ((student.first_name || 'S')[0] + (student.last_name || 'S')[0]).toUpperCase();
        const fullName = `${student.first_name || ''} ${student.last_name || ''}`.trim() || 'Student';
        const email = escapeHtml(student.email || student.personal_email || 'N/A');
        const phone = escapeHtml(student.phone || student.personal_phone || 'N/A');
        return `
          <tr>
            <td>
              <div class="student-name-cell">
                <div class="student-avatar">${initials}</div>
                <span>${escapeHtml(fullName)}</span>
              </div>
            </td>
            <td><span class="student-badge">${escapeHtml(student.roll_no || 'N/A')}</span></td>
            <td>${escapeHtml(student.department || 'N/A')}</td>
            <td>${escapeHtml(student.section || student.batch || 'N/A')}</td>
            <td><span style="font-size: 0.85rem; color: #666;">${email}</span></td>
            <td><span style="font-size: 0.85rem; color: #666;">${phone}</span></td>
          </tr>
        `;
      }).join('');
    }
  };

  // Search functionality
  studentSearchEl.oninput = (e) => {
    const searchTerm = e.target.value.toLowerCase();
    filteredStudents = allStudents.filter(student => {
      const fullName = `${student.first_name || ''} ${student.last_name || ''}`.toLowerCase();
      const rollNo = (student.roll_no || '').toLowerCase();
      return fullName.includes(searchTerm) || rollNo.includes(searchTerm);
    });
    
    // Apply current sort
    applySorting();
    renderStudentsTable();
  };

  // Sort functionality
  const applySorting = () => {
    const sortValue = studentSortEl.value;
    switch(sortValue) {
      case 'name-asc':
        filteredStudents.sort((a, b) => (`${a.first_name || ''}${a.last_name || ''}`).localeCompare(`${b.first_name || ''}${b.last_name || ''}`));
        break;
      case 'name-desc':
        filteredStudents.sort((a, b) => (`${b.first_name || ''}${b.last_name || ''}`).localeCompare(`${a.first_name || ''}${a.last_name || ''}`));
        break;
      case 'roll-asc':
        filteredStudents.sort((a, b) => (a.roll_no || '').localeCompare(b.roll_no || ''));
        break;
      case 'roll-desc':
        filteredStudents.sort((a, b) => (b.roll_no || '').localeCompare(a.roll_no || ''));
        break;
    }
  };

  studentSortEl.onchange = () => {
    applySorting();
    renderStudentsTable();
  };

  // Close modal handlers
  const closeModal = () => {
    modal.classList.remove('active');
    studentSearchEl.value = '';
    studentSortEl.value = 'name-asc';
  };

  backBtn.onclick = closeModal;
  allCoursesBtn.onclick = closeModal;

  // Also close when clicking outside the modal or on X
  if (courseModalEscListener) {
    document.removeEventListener('keydown', courseModalEscListener);
  }

  courseModalEscListener = (e) => {
    if (e.key === 'Escape') {
      closeModal();
    }
  };
  document.addEventListener('keydown', courseModalEscListener);

  // Initial render
  applySorting();
  renderStudentsTable();

  // Store course for add students functionality
  window.currentCourseForDetailModal = course;
  setupAddStudentsListeners();

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
 * Load cohorts for selection in create course modal
 */
async function loadCohortsForSelection() {
  // This function is no longer needed with the new form structure
  // The new form uses individual fields instead of checkbox selection
  console.log('New form structure does not require loading cohorts');
}

/**
 * Handle course creation form submission
 */
async function handleCreateCourse(e) {
  e.preventDefault();

  const apiUrl = window.MENTOR_COURSES_API || '/faculty-portal/mentor/courses/data/';

  const courseName = document.getElementById('course-name').value.trim();
  const courseDepartment = document.getElementById('course-department').value;
  const courseAcademicYear = document.getElementById('course-academic-year').value.trim();
  const courseSection = document.getElementById('course-section').value;
  const courseCohortName = document.getElementById('course-cohort-name').value.trim();
  const isInstitutional = document.getElementById('course-institutional').checked;
  const courseFile = document.getElementById('course-materials').files[0];

  if (!courseName) {
    showStatus('Please fill in all required fields', 'error');
    return;
  }

  try {
    showStatus('Creating course...', 'info');

    const formData = new FormData();
    formData.append('action', 'create_course');
    formData.append('name', courseName);
    formData.append('department', courseDepartment);
    formData.append('academic_year', courseAcademicYear);
    formData.append('section', courseSection);
    formData.append('cohort_name', courseCohortName);
    formData.append('category', 'other');
    formData.append('description', '');
    formData.append('is_institutional', isInstitutional ? 'on' : 'off');
    
    if (courseFile) {
      formData.append('course_material', courseFile);
    }

    const response = await fetch(apiUrl, {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'X-Requested-With': 'XMLHttpRequest',
        'Accept': 'application/json',
        'X-CSRFToken': getCsrfToken(),
      },
      body: formData
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const text = await response.text();
      throw new Error('Expected JSON but received non-JSON response: ' + text.slice(0, 200));
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.message || 'Course creation failed');
    }

    showStatus('Course created successfully!', 'success');
    
    // Close modal and reset form
    document.getElementById('create-course-modal').classList.remove('active');
    document.getElementById('course-form').reset();
    
    // Reload courses
    await loadCourses();
    renderCourses();

  } catch (error) {
    console.error('Error creating course:', error);
    showStatus('Error creating course: ' + error.message, 'error');
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
  return String(text ?? '').replace(/[&<>"']/g, m => map[m]);
}

/**
 * Open edit modal for course
 */
function openEditModal(course) {
  const modal = document.getElementById('edit-course-modal');
  if (!modal) {
    console.error('Edit course modal not found');
    return;
  }

  document.getElementById('edit-course-id').value = course.id;
  document.getElementById('edit-course-name').value = course.name || '';
  document.getElementById('edit-course-category').value = course.category || 'other';
  document.getElementById('edit-course-description').value = course.description || '';
  document.getElementById('edit-course-publish').checked = course.is_published_to_profile || false;

  modal.classList.add('active');
}

/**
 * Handle edit course form submission
 */
async function handleEditCourse(e) {
  e.preventDefault();

  const apiUrl = window.MENTOR_COURSES_API || '/faculty-portal/mentor/courses/data/';
  const courseId = document.getElementById('edit-course-id').value;
  const courseName = document.getElementById('edit-course-name').value.trim();
  const courseCategory = document.getElementById('edit-course-category').value;
  const courseDescription = document.getElementById('edit-course-description').value.trim();
  const isPublished = document.getElementById('edit-course-publish').checked;

  if (!courseName) {
    showStatus('Course name is required', 'error');
    return;
  }

  try {
    showStatus('Updating course...', 'info');

    const formData = new FormData();
    formData.append('action', 'update');
    formData.append('course_id', courseId);
    formData.append('name', courseName);
    formData.append('category', courseCategory);
    formData.append('description', courseDescription);
    formData.append('is_published_to_profile', isPublished ? 'on' : 'off');

    const response = await fetch(apiUrl, {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'X-Requested-With': 'XMLHttpRequest',
        'Accept': 'application/json',
        'X-CSRFToken': getCsrfToken(),
      },
      body: formData
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const text = await response.text();
      throw new Error('Expected JSON but received non-JSON response: ' + text.slice(0, 200));
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.message || 'Course update failed');
    }

    showStatus('Course updated successfully!', 'success');
    
    // Close modal and reload courses
    document.getElementById('edit-course-modal').classList.remove('active');
    await loadCourses();
    renderCourses();

  } catch (error) {
    console.error('Error updating course:', error);
    showStatus('Error updating course: ' + error.message, 'error');
  }
}

/**
 * Delete course
 */
async function deleteCourse(courseId) {
  const apiUrl = window.MENTOR_COURSES_API || '/faculty-portal/mentor/courses/data/';

  try {
    showStatus('Deleting course...', 'info');

    const formData = new FormData();
    formData.append('action', 'delete');
    formData.append('course_id', courseId);

    const response = await fetch(apiUrl, {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'X-Requested-With': 'XMLHttpRequest',
        'Accept': 'application/json',
        'X-CSRFToken': getCsrfToken(),
      },
      body: formData
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const text = await response.text();
      throw new Error('Expected JSON but received non-JSON response: ' + text.slice(0, 200));
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.message || 'Course deletion failed');
    }

    showStatus('Course deleted successfully!', 'success');
    
    // Reload courses
    await loadCourses();
    renderCourses();

  } catch (error) {
    console.error('Error deleting course:', error);
    showStatus('Error deleting course: ' + error.message, 'error');
  }
}

/**
 * Open Add Students modal
 */
function openAddStudentsModal(course) {
  const modal = document.getElementById('add-students-modal');
  if (!modal) {
    console.error('Add students modal not found');
    return;
  }

  // Store current course
  window.currentCourseForAddingStudents = course || window.currentCourseForDetailModal;

  // Get enrolled student IDs
  const enrolledIds = new Set((course.students || []).map(s => s.id));

  // Get all available students from all cohorts
  const allAvailableStudents = [];
  if (course.sections && Array.isArray(course.sections)) {
    // In a real implementation, you might fetch all students from a separate API
    // For now, we'll show a message and let the user know this needs backend support
    console.log('Sections available:', course.sections);
  }

  // Render available students list
  renderAddStudentsList(enrolledIds);

  modal.classList.add('active');
}

/**
 * Render available students in the add students modal
 */
function renderAddStudentsList(enrolledIds) {
  const listEl = document.getElementById('add-students-list');
  
  // Get all unique students from all loaded courses to show as available
  const availableStudents = [];
  const seenIds = new Set(enrolledIds);

  allCourses.forEach(course => {
    if (course.students && Array.isArray(course.students)) {
      course.students.forEach(student => {
        if (!seenIds.has(student.id)) {
          availableStudents.push(student);
          seenIds.add(student.id);
        }
      });
    }
  });

  if (availableStudents.length === 0) {
    // If no available students found from other courses, fall back to API-provided pool
    const pool = window.availableStudentsData || [];
    const poolFiltered = pool.filter(s => !seenIds.has(s.id));
    if (poolFiltered.length === 0) {
      listEl.innerHTML = '<div style="padding: 2rem; text-align: center; color: #999;">No additional students available to add</div>';
    } else {
      listEl.innerHTML = poolFiltered.map(student => `
      <label class="student-checkbox-item">
        <input type="checkbox" class="student-to-add" value="${student.id}" data-roll="${student.roll_no || ''}">
        <div class="student-checkbox-info">
          <div class="student-checkbox-name">
            <strong>${escapeHtml((student.first_name || '') + ' ' + (student.last_name || ''))}${escapeHtml(student.first_name || '') ? '' : 'Student'}</strong>
            <span>${escapeHtml(student.department || 'N/A')}</span>
          </div>
          <span class="student-checkbox-roll">${escapeHtml(student.roll_no || 'N/A')}</span>
        </div>
      </label>
    `).join('');
    }
  } else {
    listEl.innerHTML = availableStudents.map(student => `
      <label class="student-checkbox-item">
        <input type="checkbox" class="student-to-add" value="${student.id}" data-roll="${student.roll_no || ''}">
        <div class="student-checkbox-info">
          <div class="student-checkbox-name">
            <strong>${escapeHtml((student.first_name || '') + ' ' + (student.last_name || ''))}${escapeHtml(student.first_name || '') ? '' : 'Student'}</strong>
            <span>${escapeHtml(student.department || 'N/A')}</span>
          </div>
          <span class="student-checkbox-roll">${escapeHtml(student.roll_no || 'N/A')}</span>
        </div>
      </label>
    `).join('');
  }

  // Setup search functionality
  const searchEl = document.getElementById('add-students-search');
  if (searchEl) {
    searchEl.oninput = (e) => {
      const searchTerm = e.target.value.toLowerCase();
      const items = document.querySelectorAll('.student-checkbox-item');
      items.forEach(item => {
        const text = item.textContent.toLowerCase();
        item.style.display = text.includes(searchTerm) ? '' : 'none';
      });
    };
  }
}

/**
 * Add selected students to course
 */
async function handleAddStudents() {
  const course = window.currentCourseForAddingStudents;
  if (!course) {
    showStatus('No course selected', 'error');
    return;
  }

  const checkboxes = document.querySelectorAll('.student-to-add:checked');
  const selectedStudentIds = Array.from(checkboxes).map(cb => cb.value);

  if (selectedStudentIds.length === 0) {
    showStatus('Please select at least one student', 'error');
    return;
  }

  try {
    showStatus('Adding students to course...', 'info');

    // Add students to the course data (in real implementation, call backend)
    const newStudents = [];
    selectedStudentIds.forEach(id => {
      const checkbox = document.querySelector(`.student-to-add[value="${id}"]`);
      const label = checkbox.closest('.student-checkbox-item');
      const rollNo = checkbox.dataset.roll;
      // Extract name and department from label
      const nameEl = label.querySelector('.student-checkbox-name strong');
      const deptEl = label.querySelector('.student-checkbox-name span');
      
      newStudents.push({
        id: id,
        first_name: nameEl ? nameEl.textContent.split(' ')[0] : '',
        last_name: nameEl ? nameEl.textContent.split(' ').slice(1).join(' ') : '',
        roll_no: rollNo,
        department: deptEl ? deptEl.textContent : '',
        section: course.section || 'N/A',
        batch: course.batch || 'N/A'
      });
    });

    // Update course students (add new students to existing)
    if (!course.students) course.students = [];
    course.students.push(...newStudents);

    showStatus(`Successfully added ${selectedStudentIds.length} student(s) to the course!`, 'success');

    // Close modal
    document.getElementById('add-students-modal').classList.remove('active');

    // Refresh the course detail modal to show new students
    openCourseModal(course);

  } catch (error) {
    console.error('Error adding students:', error);
    showStatus('Error adding students: ' + error.message, 'error');
  }
}

/**
 * Setup event listeners for add students
 */
function setupAddStudentsListeners() {
  const btnAddStudents = document.getElementById('btn-add-students');
  if (btnAddStudents) {
    btnAddStudents.onclick = () => {
      const course = window.currentCourseForDetailModal;
      if (course) {
        openAddStudentsModal(course);
      }
    };
  }

  const btnConfirmAddStudents = document.getElementById('btn-confirm-add-students');
  if (btnConfirmAddStudents) {
    btnConfirmAddStudents.onclick = handleAddStudents;
  }
}
