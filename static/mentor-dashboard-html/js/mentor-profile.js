// ============================================================
// mentor-profile.js — Mentor profile editor and preview
// ============================================================

document.addEventListener("DOMContentLoaded", () => {
  const STORAGE_KEY = "mentor-dashboard-profile";

  const form = document.getElementById("mentor-profile-form");
  const resetBtn = document.getElementById("mentor-profile-reset");
  const messageEl = document.getElementById("mentor-profile-message");
  const logoutBtn = document.getElementById("mentor-profile-logout");

  const fields = {
    name: document.getElementById("mentor-name"),
    role: document.getElementById("mentor-role"),
    department: document.getElementById("mentor-department"),
    email: document.getElementById("mentor-email"),
    phone: document.getElementById("mentor-phone"),
    officeRoom: document.getElementById("mentor-office-room"),
    officeHours: document.getElementById("mentor-office-hours"),
    communication: document.getElementById("mentor-communication"),
    homeStudents: document.getElementById("mentor-home-students"),
    homeRating: document.getElementById("mentor-home-rating"),
    homeExperience: document.getElementById("mentor-home-experience"),
    homeResponse: document.getElementById("mentor-home-response"),
    bio: document.getElementById("mentor-bio"),
  };

  const pictureInput = document.getElementById("mentor-profile-picture-input");
  const pictureClear = document.getElementById("mentor-profile-picture-clear");
  const pictureName  = document.getElementById("mentor-profile-picture-name");
  const picturePreview = document.getElementById("mentor-profile-picture-preview");

  const preview = {
    avatar: document.getElementById("mentor-avatar"),
    name: document.getElementById("mentor-display-name"),
    role: document.getElementById("mentor-display-role"),
    department: document.getElementById("mentor-display-department"),
    email: document.getElementById("mentor-display-email"),
    phone: document.getElementById("mentor-display-phone"),
    officeRoom: document.getElementById("mentor-display-office-room"),
    officeHours: document.getElementById("mentor-display-office-hours"),
    communication: document.getElementById("mentor-display-communication"),
    bio: document.getElementById("mentor-display-bio"),
    updated: document.getElementById("mentor-last-updated"),
    progressText: document.getElementById("mentor-profile-progress-text"),
    progressBar: document.getElementById("mentor-profile-progress-bar"),
  };

  const defaults = {
    name: "Mentor Name",
    role: "Associate Professor",
    department: "Computer Science & Engineering",
    email: "mentor@college.edu",
    phone: "",
    officeRoom: "",
    officeHours: "",
    communication: "",
    homeStudents: "150",
    homeRating: "4.8",
    homeExperience: "8",
    homeResponse: "24hrs",
    bio: "",
    updatedAt: "",
    profilePicture: "",
  };

  function readProfile() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...defaults };

    try {
      const parsed = JSON.parse(raw);
      return {
        ...defaults,
        ...parsed,
      };
    } catch {
      return { ...defaults };
    }
  }

  function saveProfile(profile) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  }

  function initials(name) {
    const parts = (name || "").trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "M";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  function formatUpdated(value) {
    if (!value) return "Last updated: Never";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Last updated: Never";
    return `Last updated: ${date.toLocaleString([], { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}`;
  }

  function getFormValues() {
    return {
      name: fields.name.value.trim() || defaults.name,
      role: fields.role.value.trim() || defaults.role,
      department: fields.department.value.trim() || defaults.department,
      email: fields.email.value.trim() || defaults.email,
      phone: fields.phone.value.trim(),
      officeRoom: fields.officeRoom.value.trim(),
      officeHours: fields.officeHours.value.trim(),
      communication: fields.communication.value.trim(),
      homeStudents: fields.homeStudents.value.trim() || defaults.homeStudents,
      homeRating: fields.homeRating.value.trim() || defaults.homeRating,
      homeExperience: fields.homeExperience.value.trim() || defaults.homeExperience,
      homeResponse: fields.homeResponse.value.trim() || defaults.homeResponse,
      bio: fields.bio.value.trim(),
    };
  }

  function applyToForm(profile) {
    fields.name.value = profile.name || "";
    fields.role.value = profile.role || "";
    fields.department.value = profile.department || "";
    fields.email.value = profile.email || "";
    fields.phone.value = profile.phone || "";
    fields.officeRoom.value = profile.officeRoom || "";
    fields.officeHours.value = profile.officeHours || "";
    fields.communication.value = profile.communication || "";
    fields.homeStudents.value = profile.homeStudents || defaults.homeStudents;
    fields.homeRating.value = profile.homeRating || defaults.homeRating;
    fields.homeExperience.value = profile.homeExperience || defaults.homeExperience;
    fields.homeResponse.value = profile.homeResponse || defaults.homeResponse;
    fields.bio.value = profile.bio || "";
    if (pictureName) {
      pictureName.textContent = profile.profilePicture ? "Selected image" : "No file chosen";
    }
    if (picturePreview) {
      if (profile.profilePicture) {
        picturePreview.src = profile.profilePicture;
        picturePreview.style.display = "block";
      } else {
        picturePreview.removeAttribute("src");
        picturePreview.style.display = "none";
      }
    }
  }

  function profileCompleteness(profile) {
    const checks = [
      !!profile.name,
      !!profile.role,
      !!profile.department,
      !!profile.email,
      !!profile.phone,
      !!profile.officeRoom,
      !!profile.officeHours,
      !!profile.communication,
      !!profile.homeStudents,
      !!profile.homeRating,
      !!profile.homeExperience,
      !!profile.homeResponse,
      !!profile.bio,
    ];

    const completeCount = checks.filter(Boolean).length;
    return Math.round((completeCount / checks.length) * 100);
  }

  function applyToPreview(profile) {
    if (profile.profilePicture) {
      preview.avatar.innerHTML = "";
      preview.avatar.style.backgroundImage = `url('${profile.profilePicture}')`;
      preview.avatar.style.backgroundSize = "cover";
      preview.avatar.style.backgroundPosition = "center";
      preview.avatar.textContent = "";
    } else {
      preview.avatar.style.backgroundImage = "";
      preview.avatar.textContent = initials(profile.name);
    }
    preview.name.textContent = profile.name || defaults.name;
    preview.role.textContent = `${profile.role || defaults.role} • ${profile.department || defaults.department}`;
    preview.department.textContent = profile.department || "-";
    preview.email.textContent = profile.email || "-";
    preview.phone.textContent = profile.phone || "-";
    preview.officeRoom.textContent = profile.officeRoom || "-";
    preview.officeHours.textContent = profile.officeHours || "-";
    preview.communication.textContent = profile.communication || "-";
    preview.bio.textContent = profile.bio || "Add a short bio to introduce your mentoring style and focus areas.";
    preview.updated.textContent = formatUpdated(profile.updatedAt);

    const percent = profileCompleteness(profile);
    preview.progressText.textContent = `${percent}%`;
    preview.progressBar.style.width = `${percent}%`;
  }

  function renderLive() {
    const merged = {
      ...readProfile(),
      ...getFormValues(),
    };
    applyToPreview(merged);
  }

  function syncPicture(profilePicture) {
    const current = readProfile();
    const merged = { ...current, profilePicture };
    saveProfile(merged);
    applyToForm(merged);
    applyToPreview(merged);
  }

  const initial = readProfile();
  applyToForm(initial);
  applyToPreview(initial);

  Object.values(fields).forEach(input => {
    input.addEventListener("input", renderLive);
  });

  form.addEventListener("submit", e => {
    e.preventDefault();

    const payload = {
      ...getFormValues(),
      updatedAt: new Date().toISOString(),
      profilePicture: readProfile().profilePicture || "",
    };

    saveProfile(payload);
    applyToPreview(payload);
    if (messageEl) {
      messageEl.textContent = "Profile saved successfully.";
      messageEl.className = "mentor-profile-message success";
    }
  });

  resetBtn.addEventListener("click", () => {
    localStorage.removeItem(STORAGE_KEY);
    applyToForm(defaults);
    applyToPreview(defaults);
    if (messageEl) {
      messageEl.textContent = "Profile reset to defaults.";
      messageEl.className = "mentor-profile-message";
    }
  });

  // Handle profile picture input
  if (pictureInput) {
    pictureInput.addEventListener('change', e => {
      const file = e.target.files[0];
      if (!file) return;
      if (pictureName) pictureName.textContent = file.name;
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = String(reader.result ?? "");
        syncPicture(dataUrl);
      };
      reader.readAsDataURL(file);
    });
  }

  if (pictureClear) {
    pictureClear.addEventListener('click', () => {
      syncPicture("");
      if (pictureInput) pictureInput.value = "";
      if (pictureName) pictureName.textContent = "No file chosen";
      if (messageEl) {
        messageEl.textContent = "Profile picture removed.";
        messageEl.className = "mentor-profile-message";
      }
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      const theme = localStorage.getItem("mentor-theme");
      localStorage.clear();
      sessionStorage.clear();
      if (theme) localStorage.setItem("mentor-theme", theme);
      window.location.href = "/accounts/logout/";
    });
  }
});
