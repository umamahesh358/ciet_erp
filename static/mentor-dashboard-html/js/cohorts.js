/**
 * Cohorts Management Page
 * Handles cohort display, filtering, searching, and bulk actions
 */

let allCohorts = [];
let filteredCohorts = [];
let selectedCohorts = [];
let backendCohorts = [];
let editingCohortId = null;

const DEMO_STORAGE_KEY = 'mentor-dashboard-demo-cohorts';
const COHORT_DETAIL_STORAGE_KEY = 'mentor-dashboard-cohort-details';
const STUDENT_DRAFT_STORAGE_KEY = 'mentor-dashboard-student-draft';
const DEMO_COHORT_TEMPLATE = [
  {
    id: 'demo-cohort-cse-alpha',
    name: 'CSE Alpha',
    batch: '2023-2027',
    cohort_type: 'academic',
    description: 'Core academic cohort for the CSE branch. Used to track assignments, attendance, and mentor notes.',
    is_active: true,
    is_demo: true,
    student_count: 28,
    students: buildDemoStudents('CSEA', 28, '2023-2027', 'CSE Department')
  },
  {
    id: 'demo-cohort-ai-track',
    name: 'AI Innovation Track',
    batch: '2024-2028',
    cohort_type: 'training',
    description: 'Skill-oriented cohort for students working on AI labs, projects, and guided training sessions.',
    is_active: true,
    is_demo: true,
    student_count: 18,
    students: buildDemoStudents('AIT', 18, '2024-2028', 'AI & ML Lab')
  },
  {
    id: 'demo-cohort-project-sprint',
    name: 'Project Sprint Group',
    batch: '2022-2026',
    cohort_type: 'academic',
    description: 'Focused cohort for final-year project mentoring, review meetings, and milestone tracking.',
    is_active: false,
    is_demo: true,
    student_count: 12,
    students: buildDemoStudents('PS', 12, '2022-2026', 'Project Cell')
  }
];

/**
 * Initialize cohorts page on DOM load
 */
document.addEventListener('DOMContentLoaded', function() {
  initializeCohorts();
});

/**
 * Initialize cohorts page
 */
async function initializeCohorts() {
  await loadCohorts();
  setupEventListeners();
  initializeStudentExplorer();
  renderCohorts();
}

