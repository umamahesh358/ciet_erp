/**
 * Cohorts Management Page
 * Handles cohort display, filtering, searching, and bulk actions
 */

let allCohorts = [];
let filteredCohorts = [];
let selectedCohorts = [];

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
  renderCohorts();
}

/**
 * Load cohorts from backend
 */
async function loadCohorts() {
  try {
    showStatus('Loading cohorts...', 'info');
    const response = await fetch('{% url "mentor-cohorts-json" %}', {
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
    allCohorts = data.cohorts || [];
    
    // Populate batch filter
    populateBatchFilter();
    
    // Initial filter
    filteredCohorts = [...allCohorts];
    
    showStatus(`Loaded ${allCohorts.length} cohorts`, 'success');
    setTimeout(() => {
      const statusEl = document.getElementById('status-message');
      if (statusEl) statusEl.classList.remove('show');
    }, 3000);
  } catch (error) {
    console.error('Error loading cohorts:', error);
    showStatus('Error loading cohorts: ' + error.message, 'error');
  }
}

/**
 * Populate batch filter dropdown
 */
function populateBatchFilter() {
  const batchSelect = document.getElementById('filter-batch');
  const batches = [...new Set(allCohorts.map(c => c.batch).filter(Boolean))].sort();
  
  batches.forEach(batch => {
    const option = document.createElement('option');
    option.value = batch;
    option.textContent = batch;
    batchSelect.appendChild(option);
  });
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

  // Export all
  const exportAllBtn = document.getElementById('btn-export-all');
  if (exportAllBtn) {
    exportAllBtn.addEventListener('click', () => exportCohorts(filteredCohorts));
  }

  // Export selected
  const exportSelectedBtn = document.getElementById('btn-bulk-export');
  if (exportSelectedBtn) {
    exportSelectedBtn.addEventListener('click', () => {
      const selected = allCohorts.filter(c => selectedCohorts.includes(c.id));
      exportCohorts(selected);
    });
  }

  // Delete selected
  const deleteSelectedBtn = document.getElementById('btn-bulk-delete');
  if (deleteSelectedBtn) {
    deleteSelectedBtn.addEventListener('click', () => {
      if (confirm(`Delete ${selectedCohorts.length} cohort(s)? This action cannot be undone.`)) {
        deleteCohorts(selectedCohorts);
      }
    });
  }

  // Modal close buttons
  const modal = document.getElementById('cohort-modal');
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
  const searchQuery = document.getElementById('search-cohorts').value.toLowerCase();
  const typeFilter = document.getElementById('filter-type').value;
  const batchFilter = document.getElementById('filter-batch').value;

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
      if (!e.target.closest('.cohort-actions')) {
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

  document.querySelectorAll('.btn-export').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const cohortId = btn.dataset.cohortId;
      const cohort = allCohorts.find(c => c.id == cohortId);
      exportCohorts([cohort]);
    });
  });
}

/**
 * Create cohort card HTML
 */
function createCohortCard(cohort) {
  const typeLabel = cohort.cohort_type === 'academic' ? 'Academic' : 'Training';
  const typeClass = cohort.cohort_type === 'academic' ? 'badge-academic' : 'badge-training';
  const statusClass = cohort.is_active ? 'badge-active' : '';
  const studentCount = cohort.students_count || 0;
  const description = cohort.description || 'No description provided';
  const studentsList = (cohort.students || []).slice(0, 3).map(s => s.roll_no).join(', ');
  const hasMore = (cohort.students || []).length > 3;

  return `
    <div class="cohort-card" data-cohort-id="${cohort.id}">
      <div class="cohort-header">
        <h3 class="cohort-title">${escapeHtml(cohort.name)}</h3>
        <div class="cohort-badge ${typeClass}">${typeLabel}</div>
      </div>

      ${cohort.is_active ? `<div class="cohort-badge badge-active">Active</div>` : ''}

      <div class="cohort-meta">
        <div class="cohort-meta-item">
          👥 ${studentCount} students
        </div>
        ${cohort.batch ? `
          <div class="cohort-meta-item">
            📅 ${cohort.batch}
          </div>
        ` : ''}
      </div>

      <div class="cohort-description">${escapeHtml(description)}</div>

      ${studentsList ? `
        <div class="cohort-students-preview">
          <div class="students-label">Students:</div>
          <div class="students-tags">
            ${studentsList}${hasMore ? `<span class="student-tag">+${(cohort.students || []).length - 3} more</span>` : ''}
          </div>
        </div>
      ` : ''}

      <div class="cohort-actions">
        <button class="btn btn-small btn-view" data-cohort-id="${cohort.id}">
          <span>View</span>
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
        </button>
        <button class="btn btn-small btn-export" data-cohort-id="${cohort.id}">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        </button>
      </div>
    </div>
  `;
}

/**
 * Open cohort detail modal
 */
function openCohortModal(cohort) {
  const modal = document.getElementById('cohort-modal');
  const titleEl = document.getElementById('modal-cohort-title');
  const typeEl = document.getElementById('modal-cohort-type');
  const descriptionEl = document.getElementById('modal-cohort-description');
  const batchEl = document.getElementById('modal-cohort-batch');
  const statusEl = document.getElementById('modal-cohort-status');
  const countEl = document.getElementById('modal-cohort-count');
  const studentsListEl = document.getElementById('modal-students-list');
  const exportBtn = document.getElementById('modal-export-btn');

  titleEl.textContent = cohort.name;
  typeEl.textContent = cohort.cohort_type === 'academic' ? 'Academic' : 'Training';
  descriptionEl.textContent = cohort.description || 'No description';
  batchEl.textContent = cohort.batch || 'N/A';
  statusEl.innerHTML = `<span class="cohort-badge ${cohort.is_active ? 'badge-active' : ''}">${cohort.is_active ? 'Active' : 'Inactive'}</span>`;
  countEl.textContent = (cohort.students || []).length;

  // Render students
  if (cohort.students && cohort.students.length > 0) {
    studentsListEl.innerHTML = cohort.students.map(student => `
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
    studentsListEl.innerHTML = '<p style="text-align: center; color: var(--muted-foreground);">No students in this cohort</p>';
  }

  exportBtn.onclick = () => exportCohorts([cohort]);

  modal.classList.add('active');
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
    const response = await fetch('{% url "mentor-cohorts-json" %}', {
      method: 'POST',
      headers: {
        'X-Requested-With': 'XMLHttpRequest',
        'Content-Type': 'application/json',
        'X-CSRFToken': getCsrfToken()
      },
      body: JSON.stringify({
        action: 'delete_cohorts',
        cohort_ids: cohortIds
      })
    });

    const data = await response.json();
    if (data.success) {
      showStatus(data.message || 'Cohorts deleted successfully', 'success');
      selectedCohorts = [];
      loadCohorts().then(() => renderCohorts());
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