function getDraftStudentIds() {
  try {
    const stored = localStorage.getItem(STUDENT_DRAFT_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    return [];
  }
}

function persistDraftStudentIds(ids) {
  localStorage.setItem(STUDENT_DRAFT_STORAGE_KEY, JSON.stringify(ids));
}

function isDraftStudent(studentId) {
  return getDraftStudentIds().includes(studentId);
}

function toggleStudentDraft(studentId) {
  const currentDrafts = getDraftStudentIds();
  const index = currentDrafts.indexOf(studentId);

  if (index === -1) {
    currentDrafts.push(studentId);
  } else {
    currentDrafts.splice(index, 1);
  }

  persistDraftStudentIds(currentDrafts);
  updateStudentDraftBadge();
  renderStudentExplorer();
}

function updateStudentDraftBadge() {
  const draftEl = document.getElementById('student-explorer-draft');
  if (!draftEl) {
    return;
  }
  const draftCount = getDraftStudentIds().length;
  const label = draftCount === 0 ? 'Draft' : `Draft ${draftCount}`;
  draftEl.textContent = label;
  updateDraftPanel();
}

function updateDraftPanel() {
  const draftCount = getDraftStudentIds().length;
  const draftBadge = document.getElementById('draft-badge');
  const draftSummary = document.getElementById('cohort-draft-summary');

  if (draftBadge) {
    draftBadge.textContent = String(draftCount);
  }

  if (draftSummary) {
    draftSummary.textContent = draftCount === 0
      ? 'No students selected yet. Add students from the explorer.'
      : `${draftCount} student${draftCount === 1 ? '' : 's'} selected for draft.`;
  }
}

function openStudentProfile(studentId) {
  const student = (typeof students !== 'undefined' ? students : []).find(s => s.id === studentId || s.rollNumber === studentId);
  if (!student) {
    return;
  }
  const modal = document.getElementById('student-profile-modal');
  const profileName = document.getElementById('student-profile-name');
  const profileId = document.getElementById('student-profile-id');
  const profileDepartment = document.getElementById('student-profile-department');
  const profileYear = document.getElementById('student-profile-year');
  const profileSection = document.getElementById('student-profile-section');
  const profileCgpa = document.getElementById('student-profile-cgpa');
  const profileAttendance = document.getElementById('student-profile-attendance');
  const profileTrend = document.getElementById('student-profile-trend');
  const profileSubjects = document.getElementById('student-profile-subjects');

  if (profileName) profileName.textContent = student.name || 'Unknown Student';
  if (profileId) profileId.textContent = student.rollNumber || student.id || 'Unknown ID';
  if (profileDepartment) profileDepartment.textContent = student.department || 'N/A';
  if (profileYear) profileYear.textContent = student.year || 'N/A';
  if (profileSection) profileSection.textContent = student.section || 'N/A';
  if (profileCgpa) profileCgpa.textContent = student.cgpa ? student.cgpa.toFixed(2) : 'N/A';
  if (profileAttendance) profileAttendance.textContent = student.attendance ? `${student.attendance}%` : 'N/A';
  if (profileTrend) profileTrend.textContent = getStudentSuggest(student).replace(/_/g, ' ');

  if (profileSubjects) {
    profileSubjects.innerHTML = Array.isArray(student.subjects) && student.subjects.length > 0
      ? student.subjects.map(subject => `<li>${escapeHtml(subject)}</li>`).join('')
      : '<li>No subjects listed</li>';
  }

  if (modal) {
    modal.classList.add('active');
    modal.removeAttribute('aria-hidden');
  }
}

function closeStudentProfile() {
  const modal = document.getElementById('student-profile-modal');
  if (modal) {
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
  }
}

function openDraftWorkspaceModal() {
  const modal = document.getElementById('draft-workspace-modal');
  if (modal) {
    renderDraftStudentsList();
    modal.classList.add('active');
    modal.removeAttribute('aria-hidden');
  }
}

function closeDraftWorkspaceModal() {
  const modal = document.getElementById('draft-workspace-modal');
  if (modal) {
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
  }
}

function renderDraftStudentsList() {
  const draftList = document.getElementById('draft-students-list');
  if (!draftList) {
    return;
  }

  const draftIds = getDraftStudentIds();
  const draftStudents = draftIds
    .map(id => (typeof students !== 'undefined' ? students : []).find(s => s.id === id || s.rollNumber === id))
    .filter(Boolean);

  if (draftStudents.length === 0) {
    draftList.innerHTML = '<div class="draft-empty-state" style="grid-column:1;padding:2rem;text-align:center;color:#94a3b8;">No students selected yet. Add students from the explorer.</div>';
    return;
  }

  draftList.innerHTML = draftStudents.map(student => `
    <div class="draft-student-item">
      <div class="draft-student-avatar">${escapeHtml((student.name || '').split(' ').map(p => p[0] || '').slice(0, 2).join('').toUpperCase())}</div>
      <div class="draft-student-info">
        <p class="draft-student-name">${escapeHtml(student.name || 'Unknown')}</p>
        <div class="draft-student-meta">
          ${escapeHtml(student.rollNumber || student.id || '')}<br>
          ${escapeHtml(student.year || '')} • ${escapeHtml(student.department || '')}
        </div>
      </div>
      <button type="button" class="draft-student-remove" data-student-id="${escapeHtml(student.id || student.rollNumber || '')}">×</button>
    </div>
  `).join('');

  draftList.addEventListener('click', (e) => {
    const removeBtn = e.target.closest('.draft-student-remove');
    if (removeBtn) {
      const studentId = removeBtn.dataset.studentId;
      if (studentId) {
        toggleStudentDraft(studentId);
        renderDraftStudentsList();
      }
    }
  });
}

function createCohortFromDraft() {
  const draftIds = getDraftStudentIds();
  const nameInput = document.getElementById('draft-cohort-name');
  const deptInput = document.getElementById('draft-cohort-department');
  const yearInput = document.getElementById('draft-cohort-year');
  const sectionInput = document.getElementById('draft-cohort-section');

  if (!nameInput || !deptInput || !yearInput) {
    showStatus('Please fill in all required fields', 'error');
    return;
  }

  if (draftIds.length === 0) {
    showStatus('Please add students to the draft', 'error');
    return;
  }

  const cohortName = nameInput.value.trim();
  const department = deptInput.value;
  const year = yearInput.value;
  const section = sectionInput.value || 'A';

  if (!cohortName) {
    showStatus('Cohort name is required', 'error');
    return;
  }

  const newCohort = {
    id: `cohort-${Date.now()}`,
    name: cohortName,
    batch: year,
    cohort_type: 'academic',
    description: `Created from ${draftIds.length} students`,
    is_active: true,
    is_demo: true,
    student_count: draftIds.length,
    students: draftIds.map(id => (typeof students !== 'undefined' ? students : []).find(s => s.id === id || s.rollNumber === id)).filter(Boolean)
  };

  const demoCohorts = getStoredDemoCohorts();
  demoCohorts.push(newCohort);
  persistDemoCohorts(demoCohorts);

  allCohorts.push(newCohort);
  filteredCohorts = [...allCohorts];
  renderCohorts();

  persistDraftStudentIds([]);
  updateStudentDraftBadge();
  renderStudentExplorer();
  closeDraftWorkspaceModal();

  showStatus(`Cohort "${cohortName}" created successfully with ${draftIds.length} students!`, 'success');
  setTimeout(() => {
    const statusEl = document.getElementById('status-message');
    if (statusEl) statusEl.classList.remove('show');
  }, 3000);
}

/**
 * Load cohorts from backend
 */
async function loadCohorts() {
  try {
    showStatus('Loading cohorts...', 'info');
    const response = await fetch('/faculty-portal/mentor/cohorts/data/', {
      method: 'GET',
      headers: {
        'X-Requested-With': 'XMLHttpRequest',
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    backendCohorts = data.cohorts || [];

    const storedDemoCohorts = getStoredDemoCohorts();
    const demoCohorts = storedDemoCohorts.length > 0 ? storedDemoCohorts : DEMO_COHORT_TEMPLATE;
    allCohorts = backendCohorts.length > 0 ? [...backendCohorts, ...demoCohorts] : [...demoCohorts];

    const cohortTotalEl = document.getElementById('cohort-total-count');
    if (cohortTotalEl) {
      cohortTotalEl.textContent = String(allCohorts.length);
    }
    
    // Populate batch filter
    populateBatchFilter();
    
    // Initial filter
    filteredCohorts = [...allCohorts];
    
    const loadedMessage = backendCohorts.length > 0
      ? `Loaded ${backendCohorts.length} backend cohort(s) and ${demoCohorts.length} cohort(s)`
      : `Loaded ${demoCohorts.length} cohort(s)`;
    showStatus(loadedMessage, 'success');
    setTimeout(() => {
      const statusEl = document.getElementById('status-message');
      if (statusEl) statusEl.classList.remove('show');
    }, 3000);
  } catch (error) {
    console.error('Error loading cohorts:', error);
    backendCohorts = [];
    if (getStoredDemoCohorts().length === 0) {
      persistDemoCohorts(DEMO_COHORT_TEMPLATE);
    }
    allCohorts = [...getStoredDemoCohorts()];
    filteredCohorts = [...allCohorts];
    populateBatchFilter();
    renderCohorts();
    showStatus('Backend unavailable. Loaded cohorts instead.', 'success');
  }
}

/**
 * Populate batch filter dropdown
 */
function populateBatchFilter() {
  const batchSelect = document.getElementById('filter-batch');
  if (!batchSelect) {
    return;
  }

  const batches = [...new Set(allCohorts.map(c => c.batch).filter(Boolean))].sort();

  const cohortBatchEl = document.getElementById('cohort-batch-count');
  if (cohortBatchEl) {
    cohortBatchEl.textContent = String(batches.length);
  }
  
  batches.forEach(batch => {
    const option = document.createElement('option');
    option.value = batch;
    option.textContent = batch;
    batchSelect.appendChild(option);
  });
}

/**
 * Initialize the student explorer panel
 */
function initializeStudentExplorer() {
  populateStudentExplorerFilters();
  renderStudentExplorer();
}

/**
 * Populate branch/year filters for the student explorer
 */
function populateStudentExplorerFilters() {
  const branchSelect = document.getElementById('student-explorer-branch');
  const yearSelect = document.getElementById('student-explorer-year');

  if (!branchSelect || !yearSelect || typeof students === 'undefined') {
    return;
  }

  const branches = [...new Set(students.map(student => String(student.department || '').toUpperCase()))].filter(Boolean).sort();
  const years = [...new Set(students.map(student => String(student.year || '').trim()))].filter(Boolean).sort();

  branches.forEach(branch => {
    const option = document.createElement('option');
    option.value = branch;
    option.textContent = branch;
    branchSelect.appendChild(option);
  });

  years.forEach(year => {
    const option = document.createElement('option');
    option.value = year;
    option.textContent = year;
    yearSelect.appendChild(option);
  });
}

/**
 * Render student explorer cards
 */
function renderStudentExplorer() {
  const grid = document.getElementById('student-explorer-grid');
  const countEl = document.getElementById('student-explorer-count');
  const branchSelect = document.getElementById('student-explorer-branch');
  const yearSelect = document.getElementById('student-explorer-year');
  const searchInput = document.getElementById('student-explorer-search');

  if (!grid || !countEl || typeof students === 'undefined') {
    return;
  }

  const branchFilter = branchSelect ? branchSelect.value : '';
  const yearFilter = yearSelect ? yearSelect.value : '';
  const searchQuery = searchInput ? searchInput.value.trim().toLowerCase() : '';

  const filteredStudents = students.filter(student => {
    const matchesBranch = branchFilter === '' || String(student.department || '').toUpperCase() === branchFilter;
    const matchesYear = yearFilter === '' || String(student.year || '').trim() === yearFilter;
    const matchesSearch = searchQuery === '' ||
      String(student.name || '').toLowerCase().includes(searchQuery) ||
      String(student.rollNumber || '').toLowerCase().includes(searchQuery);

    return matchesBranch && matchesYear && matchesSearch;
  });

  countEl.textContent = `${filteredStudents.length} Students`;
  updateStudentDraftBadge();

  grid.innerHTML = filteredStudents.length > 0
    ? filteredStudents.map(student => buildStudentTile(student)).join('')
    : '<div class="student-no-results">No students match the current filters.</div>';
}

/**
 * Build a student tile block
 */
function buildStudentTile(student) {
  const initials = (student.name || '').split(' ').map(part => part[0] || '').slice(0, 2).join('').toUpperCase();
  const draft = isDraftStudent(student.id || student.rollNumber || '');
  const addLabel = draft ? 'Added' : 'Add';
  const addClass = draft ? 'btn-secondary' : 'btn-outline';

  return `
    <article class="student-tile">
      <div class="student-tile-head">
        <div class="student-avatar">${escapeHtml(initials)}</div>
      </div>
      <div class="student-info">
        <p class="student-name">${escapeHtml(student.name || 'Unknown')}</p>
        <div class="student-meta">
          <span>${escapeHtml(student.rollNumber || student.id || '')}</span>
          <span>${escapeHtml(student.department || '')} ${escapeHtml(student.section || '')}</span>
          <span>${escapeHtml(student.year || '')}</span>
          <span>CGPA ${escapeHtml(String(student.cgpa || 'N/A'))}</span>
        </div>
      </div>
      <div class="student-actions">
        <button type="button" class="btn btn-sm ${addClass} student-add-btn" data-student-id="${escapeHtml(student.id || student.rollNumber || '')}">${escapeHtml(addLabel)}</button>
        <button type="button" class="btn btn-sm btn-primary student-view-profile-btn" data-student-id="${escapeHtml(student.id || student.rollNumber || '')}">View Profile</button>
      </div>
    </article>
  `;
}

/**
 * Escape HTML text
 */
function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  // Search
  const searchInput = document.getElementById('search-cohorts');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      handleSearch(e.target.value);
    });
  }

  // Filter by type
  const filterType = document.getElementById('filter-type');
  if (filterType) {
    filterType.addEventListener('change', handleFilterChange);
  }

  // Filter by batch
  const filterBatch = document.getElementById('filter-batch');
  if (filterBatch) {
    filterBatch.addEventListener('change', handleFilterChange);
  }

  // Clear filters
  const clearBtn = document.getElementById('btn-clear-filters');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      document.getElementById('search-cohorts').value = '';
      document.getElementById('filter-type').value = '';
      document.getElementById('filter-batch').value = '';
      handleFilterChange();
    });
  }

  const createDemoBtn = document.getElementById('btn-create-demo');
  if (createDemoBtn) {
    createDemoBtn.addEventListener('click', () => openCreateDemoModal());
  }

  // Export all
  const exportAllBtn = document.getElementById('btn-export-all');
  if (exportAllBtn) {
    exportAllBtn.addEventListener('click', () => exportCohorts(filteredCohorts));
  }

  // Student explorer filters
  const studentBranchSelect = document.getElementById('student-explorer-branch');
  const studentYearSelect = document.getElementById('student-explorer-year');
  const studentSearchInput = document.getElementById('student-explorer-search');

  if (studentBranchSelect) {
    studentBranchSelect.addEventListener('change', renderStudentExplorer);
  }
  if (studentYearSelect) {
    studentYearSelect.addEventListener('change', renderStudentExplorer);
  }
  if (studentSearchInput) {
    studentSearchInput.addEventListener('input', renderStudentExplorer);
  }

  const studentExplorerGrid = document.getElementById('student-explorer-grid');
  if (studentExplorerGrid) {
    studentExplorerGrid.addEventListener('click', (event) => {
      const addButton = event.target.closest('.student-add-btn');
      const viewButton = event.target.closest('.student-view-profile-btn');

      if (addButton) {
        const studentId = addButton.dataset.studentId;
        if (studentId) {
          toggleStudentDraft(studentId);
        }
      }

      if (viewButton) {
        const studentId = viewButton.dataset.studentId;
        if (studentId) {
          openStudentProfile(studentId);
        }
      }
    });
  }

  const draftButton = document.getElementById('btn-open-draft');
  if (draftButton) {
    draftButton.addEventListener('click', openDraftWorkspaceModal);
  }

  // Modal close buttons
  const modal = document.getElementById('cohort-modal');
  const createModal = document.getElementById('create-demo-modal');
  const closeBtn = document.querySelector('.modal-close');
  const closeBtnBottom = document.querySelector('.modal-close-btn');
  const demoCancelBtn = document.getElementById('btn-demo-cancel');
  const demoSaveBtn = document.getElementById('btn-demo-save');
  
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

  if (createModal) {
    const createCloseButtons = createModal.querySelectorAll('.modal-close');
    createCloseButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        resetCreateCohortForm();
        createModal.classList.remove('active');
      });
    });
  }

  if (demoCancelBtn) {
    demoCancelBtn.addEventListener('click', () => {
      if (createModal) {
        resetCreateCohortForm();
        createModal.classList.remove('active');
      }
    });
  }

  if (demoSaveBtn) {
    demoSaveBtn.addEventListener('click', createDemoCohortFromForm);
  }

  // Close modal on background click
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.remove('active');
      }
    });
  }

  if (createModal) {
    createModal.addEventListener('click', (e) => {
      if (e.target === createModal) {
        resetCreateCohortForm();
        createModal.classList.remove('active');
      }
    });
  }

  const draftWorkspaceClose = document.getElementById('draft-workspace-close');
  if (draftWorkspaceClose) {
    draftWorkspaceClose.addEventListener('click', closeDraftWorkspaceModal);
  }

  const draftWorkspaceModal = document.getElementById('draft-workspace-modal');
  if (draftWorkspaceModal) {
    draftWorkspaceModal.addEventListener('click', (e) => {
      if (e.target === draftWorkspaceModal) {
        closeDraftWorkspaceModal();
      }
    });
  }

  const clearAllDraftBtn = document.getElementById('btn-clear-all-draft');
  if (clearAllDraftBtn) {
    clearAllDraftBtn.addEventListener('click', () => {
      if (confirm('Remove all students from draft?')) {
        persistDraftStudentIds([]);
        updateStudentDraftBadge();
        renderStudentExplorer();
        renderDraftStudentsList();
      }
    });
  }

  const draftCohortForm = document.getElementById('draft-cohort-form');
  if (draftCohortForm) {
    draftCohortForm.addEventListener('submit', (e) => {
      e.preventDefault();
      createCohortFromDraft();
    });
  }

  const draftUploadArea = document.getElementById('draft-upload-area');
  const draftUploadInput = document.getElementById('draft-upload-input');
  if (draftUploadArea && draftUploadInput) {
    draftUploadArea.addEventListener('click', () => draftUploadInput.click());
    draftUploadArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      draftUploadArea.style.borderColor = '#af0c3e';
    });
    draftUploadArea.addEventListener('dragleave', () => {
      draftUploadArea.style.borderColor = '#cbd5e1';
    });
    draftUploadArea.addEventListener('drop', (e) => {
      e.preventDefault();
      draftUploadArea.style.borderColor = '#cbd5e1';
      draftUploadInput.files = e.dataTransfer.files;
    });
  }

  const studentProfileModal = document.getElementById('student-profile-modal');
  const studentProfileClose = document.getElementById('student-profile-close');

  if (studentProfileClose) {
    studentProfileClose.addEventListener('click', closeStudentProfile);
  }

  if (studentProfileModal) {
    studentProfileModal.addEventListener('click', (e) => {
      if (e.target === studentProfileModal) {
        closeStudentProfile();
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
  const searchInput = document.getElementById('search-cohorts');
  const typeInput = document.getElementById('filter-type');
  const batchInput = document.getElementById('filter-batch');

  const searchQuery = searchInput ? searchInput.value.toLowerCase() : '';
  const typeFilter = typeInput ? typeInput.value : '';
  const batchFilter = batchInput ? batchInput.value : '';

  filteredCohorts = allCohorts.filter(cohort => {
    // Search filter
    const matchesSearch = searchQuery === '' || 
      cohort.name.toLowerCase().includes(searchQuery) ||
      (cohort.description && cohort.description.toLowerCase().includes(searchQuery)) ||
      cohort.cohort_type.toLowerCase().includes(searchQuery) ||
      (cohort.batch && cohort.batch.toLowerCase().includes(searchQuery));

    // Type filter
    const matchesType = typeFilter === '' || cohort.cohort_type === typeFilter;

    // Batch filter
    const matchesBatch = batchFilter === '' || cohort.batch === batchFilter;

    return matchesSearch && matchesType && matchesBatch;
  });

  renderCohorts();
}

/**
 * Render cohorts
 */
function renderCohorts() {
  const grid = document.getElementById('cohorts-grid');
  const emptyState = document.getElementById('empty-state');
  const filteredCountEl = document.getElementById('cohort-filtered-count');

  if (filteredCountEl) {
    filteredCountEl.textContent = String(filteredCohorts.length);
  }

  if (!grid || !emptyState) {
    return;
  }

  if (filteredCohorts.length === 0) {
    grid.innerHTML = '';
    emptyState.style.display = 'block';
    return;
  }

  emptyState.style.display = 'none';
  grid.innerHTML = filteredCohorts.map(cohort => createCohortCard(cohort)).join('');

  // Add event listeners to cohort cards
  document.querySelectorAll('.cohort-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (!e.target.closest('.cohort-icon-actions') && !e.target.closest('.cohort-footer')) {
        const cohortId = card.dataset.cohortId;
        openCohortModal(allCohorts.find(c => c.id == cohortId));
      }
    });
  });

  // Add event listeners to action buttons
  document.querySelectorAll('.btn-view').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const cohortId = btn.dataset.cohortId;
      openCohortModal(allCohorts.find(c => c.id == cohortId));
    });
  });

  document.querySelectorAll('.cohort-details-link').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const cohortId = btn.dataset.cohortId;
      openCohortModal(allCohorts.find(c => c.id == cohortId));
    });
  });

  document.querySelectorAll('.btn-edit-card').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const cohortId = btn.dataset.cohortId;
      const cohort = allCohorts.find(c => c.id == cohortId);
      if (cohort) {
        openCreateDemoModal(cohort);
      }
    });
  });

  document.querySelectorAll('.btn-delete-card').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const cohortId = btn.dataset.cohortId;
      const cohort = allCohorts.find(c => c.id == cohortId);
      if (cohort && confirm(`Delete ${cohort.name}?`)) {
        deleteCohorts([cohort.id]);
      }
    });
  });
}

/**
 * Create cohort card HTML
 */
function createCohortCard(cohort) {
  const typeLabel = cohort.cohort_type === 'academic' ? 'Academic' : 'Training';
  const studentCount = cohort.student_count || cohort.students_count || 0;
  const materialCount = cohort.material_count || cohort.materials_count || (cohort.cohort_type === 'training' ? 1 : 0);
  const branch = resolveCohortBranch(cohort);
  const academicYear = resolveAcademicYearLabel(cohort.batch);
  const sections = resolveAssignedSections(cohort, branch);
  const statusDotClass = cohort.is_active ? 'cohort-dot-active' : 'cohort-dot-inactive';
  const statusChip = cohort.is_active
    ? '<span class="cohort-status-chip cohort-status-open">Open</span>'
    : '<span class="cohort-status-chip cohort-status-closed">Closed</span>';

  const sectionHtml = sections.length > 0
    ? sections.map(section => `<span class="cohort-section-tag">${escapeHtml(section)}</span>`).join('')
    : '<span class="cohort-section-tag">No sections</span>';

  return `
    <div class="cohort-card" data-cohort-id="${cohort.id}">
      <div class="cohort-card-top">
        <div class="cohort-card-name">
          <span class="cohort-dot ${statusDotClass}"></span>
          <h3 class="cohort-title">${escapeHtml(cohort.name)}</h3>
        </div>
        <div class="cohort-icon-actions">
          <button class="cohort-icon-btn btn-edit-card" type="button" data-cohort-id="${cohort.id}" aria-label="Edit cohort">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4Z"/></svg>
          </button>
          <button class="cohort-icon-btn btn-delete-card" type="button" data-cohort-id="${cohort.id}" aria-label="Delete cohort">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
          </button>
        </div>
      </div>

      <div class="cohort-metrics-grid">
        <div class="cohort-metric-item">
          <span class="cohort-metric-label">Branch</span>
          <span class="cohort-pill cohort-pill-rose">${escapeHtml(branch)}</span>
        </div>
        <div class="cohort-metric-item">
          <span class="cohort-metric-label">Academic Year</span>
          <span class="cohort-pill cohort-pill-year">${escapeHtml(academicYear)}</span>
        </div>
        <div class="cohort-metric-item">
          <span class="cohort-metric-label">Students</span>
          <span class="cohort-count-chip">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/></svg>
            ${studentCount}
          </span>
        </div>
        <div class="cohort-metric-item">
          <span class="cohort-metric-label">Materials</span>
          <span class="cohort-count-chip">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            ${materialCount}
          </span>
        </div>
      </div>

      <div class="cohort-divider"></div>

      <div class="cohort-sections-wrap">
        <span class="cohort-metric-label">Assigned Sections</span>
        <div class="cohort-sections-row">
          ${sectionHtml}
        </div>
        <div class="cohort-status-row">
          ${statusChip}
          <span class="cohort-type-chip">${typeLabel}</span>
        </div>
      </div>

      <div class="cohort-divider"></div>

      <div class="cohort-footer">
        <button class="cohort-details-link" type="button" data-cohort-id="${cohort.id}">VIEW DETAILS -></button>
      </div>
    </div>
  `;
}

function resolveCohortBranch(cohort) {
  if (cohort.branch) {
    return String(cohort.branch).toUpperCase();
  }

  const name = String(cohort.name || '').toUpperCase();
  if (name.includes('CSE')) {
    return 'CSE-AI';
  }
  if (name.includes('ECE')) {
    return 'ECE';
  }
  if (name.includes('MECH')) {
    return 'MECH';
  }
  return 'CSE-AI';
}

function resolveAcademicYearLabel(batch) {
  if (!batch || !String(batch).includes('-')) {
    return 'Year I';
  }

  const startYear = parseInt(String(batch).split('-')[0], 10);
  if (Number.isNaN(startYear)) {
    return 'Year I';
  }

  const currentYear = new Date().getFullYear();
  const yearIndex = Math.min(Math.max(currentYear - startYear + 1, 1), 4);
  return `Year ${yearIndex}`;
}

function resolveAssignedSections(cohort, branch) {
  if (Array.isArray(cohort.sections) && cohort.sections.length > 0) {
    return cohort.sections;
  }

  const normalizedBranch = branch.replace(/\s+/g, '-');
  const count = cohort.student_count || cohort.students_count || 0;
  if (count > 24) {
    return [`I-${normalizedBranch}-A`, `I-${normalizedBranch}-B`];
  }
  return [`I-${normalizedBranch}-A`];
}

function getDetailStateMap() {
  try {
    const raw = localStorage.getItem(COHORT_DETAIL_STORAGE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    console.error('Error reading cohort detail state:', error);
    return {};
  }
}

function saveDetailStateMap(map) {
  try {
    localStorage.setItem(COHORT_DETAIL_STORAGE_KEY, JSON.stringify(map));
  } catch (error) {
    console.error('Error saving cohort detail state:', error);
  }
}

function getCohortKey(cohort) {
  return String(cohort.id);
}

function ensureDetailState(cohort) {
  const map = getDetailStateMap();
  const key = getCohortKey(cohort);

  if (!map[key]) {
    map[key] = {
      description: cohort.description || 'No description yet.',
      resources: [],
      materials: [],
      isClosed: Boolean(cohort.is_active === false)
    };
    saveDetailStateMap(map);
  }

  return map[key];
}

function setDetailState(cohort, nextState) {
  const map = getDetailStateMap();
  map[getCohortKey(cohort)] = nextState;
  saveDetailStateMap(map);
}

function updateCohortActivity(cohort, isActive) {
  cohort.is_active = isActive;
  allCohorts = allCohorts.map(item => (
    String(item.id) === String(cohort.id) ? { ...item, is_active: isActive } : item
  ));
  filteredCohorts = filteredCohorts.map(item => (
    String(item.id) === String(cohort.id) ? { ...item, is_active: isActive } : item
  ));
  backendCohorts = backendCohorts.map(item => (
    String(item.id) === String(cohort.id) ? { ...item, is_active: isActive } : item
  ));

  if (String(cohort.id).startsWith('demo-')) {
    const demoCohorts = getStoredDemoCohorts().map(item => (
      String(item.id) === String(cohort.id) ? { ...item, is_active: isActive } : item
    ));
    persistDemoCohorts(demoCohorts);
  }
}

function renderDetailItemsList(container, items, emptyText) {
  if (!container) {
    return;
  }

  if (!items || items.length === 0) {
    container.innerHTML = `<p class="cohort-empty-inline">${escapeHtml(emptyText)}</p>`;
    return;
  }

  container.innerHTML = items.map(item => {
    if (item.href) {
      return `
        <div class="cohort-item-row">
          <span>${escapeHtml(item.label || item.title || 'Untitled')}</span>
          <a href="${escapeHtml(item.href)}" target="_blank" rel="noopener noreferrer">Open</a>
        </div>
      `;
    }

    return `
      <div class="cohort-item-row">
        <span>${escapeHtml(item.label || item.name || 'Document')}</span>
        <span>${escapeHtml(item.meta || 'Uploaded')}</span>
      </div>
    `;
  }).join('');
}

function renderStudentRows(container, cohort, branch, yearLabel, sections) {
  if (!container) {
    return;
  }

  const students = Array.isArray(cohort.students) ? cohort.students : [];
  if (students.length === 0) {
    container.innerHTML = '<p class="cohort-empty-inline">No students available in this cohort.</p>';
    return;
  }

  container.innerHTML = students.map((student, index) => {
    const firstName = student.first_name || 'Student';
    const lastName = student.last_name || String(index + 1);
    const fullName = `${firstName} ${lastName}`.trim();
    const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
    const rollNo = student.roll_no || `STU${String(index + 1).padStart(4, '0')}`;
    const section = sections[index % Math.max(sections.length, 1)] || 'Sec A';

    return `
      <div class="cohort-student-row">
        <div class="cohort-student-left">
          <span class="cohort-student-avatar">${escapeHtml(initials)}</span>
          <div class="cohort-student-nameblock">
            <p class="cohort-student-fullname">${escapeHtml(fullName)}</p>
            <p class="cohort-student-rollno">${escapeHtml(rollNo)}</p>
          </div>
        </div>
        <div class="cohort-student-tags">
          <span class="cohort-student-tag">${escapeHtml(yearLabel)}</span>
          <span class="cohort-student-tag">${escapeHtml(section)}</span>
          <span class="cohort-student-tag">${escapeHtml(branch)}</span>
          <span class="cohort-student-tag">CGP N/A</span>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Open cohort detail modal
 */
function openCohortModal(cohort) {
  if (!cohort) {
    return;
  }

  const modal = document.getElementById('cohort-modal');
  const titleEl = document.getElementById('modal-detail-title');
  const subLineEl = document.getElementById('modal-detail-subline');
  const departmentEl = document.getElementById('modal-cohort-department');
  const yearEl = document.getElementById('modal-cohort-year');
  const sectionCountEl = document.getElementById('modal-cohort-sections');
  const materialCountEl = document.getElementById('modal-cohort-material-count');
  const descriptionEditor = document.getElementById('modal-cohort-description-editor');
  const descriptionToggleBtn = document.getElementById('modal-description-toggle-btn');
  const materialsListEl = document.getElementById('modal-materials-list');
  const resourcesListEl = document.getElementById('modal-resources-list');
  const studentsListEl = document.getElementById('modal-students-list');
  const studentCountBadge = document.getElementById('modal-student-count-badge');
  const closeCohortBtn = document.getElementById('modal-close-cohort-btn');
  const closeBtn = document.getElementById('modal-export-btn');
  const resourceTitleInput = document.getElementById('modal-resource-title');
  const resourceUrlInput = document.getElementById('modal-resource-url');
  const resourceAddBtn = document.getElementById('modal-resource-add-btn');
  const materialUploadInput = document.getElementById('modal-material-upload-input');

  if (!modal || !titleEl || !subLineEl || !departmentEl || !yearEl || !sectionCountEl || !materialCountEl || !descriptionEditor || !descriptionToggleBtn || !materialsListEl || !resourcesListEl || !studentsListEl || !studentCountBadge || !closeCohortBtn || !closeBtn || !resourceTitleInput || !resourceUrlInput || !resourceAddBtn || !materialUploadInput) {
    return;
  }

  const detailState = ensureDetailState(cohort);
  const branch = resolveCohortBranch(cohort);
  const yearLabel = resolveAcademicYearLabel(cohort.batch);
  const sections = resolveAssignedSections(cohort, branch);
  const studentCount = cohort.student_count || cohort.students_count || (Array.isArray(cohort.students) ? cohort.students.length : 0);

  titleEl.textContent = cohort.name || 'Cohort';
  subLineEl.textContent = `${branch} • ${yearLabel} • ${studentCount} Students`;
  departmentEl.textContent = `${branch.replace('-', ' - ')}`;
  yearEl.textContent = yearLabel;
  sectionCountEl.textContent = `${sections.length} Active`;
  materialCountEl.textContent = `${detailState.materials.length} Uploaded`;
  studentCountBadge.textContent = String(studentCount);

  descriptionEditor.readOnly = true;
  descriptionEditor.value = detailState.description || cohort.description || '';
  descriptionToggleBtn.textContent = 'Edit';

  renderDetailItemsList(materialsListEl, detailState.materials, 'No study materials uploaded for this cohort yet.');
  renderDetailItemsList(resourcesListEl, detailState.resources, 'No updates/resources added yet.');
  renderStudentRows(studentsListEl, cohort, branch, yearLabel, sections);

  closeCohortBtn.textContent = cohort.is_active ? 'Close Cohort' : 'Open Cohort';
  closeCohortBtn.onclick = () => {
    const nextActive = !cohort.is_active;
    updateCohortActivity(cohort, nextActive);

    const nextState = {
      ...detailState,
      isClosed: !nextActive
    };
    setDetailState(cohort, nextState);

    closeCohortBtn.textContent = nextActive ? 'Close Cohort' : 'Open Cohort';
    showStatus(nextActive ? `${cohort.name} opened` : `${cohort.name} closed`, 'success');
    renderCohorts();
  };

  closeBtn.onclick = () => {
    modal.classList.remove('active');
  };

  descriptionToggleBtn.onclick = () => {
    if (descriptionEditor.readOnly) {
      descriptionEditor.readOnly = false;
      descriptionEditor.focus();
      descriptionToggleBtn.textContent = 'Save';
      return;
    }

    const nextState = {
      ...detailState,
      description: descriptionEditor.value.trim() || 'No description available.'
    };
    setDetailState(cohort, nextState);
    descriptionEditor.readOnly = true;
    descriptionToggleBtn.textContent = 'Edit';
    showStatus('Description updated', 'success');
  };

  resourceAddBtn.onclick = () => {
    const title = resourceTitleInput.value.trim();
    const url = resourceUrlInput.value.trim();

    if (!title || !url) {
      showStatus('Enter resource title and URL', 'error');
      return;
    }

    const nextState = {
      ...detailState,
      resources: [
        {
          label: title,
          href: url
        },
        ...detailState.resources
      ]
    };
    setDetailState(cohort, nextState);
    detailState.resources = nextState.resources;
    renderDetailItemsList(resourcesListEl, detailState.resources, 'No updates/resources added yet.');

    resourceTitleInput.value = '';
    resourceUrlInput.value = '';
    showStatus('Resource added', 'success');
  };

  materialUploadInput.onchange = () => {
    const files = Array.from(materialUploadInput.files || []);
    if (files.length === 0) {
      return;
    }

    const uploaded = files.map(file => ({
      label: file.name,
      meta: `${Math.max(1, Math.round(file.size / 1024))} KB`
    }));

    const nextState = {
      ...detailState,
      materials: [...uploaded, ...detailState.materials]
    };
    setDetailState(cohort, nextState);
    detailState.materials = nextState.materials;
    cohort.material_count = detailState.materials.length;
    cohort.materials_count = detailState.materials.length;

    allCohorts = allCohorts.map(item => (
      String(item.id) === String(cohort.id)
        ? { ...item, material_count: detailState.materials.length, materials_count: detailState.materials.length }
        : item
    ));
    filteredCohorts = filteredCohorts.map(item => (
      String(item.id) === String(cohort.id)
        ? { ...item, material_count: detailState.materials.length, materials_count: detailState.materials.length }
        : item
    ));
    backendCohorts = backendCohorts.map(item => (
      String(item.id) === String(cohort.id)
        ? { ...item, material_count: detailState.materials.length, materials_count: detailState.materials.length }
        : item
    ));

    renderDetailItemsList(materialsListEl, detailState.materials, 'No study materials uploaded for this cohort yet.');
    materialCountEl.textContent = `${detailState.materials.length} Uploaded`;
    renderCohorts();

    materialUploadInput.value = '';
    showStatus(`${uploaded.length} file(s) added`, 'success');
  };

  modal.classList.add('active');
}

function openCreateDemoModal(cohortToEdit = null) {
  const createModal = document.getElementById('create-demo-modal');
  if (!createModal) {
    return;
  }

  const nameInput = document.getElementById('demo-cohort-name');
  const typeInput = document.getElementById('demo-cohort-type');
  const branchInput = document.getElementById('demo-cohort-branch');
  const batchInput = document.getElementById('demo-cohort-batch');
  const sectionsInput = document.getElementById('demo-cohort-sections');
  const countInput = document.getElementById('demo-cohort-count');
  const materialCountInput = document.getElementById('demo-cohort-material-count');
  const descriptionInput = document.getElementById('demo-cohort-description');
  const activeInput = document.getElementById('demo-cohort-active');
  const saveBtn = document.getElementById('btn-demo-save');

  if (cohortToEdit) {
    editingCohortId = String(cohortToEdit.id);
    if (nameInput) nameInput.value = cohortToEdit.name || '';
    if (typeInput) typeInput.value = cohortToEdit.cohort_type || 'academic';
    if (branchInput) branchInput.value = cohortToEdit.branch || resolveCohortBranch(cohortToEdit);
    if (batchInput) batchInput.value = cohortToEdit.batch || '2025-2029';
    if (countInput) countInput.value = String(cohortToEdit.student_count || cohortToEdit.students_count || 1);
    if (sectionsInput) {
      const branch = cohortToEdit.branch || resolveCohortBranch(cohortToEdit);
      const sections = Array.isArray(cohortToEdit.sections) && cohortToEdit.sections.length > 0
        ? cohortToEdit.sections
        : resolveAssignedSections(cohortToEdit, branch);
      sectionsInput.value = sections.join(', ');
    }
    if (materialCountInput) materialCountInput.value = String(cohortToEdit.material_count || cohortToEdit.materials_count || 0);
    if (descriptionInput) descriptionInput.value = cohortToEdit.description || '';
    if (activeInput) activeInput.checked = Boolean(cohortToEdit.is_active);
    if (saveBtn) saveBtn.textContent = 'Update Cohort';
    createModal.classList.add('active');
    return;
  }

  editingCohortId = null;
  if (saveBtn) saveBtn.textContent = 'Save Cohort';

  if (nameInput && !nameInput.value.trim()) {
    nameInput.value = `Cohort ${allCohorts.length + 1}`;
  }
  if (typeInput && !typeInput.value) {
    typeInput.value = 'academic';
  }
  if (branchInput && !branchInput.value.trim()) {
    branchInput.value = 'CSE-AI';
  }
  if (batchInput && !batchInput.value.trim()) {
    batchInput.value = '2025-2029';
  }
  if (sectionsInput && !sectionsInput.value.trim()) {
    sectionsInput.value = 'I-CSE-AI-A';
  }
  if (countInput && !countInput.value) {
    countInput.value = '24';
  }
  if (materialCountInput && !materialCountInput.value) {
    materialCountInput.value = '0';
  }
  if (descriptionInput && !descriptionInput.value.trim()) {
    descriptionInput.value = 'Local dummy cohort used for testing mentor dashboard interactions.';
  }
  if (activeInput) {
    activeInput.checked = true;
  }

  createModal.classList.add('active');
}

function createDemoCohortFromForm() {
  const nameInput = document.getElementById('demo-cohort-name');
  const typeInput = document.getElementById('demo-cohort-type');
  const branchInput = document.getElementById('demo-cohort-branch');
  const batchInput = document.getElementById('demo-cohort-batch');
  const sectionsInput = document.getElementById('demo-cohort-sections');
  const countInput = document.getElementById('demo-cohort-count');
  const materialCountInput = document.getElementById('demo-cohort-material-count');
  const descriptionInput = document.getElementById('demo-cohort-description');
  const activeInput = document.getElementById('demo-cohort-active');
  const createModal = document.getElementById('create-demo-modal');

  const name = nameInput ? nameInput.value.trim() : '';
  const cohortType = typeInput ? typeInput.value : 'academic';
  const branch = normalizeCohortBranch(branchInput ? branchInput.value : '', name);
  const batch = batchInput ? batchInput.value.trim() : '';
  const studentCount = Math.max(parseInt(countInput ? countInput.value : '0', 10) || 0, 1);
  const materialCount = Math.max(parseInt(materialCountInput ? materialCountInput.value : '0', 10) || 0, 0);
  const sections = parseSectionList(sectionsInput ? sectionsInput.value : '', branch, studentCount);
  const description = descriptionInput ? descriptionInput.value.trim() : '';
  const isActive = activeInput ? activeInput.checked : true;

  if (!name || !batch) {
    showStatus('Cohort name and batch are required for cohort data.', 'error');
    return;
  }

  if (editingCohortId) {
    const isDemoEdit = String(editingCohortId).startsWith('demo-');
    const payload = {
      name,
      cohort_type: cohortType,
      branch,
      batch,
      sections,
      description: description || 'Cohort details updated from mentor dashboard.',
      is_active: isActive,
      student_count: studentCount,
      students_count: studentCount,
      material_count: materialCount,
      materials_count: materialCount,
      is_demo: isDemoEdit
    };

    if (isDemoEdit) {
      payload.students = buildDemoStudents(
        name.replace(/\s+/g, '').slice(0, 4).toUpperCase() || 'DEMO',
        studentCount,
        batch,
        branch.replace(/-/g, ' - ')
      );

      const demoCohorts = getStoredDemoCohorts().map(cohort => (
        String(cohort.id) === String(editingCohortId)
          ? { ...cohort, ...payload }
          : cohort
      ));
      persistDemoCohorts(demoCohorts);
    } else {
      backendCohorts = backendCohorts.map(cohort => (
        String(cohort.id) === String(editingCohortId)
          ? { ...cohort, ...payload }
          : cohort
      ));
    }

    refreshCohortCollection();
    resetCreateCohortForm();
    if (createModal) {
      createModal.classList.remove('active');
    }
    showStatus(`Updated cohort: ${name}`, 'success');
    return;
  }

  const demoCohort = {
    id: `demo-${Date.now()}`,
    name,
    batch,
    cohort_type: cohortType,
    branch,
    sections,
    description: description || 'Local dummy cohort used for testing.',
    is_active: isActive,
    is_demo: true,
    student_count: studentCount,
    students_count: studentCount,
    material_count: materialCount,
    materials_count: materialCount,
    students: buildDemoStudents(
      name.replace(/\s+/g, '').slice(0, 4).toUpperCase(),
      studentCount,
      batch,
      branch.replace(/-/g, ' - ')
    )
  };

  const demoCohorts = getStoredDemoCohorts();
  demoCohorts.unshift(demoCohort);
  persistDemoCohorts(demoCohorts);
  refreshCohortCollection();

  if (createModal) {
    createModal.classList.remove('active');
  }

  resetCreateCohortForm();

  showStatus(`Created cohort: ${name}`, 'success');
}

function resetCreateCohortForm() {
  editingCohortId = null;
  const nameInput = document.getElementById('demo-cohort-name');
  const typeInput = document.getElementById('demo-cohort-type');
  const branchInput = document.getElementById('demo-cohort-branch');
  const batchInput = document.getElementById('demo-cohort-batch');
  const sectionsInput = document.getElementById('demo-cohort-sections');
  const countInput = document.getElementById('demo-cohort-count');
  const materialCountInput = document.getElementById('demo-cohort-material-count');
  const descriptionInput = document.getElementById('demo-cohort-description');
  const activeInput = document.getElementById('demo-cohort-active');
  const saveBtn = document.getElementById('btn-demo-save');

  if (nameInput) nameInput.value = '';
  if (typeInput) typeInput.value = 'academic';
  if (branchInput) branchInput.value = 'CSE-AI';
  if (batchInput) batchInput.value = '';
  if (sectionsInput) sectionsInput.value = 'I-CSE-AI-A';
  if (countInput) countInput.value = '24';
  if (materialCountInput) materialCountInput.value = '0';
  if (descriptionInput) descriptionInput.value = '';
  if (activeInput) activeInput.checked = true;

  if (saveBtn) {
    saveBtn.textContent = 'Save Cohort';
  }
}

function refreshCohortCollection() {
  const demoCohorts = getStoredDemoCohorts();
  allCohorts = backendCohorts.length > 0 ? [...backendCohorts, ...demoCohorts] : [...demoCohorts];
  filteredCohorts = [...allCohorts];

  const cohortTotalEl = document.getElementById('cohort-total-count');
  if (cohortTotalEl) {
    cohortTotalEl.textContent = String(allCohorts.length);
  }

  const cohortBatchEl = document.getElementById('cohort-batch-count');
  if (cohortBatchEl) {
    cohortBatchEl.textContent = String([...new Set(allCohorts.map(c => c.batch).filter(Boolean))].length);
  }

  renderCohorts();
}

function normalizeCohortBranch(branch, cohortName = '') {
  const rawBranch = String(branch || '').trim();
  if (rawBranch) {
    return rawBranch.toUpperCase().replace(/\s+/g, '-');
  }

  return resolveCohortBranch({ name: cohortName || '' });
}

function parseSectionList(rawSections, branch, studentCount) {
  const parsedSections = String(rawSections || '')
    .split(',')
    .map(section => section.trim())
    .filter(Boolean);

  if (parsedSections.length > 0) {
    return parsedSections;
  }

  const fallbackCohort = { student_count: studentCount, students_count: studentCount };
  return resolveAssignedSections(fallbackCohort, branch);
}

/**
 * Export cohorts to CSV
 */
function exportCohorts(cohorts) {
  if (cohorts.length === 0) {
    showStatus('No cohorts to export', 'error');
    return;
  }

  try {
    // Prepare CSV data
    let csv = 'Cohort Name,Type,Batch,Status,Student Count,Students\n';

    cohorts.forEach(cohort => {
      const students = (cohort.students || []).map(s => s.roll_no).join('; ');
      const status = cohort.is_active ? 'Active' : 'Inactive';
      const row = [
        cohort.name,
        cohort.cohort_type === 'academic' ? 'Academic' : 'Training',
        cohort.batch || '',
        status,
        cohort.students ? cohort.students.length : 0,
        students
      ];

      csv += row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',') + '\n';
    });

    // Create download link
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cohorts-export-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    showStatus(`Exported ${cohorts.length} cohort(s) successfully`, 'success');
  } catch (error) {
    console.error('Error exporting cohorts:', error);
    showStatus('Error exporting cohorts: ' + error.message, 'error');
  }
}

/**
 * Delete cohorts
 */
async function deleteCohorts(cohortIds) {
  try {
    const demoIds = cohortIds.filter(id => String(id).startsWith('demo-'));
    const realIds = cohortIds.filter(id => !String(id).startsWith('demo-'));

    if (demoIds.length > 0) {
      const remainingDemoCohorts = getStoredDemoCohorts().filter(cohort => !demoIds.includes(String(cohort.id)));
      persistDemoCohorts(remainingDemoCohorts);
    }

    if (realIds.length === 0) {
      refreshCohortCollection();
      showStatus(`Deleted ${demoIds.length} cohort(s)`, 'success');
      return;
    }

    const response = await fetch('/faculty-portal/mentor/cohorts/', {
      method: 'POST',
      headers: {
        'X-Requested-With': 'XMLHttpRequest',
        'Content-Type': 'application/json',
        'X-CSRFToken': getCsrfToken()
      },
      body: JSON.stringify({
        action: 'delete_cohorts',
        cohort_ids: realIds
      })
    });

    const data = await response.json();
    if (data.success) {
      showStatus(data.message || 'Cohorts deleted successfully', 'success');
      refreshCohortCollection();
    } else {
      showStatus(data.message || 'Error deleting cohorts', 'error');
    }
  } catch (error) {
    console.error('Error deleting cohorts:', error);
    showStatus('Error deleting cohorts: ' + error.message, 'error');
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

function getStoredDemoCohorts() {
  try {
    const raw = localStorage.getItem(DEMO_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('Error reading cohorts:', error);
    return [];
  }
}

function persistDemoCohorts(cohorts) {
  try {
    localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(cohorts));
  } catch (error) {
    console.error('Error saving cohorts:', error);
  }
}

function buildDemoStudents(prefix, count, batch, department) {
  return Array.from({ length: count }, (_, index) => {
    const rollIndex = String(index + 1).padStart(2, '0');
    return {
      roll_no: `${prefix}${rollIndex}`,
      first_name: 'Cohort',
      last_name: `Student ${index + 1}`,
      batch,
      department
    };
  });
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
  const safeText = String(text ?? '');
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return safeText.replace(/[&<>"']/g, m => map[m]);
}
