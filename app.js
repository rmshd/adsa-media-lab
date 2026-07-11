// ADSA Main Website - Local Server Connection
// Tailscale Funnel URL. Keep this line unchanged unless your Tailscale URL changes.
const PRINT_API_BASE = "https://desktop-skk238l.taildcd2ab.ts.net";

console.log("ADSA Server API:", PRINT_API_BASE);

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

let showAllWorks = false;
const studentWorksById = new Map();

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));
}

function formatSize(bytes = 0) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, index)).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function formatTime(ms) {
  if (!ms) return "-";
  return new Date(ms).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function formatDateOnly(value) {
  if (!value) return "-";
  const date = new Date(String(value).includes("T") ? value : `${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function getAssignmentDueState(item = {}) {
  if (!item.dueDate) return { className: "due-none", label: "No due date" };
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const due = new Date(`${item.dueDate}T00:00:00`).getTime();
  if (!Number.isFinite(due)) return { className: "due-none", label: `Due ${item.dueDate}` };
  const days = Math.round((due - today) / (24 * 60 * 60 * 1000));
  if (days < 0) return { className: "due-overdue", label: "Due date passed" };
  if (days === 0) return { className: "due-today", label: "Due today" };
  if (days === 1) return { className: "due-soon", label: "Due tomorrow" };
  if (days <= 3) return { className: "due-soon", label: `Due in ${days} days` };
  return { className: "due-normal", label: `Due ${formatDateOnly(item.dueDate)}` };
}

function approvalLabel(status = "approved") {
  const clean = String(status || "approved").toLowerCase();
  if (clean === "pending") return "Pending Review";
  if (clean === "rejected") return "Rejected";
  return "Approved";
}

function approvalClass(status = "approved") {
  const clean = String(status || "approved").toLowerCase();
  if (clean === "pending") return "status-pending";
  if (clean === "rejected") return "status-rejected";
  return "status-approved";
}


function setMessage(selector, text, isError = false) {
  const element = $(selector);
  if (!element) return;
  element.textContent = text;
  element.style.color = isError ? "#e5484d" : "#2563eb";
}

function setProgress(wrapSelector, barSelector, textSelector, percent) {
  const wrap = $(wrapSelector);
  const bar = $(barSelector);
  const text = $(textSelector);
  if (wrap) wrap.classList.remove("hidden");
  if (bar) bar.style.width = `${percent}%`;
  if (text) text.textContent = `${percent}%`;
  updateUploadWidgetFromProgress(wrapSelector, percent);
}

function hideProgress(wrapSelector, barSelector, textSelector) {
  const wrap = $(wrapSelector);
  const bar = $(barSelector);
  const text = $(textSelector);
  if (wrap) wrap.classList.add("hidden");
  if (bar) bar.style.width = "0%";
  if (text) text.textContent = "0%";
  const form = $(progressFormMap[wrapSelector]);
  const input = form?.querySelector('input[type="file"]');
  if (input) updateUploadWidgetSelection(input);
}

function uploadWithProgress({ url, formData, onProgress, headers = {} }) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener("progress", (event) => {
      if (!event.lengthComputable) return;
      const percent = Math.round((event.loaded / event.total) * 100);
      onProgress?.(percent);
    });

    xhr.addEventListener("load", () => {
      try {
        const result = JSON.parse(xhr.responseText || "{}");
        if (xhr.status >= 200 && xhr.status < 300 && result.success) {
          resolve(result);
        } else {
          reject(new Error(result.message || `Request failed (${xhr.status})`));
        }
      } catch (error) {
        reject(new Error("Server response read ചെയ്യാൻ കഴിഞ്ഞില്ല."));
      }
    });

    xhr.addEventListener("error", () => reject(new Error("Network error. Server/Tailscale running ആണോ check ചെയ്യുക.")));
    xhr.addEventListener("timeout", () => reject(new Error("Upload timeout.")));

    xhr.open("POST", url);
    Object.entries(headers).forEach(([key, value]) => xhr.setRequestHeader(key, value));
    xhr.timeout = 60 * 60 * 1000;
    xhr.send(formData);
  });
}



// -------------------- MODERN FILE UPLOAD UI --------------------
const uploadWidgetMap = new WeakMap();
const progressFormMap = {
  "#printProgressWrap": "#printUploadForm",
  "#workProgressWrap": "#workUploadForm",
  "#assetProgressWrap": "#addAssetForm",
  "#workshopProgressWrap": "#workshopSubmissionForm"
};

function getUploadTitle(input) {
  const form = input.closest("form");
  if (form?.id === "printUploadForm") return "Upload Print File";
  if (form?.id === "workUploadForm") return "Upload Creative Work";
  if (form?.id === "addAssetForm") return "Upload Asset File";
  if (form?.id === "workshopSubmissionForm") return "Upload Workshop Submission";
  return "Upload File";
}

function getUploadHint(input) {
  const form = input.closest("form");
  if (form?.id === "printUploadForm") return "PDF, Word, image, or any printable file";
  if (form?.id === "workUploadForm") return "Image, video, poster, design, or project file";
  if (form?.id === "addAssetForm") return "Fonts, PNGs, posters, ZIPs, PDFs, or design resources";
  if (form?.id === "workshopSubmissionForm") return "Poster, image, video, PDF, ZIP, or project file";
  return "Choose file or drag and drop here";
}

function getUploadWidgetForForm(form) {
  if (!form) return null;
  const input = form.querySelector('input[type="file"]');
  return input ? uploadWidgetMap.get(input) : null;
}

function setUploadWidgetState(widget, state = "idle", percent = 0, note = "") {
  if (!widget) return;
  const progress = Math.max(0, Math.min(100, Number(percent) || 0));
  const title = widget.querySelector(".upload-ui-title");
  const hint = widget.querySelector(".upload-ui-hint");
  const bar = widget.querySelector(".upload-ui-progress span");
  const percentText = widget.querySelector(".upload-ui-percent");

  widget.classList.remove("is-idle", "is-selected", "is-uploading", "is-success", "is-error", "is-dragover");
  widget.classList.add(`is-${state}`);

  if (bar) bar.style.width = `${progress}%`;
  if (percentText) percentText.textContent = `${progress}%`;

  if (state === "uploading") {
    if (title) title.textContent = "Uploading...";
    if (hint) hint.textContent = note || "Please wait while the file is being uploaded";
    return;
  }

  if (state === "success") {
    if (title) title.textContent = "Upload Completed";
    if (hint) hint.textContent = note || "File saved successfully";
    return;
  }

  if (state === "error") {
    if (title) title.textContent = "Upload Failed";
    if (hint) hint.textContent = note || "Please check server / internet and try again";
  }
}

function updateUploadWidgetSelection(input) {
  const widget = uploadWidgetMap.get(input);
  if (!widget) return;

  const file = input.files?.[0];
  const title = widget.querySelector(".upload-ui-title");
  const hint = widget.querySelector(".upload-ui-hint");
  const name = widget.querySelector(".upload-ui-file-name");
  const size = widget.querySelector(".upload-ui-file-size");
  const progress = widget.querySelector(".upload-ui-progress span");
  const percentText = widget.querySelector(".upload-ui-percent");

  widget.classList.remove("is-uploading", "is-success", "is-error", "is-dragover");

  if (file) {
    widget.classList.add("is-selected");
    widget.classList.remove("is-idle");
    if (title) title.textContent = "File Selected";
    if (hint) hint.textContent = "Ready to upload";
    if (name) name.textContent = file.name;
    if (size) size.textContent = formatSize(file.size);
  } else {
    widget.classList.add("is-idle");
    widget.classList.remove("is-selected");
    if (title) title.textContent = getUploadTitle(input);
    if (hint) hint.textContent = getUploadHint(input);
    if (name) name.textContent = "No file selected";
    if (size) size.textContent = "Click or drag file";
  }

  if (progress) progress.style.width = "0%";
  if (percentText) percentText.textContent = "0%";
}

function setupUploadWidgets() {
  $$('input[type="file"]').forEach((input) => {
    if (uploadWidgetMap.has(input)) return;

    input.classList.add("native-file-hidden");

    const widget = document.createElement("div");
    widget.className = "upload-dropzone is-idle";
    widget.setAttribute("role", "button");
    widget.setAttribute("tabindex", "0");
    widget.innerHTML = `
      <div class="upload-ui-icon" aria-hidden="true">
        <span>↑</span>
        <i></i>
      </div>
      <div class="upload-ui-copy">
        <strong class="upload-ui-title">${escapeHTML(getUploadTitle(input))}</strong>
        <small class="upload-ui-hint">${escapeHTML(getUploadHint(input))}</small>
      </div>
      <div class="upload-ui-file">
        <span class="upload-ui-file-name">No file selected</span>
        <small class="upload-ui-file-size">Click or drag file</small>
      </div>
      <div class="upload-ui-progress" aria-hidden="true"><span></span></div>
      <small class="upload-ui-percent">0%</small>
    `;

    input.insertAdjacentElement("afterend", widget);
    uploadWidgetMap.set(input, widget);

    widget.addEventListener("click", (event) => {
      event.preventDefault();
      input.click();
    });

    widget.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        input.click();
      }
    });

    ["dragenter", "dragover"].forEach((type) => {
      widget.addEventListener(type, (event) => {
        event.preventDefault();
        widget.classList.add("is-dragover");
      });
    });

    ["dragleave", "drop"].forEach((type) => {
      widget.addEventListener(type, (event) => {
        event.preventDefault();
        widget.classList.remove("is-dragover");
      });
    });

    widget.addEventListener("drop", (event) => {
      const files = event.dataTransfer?.files;
      if (!files || !files.length) return;
      try {
        input.files = files;
      } catch (error) {
        console.warn("Drag file assign failed", error);
      }
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });

    input.addEventListener("change", () => updateUploadWidgetSelection(input));
    input.closest("form")?.addEventListener("reset", () => setTimeout(() => updateUploadWidgetSelection(input), 0));
    updateUploadWidgetSelection(input);
  });
}

function updateUploadWidgetFromProgress(wrapSelector, percent) {
  const form = $(progressFormMap[wrapSelector]);
  const widget = getUploadWidgetForForm(form);
  if (!widget) return;
  const state = Number(percent) >= 100 ? "success" : "uploading";
  setUploadWidgetState(widget, state, percent, Number(percent) >= 100 ? "Upload completed successfully" : "Smooth upload animation running");
}

function markUploadWidgetError(form, message = "Upload failed") {
  const widget = getUploadWidgetForForm(form);
  if (widget) setUploadWidgetState(widget, "error", 0, message);
}

// Mobile menu
$("#menuToggle")?.addEventListener("click", () => {
  $("#mainNav")?.classList.toggle("show");
});

$$(".main-nav a").forEach((link) => {
  link.addEventListener("click", () => $("#mainNav")?.classList.remove("show"));
});

// -------------------- PRINT FILES --------------------
async function uploadPrintFile(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const formData = new FormData(form);
  const studentName = formData.get("studentName") || "";
  const batch = formData.get("batch") || formData.get("className") || "";
  const file = formData.get("file");

  if (!studentName.trim()) {
    setMessage("#printMessage", "Student name required ആണ്.", true);
    return;
  }

  if (!file || !file.size) {
    setMessage("#printMessage", "File select ചെയ്യണം.", true);
    return;
  }

  const uploadData = new FormData();
  uploadData.append("studentName", studentName.trim());
  uploadData.append("batch", batch.trim());
  uploadData.append("file", file);

  try {
    setMessage("#printMessage", "Uploading... Please wait.");
    setProgress("#printProgressWrap", "#printProgress", "#printProgressText", 0);

    await uploadWithProgress({
      url: `${PRINT_API_BASE}/api/upload-print`,
      formData: uploadData,
      onProgress: (percent) => setProgress("#printProgressWrap", "#printProgress", "#printProgressText", percent)
    });

    form.reset();
    setProgress("#printProgressWrap", "#printProgress", "#printProgressText", 100);
    setMessage("#printMessage", "Upload success. File office computer server-ൽ save ആയി. 12 hours കഴിഞ്ഞാൽ auto delete ആകും.");
    await loadPrintFiles();
    setTimeout(() => hideProgress("#printProgressWrap", "#printProgress", "#printProgressText"), 1500);
  } catch (error) {
    console.error(error);
    markUploadWidgetError(form, "Upload failed. Try again.");
    setMessage("#printMessage", `Upload failed: ${error.message}`, true);
  }
}

async function loadPrintFiles() {
  const tableBody = $("#printFilesTable");
  if (!tableBody) return;

  try {
    tableBody.innerHTML = `<tr><td colspan="4">Loading files...</td></tr>`;

    const response = await fetch(`${PRINT_API_BASE}/api/print-files`);
    const result = await response.json();

    if (!result.success) throw new Error("Files load failed");

    const files = result.files || [];

    if (!files.length) {
      tableBody.innerHTML = `<tr><td colspan="4">Uploaded print files ഒന്നും ഇല്ല.</td></tr>`;
      return;
    }

    tableBody.innerHTML = files.map((file) => `
      <tr>
        <td>
          <strong>${escapeHTML(file.studentName)}</strong><br>
          <small>${escapeHTML(file.batch || "-")}</small>
        </td>
        <td>
          ${escapeHTML(file.originalName)}<br>
          <small>${formatSize(file.size)}</small>
        </td>
        <td>${formatTime(file.uploadedAt)}</td>
        <td>
          <a class="btn ghost" href="${PRINT_API_BASE}/api/download/${file.id}" target="_blank" rel="noopener">Download</a>
        </td>
      </tr>
    `).join("");
  } catch (error) {
    console.error(error);
    tableBody.innerHTML = `<tr><td colspan="4">Files load failed. Server/Tailscale running ആണോ check ചെയ്യുക.</td></tr>`;
  }
}

// -------------------- STUDENT WORKS --------------------
async function uploadStudentWork(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const formData = new FormData(form);
  const studentName = formData.get("studentName") || "";
  const title = formData.get("title") || "";
  const software = formData.get("software") || "Other";
  const workType = formData.get("workType") || "Work";
  const file = formData.get("file");

  if (!studentName.trim()) {
    setMessage("#workMessage", "Student name required ആണ്.", true);
    return;
  }

  if (!title.trim()) {
    setMessage("#workMessage", "Work title required ആണ്.", true);
    return;
  }

  if (!file || !file.size) {
    setMessage("#workMessage", "Work file select ചെയ്യണം.", true);
    return;
  }

  const uploadData = new FormData();
  uploadData.append("studentName", studentName.trim());
  uploadData.append("title", title.trim());
  uploadData.append("software", software);
  uploadData.append("workType", workType);
  uploadData.append("file", file);

  try {
    setMessage("#workMessage", "Uploading work... Please wait.");
    setProgress("#workProgressWrap", "#workProgress", "#workProgressText", 0);

    await uploadWithProgress({
      url: `${PRINT_API_BASE}/api/upload-work`,
      formData: uploadData,
      onProgress: (percent) => setProgress("#workProgressWrap", "#workProgress", "#workProgressText", percent)
    });

    form.reset();
    setProgress("#workProgressWrap", "#workProgress", "#workProgressText", 100);
    setMessage("#workMessage", "Work upload success. Admin approve ചെയ്താൽ public gallery-ൽ കാണും.");
    await loadStudentWorks();
    await refreshWorksModalIfOpen();
    setTimeout(() => hideProgress("#workProgressWrap", "#workProgress", "#workProgressText"), 1500);
  } catch (error) {
    console.error(error);
    markUploadWidgetError(form, "Work upload failed. Try again.");
    setMessage("#workMessage", `Work upload failed: ${error.message}`, true);
  }
}

function isImageWork(work) {
  const mime = work.mimeType || "";
  return mime.startsWith("image/");
}

function isVideoWork(work) {
  const mime = work.mimeType || "";
  const name = (work.originalName || work.fileName || "").toLowerCase();
  return mime.startsWith("video/") || /\.(mp4|webm|mov|m4v)$/i.test(name);
}

function getWorkCardClass(index) {
  const classes = ["big", "small up", "tall", "small down", "wide"];
  return classes[index % classes.length];
}

function getGradientClass(index) {
  const classes = ["gradient-one", "gradient-two", "gradient-three", "gradient-four", "gradient-five"];
  return classes[index % classes.length];
}

function workPreviewHTML(work, index) {
  const label = work.workType || work.software || "Work";
  const fileUrl = `${PRINT_API_BASE}/api/work-file/${work.id}`;

  if (isImageWork(work)) {
    return `<img src="${fileUrl}" alt="${escapeHTML(work.title)}" loading="lazy">`;
  }

  if (isVideoWork(work)) {
    return `
      <video
        class="work-video-preview"
        src="${fileUrl}"
        muted
        playsinline
        preload="metadata"
        data-max-loop-seconds="60"
        aria-label="${escapeHTML(work.title)} video preview"
      ></video>
      <span class="video-duration-note">Video preview</span>
    `;
  }

  return `<span>${escapeHTML(label)}</span>`;
}

function setupVideoPreviews(scope = document) {
  const videos = scope.querySelectorAll(".work-video-preview");

  videos.forEach((video) => {
    if (video.dataset.previewReady === "true") return;
    video.dataset.previewReady = "true";

    const maxSeconds = Number(video.dataset.maxLoopSeconds || 60);

    const startPreview = () => {
      if (!Number.isFinite(video.duration)) return;

      if (video.duration > 0 && video.duration <= maxSeconds) {
        video.loop = true;
        video.muted = true;
        video.autoplay = true;
        video.play().catch(() => {
          // Browser may wait until user interaction. Muted + playsinline normally works.
        });
      } else {
        video.loop = false;
        video.pause();
        const parent = video.closest(".work-thumb");
        const note = parent?.querySelector(".video-duration-note");
        if (note) note.textContent = "Video file";
      }
    };

    video.addEventListener("loadedmetadata", startPreview, { once: true });
  });
}

function renderWorkCard(work, index, options = {}) {
  const cardClass = options.modal ? "modal-work-card" : `work-showcase-card reveal-card ${getWorkCardClass(index)} is-visible`;
  const thumbClass = isImageWork(work) ? "image-work" : isVideoWork(work) ? "video-work" : getGradientClass(index);
  const uploadTime = work.uploadedAt ? `<small>${formatTime(work.uploadedAt)}</small>` : "";

  return `
    <article class="${cardClass}">
      <button class="work-card-link" type="button" data-open-work="${escapeHTML(work.id)}" aria-label="Open ${escapeHTML(work.title)} inside website">
        <div class="work-thumb ${thumbClass}">
          ${workPreviewHTML(work, index)}
        </div>
        <div class="work-overlay">
          <strong>${escapeHTML(work.title)}</strong>
          <span>by ${escapeHTML(work.studentName)}</span>
          <small>${escapeHTML(work.software || "")} · ${escapeHTML(work.workType || "Work")} · ${formatSize(work.size)}</small>
          ${options.modal ? uploadTime : ""}
        </div>
      </button>
    </article>
  `;
}

function renderPlaceholderWorks(container) {
  const placeholders = [
    ["Poster", "Creative Poster", "by Student Name"],
    ["Logo", "Logo Concept", "by Student Name"],
    ["Render", "Blender Model", "by Student Name"],
    ["Edit", "Video Edit", "by Student Name"],
    ["UI", "Website UI", "by Student Name"]
  ];

  container.innerHTML = placeholders.map((item, index) => `
    <article class="work-showcase-card reveal-card ${getWorkCardClass(index)} is-visible">
      <div class="work-thumb ${getGradientClass(index)}">${escapeHTML(item[0])}</div>
      <div class="work-overlay">
        <strong>${escapeHTML(item[1])}</strong>
        <span>${escapeHTML(item[2])}</span>
      </div>
    </article>
  `).join("");
}

async function fetchStudentWorks(limit = null) {
  const query = limit ? `?limit=${encodeURIComponent(limit)}` : "";
  const response = await fetch(`${PRINT_API_BASE}/api/student-works${query}`);
  const result = await response.json();

  if (!result.success) throw new Error("Student works load failed");
  const works = result.works || [];
  works.forEach((work) => studentWorksById.set(work.id, work));
  return works;
}

async function loadStudentWorks() {
  const container = $("#worksGallery");
  if (!container) return;

  try {
    container.innerHTML = `<div class="works-loading">Loading student works...</div>`;
    const works = await fetchStudentWorks(5);

    if (!works.length) {
      renderPlaceholderWorks(container);
      return;
    }

    container.innerHTML = works.map((work, index) => renderWorkCard(work, index)).join("");
    setupVideoPreviews(container);
  } catch (error) {
    console.error(error);
    container.innerHTML = `<div class="works-loading">Student works load failed. Server/Tailscale check ചെയ്യുക.</div>`;
  }
}

function openWorksModal() {
  const modal = $("#worksModal");
  if (!modal) return;
  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
  loadAllWorksInModal();
}

function closeWorksModal() {
  const modal = $("#worksModal");
  if (!modal) return;
  modal.classList.add("hidden");
  modal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
}

async function loadAllWorksInModal() {
  const grid = $("#allWorksGrid");
  const count = $("#worksModalCount");
  if (!grid) return;

  try {
    grid.innerHTML = `<div class="works-loading">Loading all uploaded works...</div>`;
    const works = await fetchStudentWorks();

    if (count) {
      count.textContent = works.length ? `${works.length} uploaded works available.` : "No uploaded works yet.";
    }

    if (!works.length) {
      grid.innerHTML = `<div class="works-loading">Uploaded works ഒന്നും ഇല്ല. ആദ്യം ഒരു work upload ചെയ്യുക.</div>`;
      return;
    }

    grid.innerHTML = works.map((work, index) => renderWorkCard(work, index, { modal: true })).join("");
    setupVideoPreviews(grid);
  } catch (error) {
    console.error(error);
    grid.innerHTML = `<div class="works-loading">All works load failed. Server/Tailscale running ആണോ check ചെയ്യുക.</div>`;
  }
}

async function refreshWorksModalIfOpen() {
  const modal = $("#worksModal");
  if (!modal || modal.classList.contains("hidden")) return;
  await loadAllWorksInModal();
}

function setupWorksModal() {
  const seeAllBtn = $("#seeAllWorksBtn") || Array.from(document.querySelectorAll("a, button")).find((item) => item.textContent.trim().toLowerCase().includes("see all works"));
  if (seeAllBtn) {
    seeAllBtn.addEventListener("click", (event) => {
      event.preventDefault();
      openWorksModal();
    });
  }

  $("#closeWorksModal")?.addEventListener("click", closeWorksModal);
  document.querySelectorAll("[data-close-works-modal]").forEach((item) => {
    item.addEventListener("click", closeWorksModal);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeWorksModal();
  });
}

// -------------------- IN-SITE WORK VIEWER --------------------
function getWorkFileUrl(work) {
  return `${PRINT_API_BASE}/api/work-file/${work.id}`;
}

function getFileExtension(work) {
  const name = (work.originalName || work.fileName || "").toLowerCase();
  const match = name.match(/\.([a-z0-9]+)$/i);
  return match ? match[1] : "";
}

function isPdfWork(work) {
  const mime = work.mimeType || "";
  return mime === "application/pdf" || getFileExtension(work) === "pdf";
}

function isTextPreviewWork(work) {
  const mime = work.mimeType || "";
  const ext = getFileExtension(work);
  return mime.startsWith("text/") || ["txt", "html", "css", "js", "json", "md", "csv"].includes(ext);
}

function workMetaLine(work) {
  return [
    work.studentName ? `by ${work.studentName}` : "",
    work.software || "",
    work.workType || "Work",
    formatSize(work.size)
  ].filter(Boolean).join(" · ");
}

async function findWorkById(workId) {
  if (studentWorksById.has(workId)) return studentWorksById.get(workId);
  const works = await fetchStudentWorks();
  return works.find((work) => work.id === workId) || null;
}

async function openWorkViewer(workId) {
  const modal = $("#workViewerModal");
  const title = $("#workViewerTitle");
  const meta = $("#workViewerMeta");
  const body = $("#workViewerBody");
  if (!modal || !body) return;

  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
  body.innerHTML = `<div class="works-loading">Opening work preview...</div>`;

  try {
    const work = await findWorkById(workId);
    if (!work) throw new Error("Work not found");

    const fileUrl = getWorkFileUrl(work);
    if (title) title.textContent = work.title || work.originalName || "Student Work";
    if (meta) meta.textContent = workMetaLine(work);

    if (isImageWork(work)) {
      body.innerHTML = `<img class="work-preview-image" src="${fileUrl}" alt="${escapeHTML(work.title || work.originalName)}">`;
      return;
    }

    if (isVideoWork(work)) {
      body.innerHTML = `
        <video class="work-preview-video viewer-video" src="${fileUrl}" controls autoplay muted playsinline data-max-loop-seconds="60"></video>
      `;
      const video = body.querySelector(".viewer-video");
      video?.addEventListener("loadedmetadata", () => {
        const maxSeconds = Number(video.dataset.maxLoopSeconds || 60);
        if (Number.isFinite(video.duration) && video.duration > 0 && video.duration <= maxSeconds) {
          video.loop = true;
        }
        video.play().catch(() => {});
      }, { once: true });
      return;
    }

    if (isPdfWork(work) || isTextPreviewWork(work)) {
      body.innerHTML = `<iframe class="work-preview-frame" src="${fileUrl}" title="${escapeHTML(work.title || work.originalName)} preview"></iframe>`;
      return;
    }

    body.innerHTML = `
      <div class="work-preview-unsupported">
        <div>
          <strong>Preview not supported in browser</strong>
          <p>${escapeHTML(work.originalName || "This file")} browser-ൽ നേരിട്ട് preview ചെയ്യാൻ support ഇല്ല. PDF, image, video, text files site-നുള്ളിൽ preview ആകും.</p>
          <a class="btn blue-btn preview-open-link" href="${fileUrl}" target="_blank" rel="noopener">Open File</a>
        </div>
      </div>
    `;
  } catch (error) {
    console.error(error);
    body.innerHTML = `<div class="works-loading">Preview open ചെയ്യാൻ കഴിഞ്ഞില്ല. Server/Tailscale check ചെയ്യുക.</div>`;
  }
}

function closeWorkViewer() {
  const modal = $("#workViewerModal");
  const body = $("#workViewerBody");
  if (!modal) return;
  modal.classList.add("hidden");
  modal.setAttribute("aria-hidden", "true");
  if ($("#worksModal")?.classList.contains("hidden")) {
    document.body.classList.remove("modal-open");
  }
  if (body) body.innerHTML = `<div class="works-loading">Select a work to preview.</div>`;
}

function setupWorkViewer() {
  document.addEventListener("click", (event) => {
    const openButton = event.target.closest?.("[data-open-work]");
    if (openButton) {
      event.preventDefault();
      openWorkViewer(openButton.getAttribute("data-open-work"));
      return;
    }

    if (event.target.closest?.("[data-close-work-viewer]")) {
      event.preventDefault();
      closeWorkViewer();
    }
  });

  $("#closeWorkViewer")?.addEventListener("click", closeWorkViewer);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !$("#workViewerModal")?.classList.contains("hidden")) {
      closeWorkViewer();
    }
  });
}


// -------------------- TUTORIALS --------------------
let tutorialCache = [];
let adminTutorialCache = [];
let adminTutorialView = { access: "", category: "" };
let workshopTutorialCache = [];
let workshopTutorialView = { category: "" };

function tutorialAccessLabel(access = "public") {
  if (access === "workshop") return "Workshop Advanced Tutorials";
  return "Common Tutorials";
}

function tutorialAccessNote(access = "public") {
  if (access === "workshop") return "Only workshop student portal";
  return "Only main public website";
}

function tutorialAccessIcon(access = "public") {
  if (access === "workshop") return "🎓";
  return "🌐";
}

function countBy(items = [], getKey = () => "Other") {
  return items.reduce((acc, item) => {
    const key = getKey(item) || "Other";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function youtubeIdFromUrl(url) {
  if (!url) return "";
  const patterns = [
    /youtu\.be\/([^?&]+)/,
    /youtube\.com\/watch\?v=([^?&]+)/,
    /youtube\.com\/embed\/([^?&/]+)/,
    /youtube\.com\/shorts\/([^?&/]+)/
  ];
  for (const pattern of patterns) {
    const match = String(url).match(pattern);
    if (match && match[1]) return match[1];
  }
  try {
    return new URL(url).searchParams.get("v") || "";
  } catch {
    return "";
  }
}

function thumbnailFromYoutube(url) {
  const id = youtubeIdFromUrl(url);
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : "";
}

async function loadPublicTutorials() {
  const container = $("#publicTutorials");
  if (!container) return;

  try {
    container.innerHTML = `<div class="works-loading">Loading tutorials...</div>`;
    const response = await fetch(`${PRINT_API_BASE}/api/tutorials?access=public`);
    const result = await response.json();
    if (!result.success) throw new Error("Tutorials load failed");
    tutorialCache = result.tutorials || [];
    renderPublicTutorials();
  } catch (error) {
    console.error(error);
    container.innerHTML = `<div class="works-loading">Tutorials load failed. Server/Tailscale check ചെയ്യുക.</div>`;
  }
}


function tutorialCategoryIcon(category = "Tutorial") {
  const map = {
    Illustrator: "🎨",
    Photoshop: "🖼️",
    "Premiere Pro": "🎬",
    "InDesign": "📘",
    "After Effects": "✨",
    Blender: "🧊",
    Coding: "💻",
    "Office Apps": "📊"
  };
  return map[category] || "▶️";
}

function tutorialCategoriesFromCache(tutorials = []) {
  const preferred = ["Illustrator", "Photoshop", "Premiere Pro", "InDesign", "After Effects", "Blender", "Coding", "Office Apps"];
  const available = new Set(tutorials.map((item) => item.category || "Other"));
  return preferred.filter((cat) => available.has(cat)).concat([...available].filter((cat) => !preferred.includes(cat)));
}

function renderPublicTutorials() {
  const container = $("#publicTutorials");
  if (!container) return;
  const category = $("#tutorialCategoryFilter")?.value || "all";
  const search = ($("#tutorialSearch")?.value || "").toLowerCase().trim();

  const publicTutorials = tutorialCache.filter((item) => item.access === "public");

  if (!publicTutorials.length) {
    container.innerHTML = `
      <article class="tutorial-card demo-card reveal-card is-visible">
        <div class="tutorial-thumb blue-thumb">YT</div>
        <div class="tutorial-body">
          <div class="tag-pair"><span>Admin</span><span>Tutorials</span></div>
          <h3>Tutorial links add ചെയ്തിട്ടില്ല</h3>
          <p>Admin panel-ൽ നിന്ന് YouTube links add ചെയ്താൽ ഇവിടെ thumbnail സഹിതം കാണും.</p>
          <a href="#admin-login" class="btn mini blue-btn">Add Link</a>
        </div>
      </article>
    `;
    return;
  }

  // Default view: category folders only, so page height stays clean.
  if (category === "all" && !search) {
    const categories = tutorialCategoriesFromCache(publicTutorials);
    container.innerHTML = categories.map((cat, index) => {
      const count = publicTutorials.filter((item) => (item.category || "Other") === cat).length;
      return `
        <button class="resource-folder-card tutorial-folder-card reveal-card is-visible" type="button" data-tutorial-folder="${escapeHTML(cat)}" style="--folder-index:${index}">
          <span class="folder-3d-icon">${tutorialCategoryIcon(cat)}</span>
          <div>
            <strong>${escapeHTML(cat)}</strong>
            <small>${count} tutorial${count === 1 ? "" : "s"}</small>
          </div>
          <em>Open</em>
        </button>
      `;
    }).join("");
    return;
  }

  let tutorials = publicTutorials;
  if (category !== "all") tutorials = tutorials.filter((item) => item.category === category);
  if (search) {
    tutorials = tutorials.filter((item) => [item.title, item.category, item.level, item.language].join(" ").toLowerCase().includes(search));
  }

  if (!tutorials.length) {
    container.innerHTML = `
      <div class="resource-detail-head">
        <button class="btn mini soft" type="button" data-back-tutorial-folders>← Back to folders</button>
        <span>No tutorials found</span>
      </div>
      <article class="tutorial-card demo-card reveal-card is-visible">
        <div class="tutorial-thumb blue-thumb">YT</div>
        <div class="tutorial-body">
          <h3>No matching tutorials</h3>
          <p>Search/category മാറ്റി വീണ്ടും നോക്കുക.</p>
        </div>
      </article>
    `;
    return;
  }

  container.innerHTML = `
    <div class="resource-detail-head">
      <button class="btn mini soft" type="button" data-back-tutorial-folders>← Back to folders</button>
      <span>${escapeHTML(category === "all" ? "Search Results" : category)} · ${tutorials.length} tutorial${tutorials.length === 1 ? "" : "s"}</span>
    </div>
    ${tutorials.map((tutorial) => {
      const thumb = tutorial.thumbnail || thumbnailFromYoutube(tutorial.youtubeLink);
      return `
        <article class="tutorial-card reveal-card is-visible">
          <div class="tutorial-thumb image-thumb">
            ${thumb ? `<img src="${escapeHTML(thumb)}" alt="${escapeHTML(tutorial.title)} thumbnail" loading="lazy">` : `<span>${escapeHTML((tutorial.category || "YT").slice(0, 2))}</span>`}
          </div>
          <div class="tutorial-body">
            <div class="tag-pair"><span>${escapeHTML(tutorial.level || "Beginner")}</span><span>${escapeHTML(tutorial.language || "Malayalam")}</span></div>
            <h3>${escapeHTML(tutorial.title)}</h3>
            <p>${escapeHTML(tutorial.category || "Tutorial")}</p>
            <a href="${escapeHTML(tutorial.youtubeLink)}" target="_blank" rel="noopener" class="btn mini blue-btn">Watch</a>
          </div>
        </article>
      `;
    }).join("")}
  `;
}


$("#tutorialCategoryFilter")?.addEventListener("change", renderPublicTutorials);

$("#tutorialCategoryFilter")?.addEventListener("change", renderPublicTutorials);
$("#tutorialSearch")?.addEventListener("input", renderPublicTutorials);


// -------------------- ASSETS LIBRARY --------------------
let assetCache = [];

function assetActionUrl(asset, download = false) {
  if (asset.externalLink && !asset.savedName) return asset.externalLink;
  return `${PRINT_API_BASE}/${download ? "api/download-asset" : "api/asset-file"}/${asset.id}`;
}

function getAssetFileName(asset = {}) {
  return String(asset.originalName || asset.title || "").toLowerCase();
}

function getAssetExt(asset = {}) {
  const name = getAssetFileName(asset);
  const match = name.match(/\.([a-z0-9]+)$/i);
  return match ? match[1] : "";
}

function isAssetImage(asset = {}) {
  const ext = getAssetExt(asset);
  const type = String(asset.mimeType || asset.fileType || "").toLowerCase();
  return type.startsWith("image/") || ["jpg", "jpeg", "png", "webp", "gif", "svg"].includes(ext);
}

function isAssetVideo(asset = {}) {
  const ext = getAssetExt(asset);
  const type = String(asset.mimeType || asset.fileType || "").toLowerCase();
  return type.startsWith("video/") || ["mp4", "webm", "mov"].includes(ext);
}

function isAssetPdf(asset = {}) {
  return getAssetExt(asset) === "pdf" || String(asset.mimeType || "").includes("pdf");
}

function isAssetFont(asset = {}) {
  const ext = getAssetExt(asset);
  return asset.category === "Fonts" || asset.isFont || ["ttf", "otf", "woff", "woff2"].includes(ext);
}

function getFontDisplayName(asset = {}) {
  const rawName = asset.fontName || asset.title || asset.originalName || "Font";
  return String(rawName).replace(/\.(ttf|otf|woff2?|TTF|OTF|WOFF2?)$/, "").replace(/[_-]+/g, " ").trim() || "Font";
}

function fontsZipUrl() {
  return `${PRINT_API_BASE}/api/assets/fonts/download-zip`;
}

function setupFontDownloadLinks() {
  document.querySelectorAll("[data-fonts-zip-link]").forEach((link) => {
    link.setAttribute("href", fontsZipUrl());
    link.setAttribute("target", "_blank");
    link.setAttribute("rel", "noopener");
  });
}

function ensurePublicFontsDownloadButton() {
  const grid = $("#assetGrid");
  if (!grid) return null;
  let bar = $("#publicFontsDownloadBar");
  if (!bar) {
    bar = document.createElement("div");
    bar.id = "publicFontsDownloadBar";
    bar.className = "fonts-download-bar hidden";
    bar.innerHTML = `
      <div>
        <strong>All Fonts ZIP</strong>
        <span>Uploaded fonts എല്ലാം one click-ൽ download ചെയ്യാം.</span>
      </div>
      <a class="btn mini blue-btn" data-fonts-zip-link href="#">Download All Fonts</a>
    `;
    grid.parentNode.insertBefore(bar, grid);
  }
  setupFontDownloadLinks();
  return bar;
}

function assetShortLabel(category = "Asset") {
  const clean = String(category || "Asset").trim();
  if (clean === "Background PNGs") return "PNG";
  if (clean === "Model Posters") return "PSD";
  if (clean === "PNG Elements") return "PNG";
  if (clean === "Practice Files") return "PR";
  if (clean === "Design Models") return "MD";
  if (clean === "Fonts") return "Aa";
  return clean.slice(0, 2).toUpperCase();
}

function assetPreviewHTML(asset) {
  const previewUrl = assetActionUrl(asset, false);
  const label = escapeHTML(assetShortLabel(asset.category));
  const title = escapeHTML(asset.title || asset.originalName || "Design Asset");
  const ext = escapeHTML(getAssetExt(asset).toUpperCase() || assetShortLabel(asset.category));
  const fontFamilyName = `assetFont_${String(asset.id || "").replace(/[^a-zA-Z0-9]/g, "")}`;

  if (isAssetFont(asset) && asset.savedName) {
    const fontName = escapeHTML(getFontDisplayName(asset));
    return `
      <div class="asset-preview font-preview-card">
        <style>
          @font-face {
            font-family: '${fontFamilyName}';
            src: url('${previewUrl}');
            font-display: swap;
          }
        </style>
        <div class="font-preview-sample" style="font-family: '${fontFamilyName}', 'Anek Malayalam', 'Inter', sans-serif;">
          <em class="detected-font-name">${fontName}</em>
          <span>Aa</span>
          <strong>ADSA</strong>
          <small>മലയാളം Typography</small>
        </div>
      </div>
    `;
  }

  if (isAssetFont(asset)) {
    const fontName = escapeHTML(getFontDisplayName(asset));
    return `
      <div class="asset-preview font-preview-card">
        <div class="font-preview-sample">
          <em class="detected-font-name">${fontName}</em>
          <span>Aa</span>
          <strong>ADSA</strong>
          <small>Font Resource</small>
        </div>
      </div>
    `;
  }

  if (isAssetImage(asset) && asset.savedName) {
    return `
      <div class="asset-preview image-preview-card">
        <img src="${previewUrl}" alt="${title}" loading="lazy">
      </div>
    `;
  }

  if (isAssetVideo(asset) && asset.savedName) {
    return `
      <div class="asset-preview video-preview-card">
        <video src="${previewUrl}" muted loop autoplay playsinline preload="metadata"></video>
      </div>
    `;
  }

  if (isAssetPdf(asset) && asset.savedName) {
    return `
      <div class="asset-preview pdf-preview-card">
        <div class="file-preview-badge">PDF</div>
        <strong>${title}</strong>
        <small>Document preview</small>
      </div>
    `;
  }

  if (asset.externalLink && !asset.savedName) {
    return `
      <div class="asset-preview link-preview-card">
        <div class="file-preview-badge">↗</div>
        <strong>External Resource</strong>
        <small>Open link to view asset</small>
      </div>
    `;
  }

  return `
    <div class="asset-preview file-preview-card">
      <div class="file-preview-badge">${ext}</div>
      <strong>${label}</strong>
      <small>${escapeHTML(asset.category || "Design Asset")}</small>
    </div>
  `;
}

async function loadPublicAssets() {
  const container = $("#assetGrid");
  if (!container) return;

  try {
    container.innerHTML = `<div class="works-loading">Loading assets...</div>`;
    const response = await fetch(`${PRINT_API_BASE}/api/assets`);
    const result = await response.json();
    if (!result.success) throw new Error("Assets load failed");
    assetCache = result.assets || [];
    renderPublicAssets();
  } catch (error) {
    console.error(error);
    container.innerHTML = `<div class="works-loading">Assets load failed. Server/Tailscale check ചെയ്യുക.</div>`;
  }
}


function assetCategoryIcon(category = "Asset") {
  const map = {
    "Model Posters": "🖌️",
    "Background PNGs": "🌄",
    "Fonts": "🔤",
    "PNG Elements": "🧩",
    "Practice Files": "📦",
    "Design Models": "📐",
    "Other": "💎"
  };
  return map[category] || "📁";
}

function assetCategoriesFromCache(assets = []) {
  const preferred = ["Model Posters", "Background PNGs", "Fonts", "PNG Elements", "Practice Files", "Design Models", "Other"];
  const available = new Set(assets.map((asset) => asset.category || "Other"));
  return preferred.filter((cat) => available.has(cat)).concat([...available].filter((cat) => !preferred.includes(cat)));
}

function renderPublicAssets() {
  const container = $("#assetGrid");
  if (!container) return;

  const category = $("#assetCategoryFilter")?.value || "all";
  const search = ($("#assetSearch")?.value || "").toLowerCase().trim();
  const fontBar = ensurePublicFontsDownloadButton();
  const hasUploadedFonts = assetCache.some((asset) => isAssetFont(asset) && asset.savedName);
  if (fontBar) {
    fontBar.classList.toggle("hidden", !(hasUploadedFonts && (category === "all" || category === "Fonts")));
  }

  if (!assetCache.length) {
    container.innerHTML = `
      <article class="asset-card demo-card reveal-card is-visible">
        <div class="asset-preview empty-asset-preview">
          <div class="file-preview-badge">+</div>
          <strong>Assets add ചെയ്തിട്ടില്ല</strong>
          <small>Admin panel-ൽ നിന്ന് fonts, backgrounds, model posters add ചെയ്താൽ ഇവിടെ preview കാണും.</small>
        </div>
        <div class="asset-body">
          <span class="asset-type">Admin Assets</span>
          <h3>Design Library Empty</h3>
          <p>Admin panel-ൽ നിന്ന് useful designer resources add ചെയ്യുക.</p>
          <a href="#admin-login" class="btn mini blue-btn">Add Asset</a>
        </div>
      </article>
    `;
    return;
  }

  // Default view: special folder cards only. Items open only after category click/search.
  if (category === "all" && !search) {
    const categories = assetCategoriesFromCache(assetCache);
    container.innerHTML = categories.map((cat, index) => {
      const count = assetCache.filter((asset) => (asset.category || "Other") === cat).length;
      const fontsNote = cat === "Fonts" && hasUploadedFonts ? `<a class="btn mini blue-btn folder-zip-link" data-fonts-zip-link href="#">ZIP</a>` : "";
      return `
        <button class="resource-folder-card asset-folder-card reveal-card is-visible" type="button" data-asset-folder="${escapeHTML(cat)}" style="--folder-index:${index}">
          <span class="folder-3d-icon">${assetCategoryIcon(cat)}</span>
          <div>
            <strong>${escapeHTML(cat)}</strong>
            <small>${count} resource${count === 1 ? "" : "s"}</small>
          </div>
          <em>Open</em>
          ${fontsNote}
        </button>
      `;
    }).join("");
    setupFontDownloadLinks();
    return;
  }

  let assets = assetCache;
  if (category !== "all") assets = assets.filter((asset) => asset.category === category);
  if (search) {
    assets = assets.filter((asset) => [asset.title, asset.fontName, asset.category, asset.description, asset.originalName].join(" ").toLowerCase().includes(search));
  }

  if (!assets.length) {
    container.innerHTML = `
      <div class="resource-detail-head">
        <button class="btn mini soft" type="button" data-back-asset-folders>← Back to folders</button>
        <span>No assets found</span>
      </div>
      <article class="asset-card demo-card reveal-card is-visible">
        <div class="asset-preview empty-asset-preview">
          <div class="file-preview-badge">?</div>
          <strong>No matching assets</strong>
          <small>Search/category മാറ്റി വീണ്ടും നോക്കുക.</small>
        </div>
      </article>
    `;
    return;
  }

  container.innerHTML = `
    <div class="resource-detail-head">
      <button class="btn mini soft" type="button" data-back-asset-folders>← Back to folders</button>
      <span>${escapeHTML(category === "all" ? "Search Results" : category)} · ${assets.length} resource${assets.length === 1 ? "" : "s"}</span>
    </div>
    ${assets.map((asset) => {
      const displayTitle = isAssetFont(asset) ? getFontDisplayName(asset) : (asset.title || asset.originalName || "Design Asset");
      const downloadText = `${Number(asset.downloadCount || 0)} downloads`;
      const meta = isAssetFont(asset) && asset.fontName ? `Detected font · ${asset.size ? formatSize(asset.size) : "File"} · ${downloadText}` : `${asset.size ? formatSize(asset.size) : asset.externalLink ? "External link" : "File"} · ${downloadText}`;
      return `
        <article class="asset-card preview-asset-card reveal-card is-visible">
          ${assetPreviewHTML(asset)}
          <div class="asset-body">
            <span class="asset-type">${escapeHTML(asset.category || "Asset")}</span>
            <h3>${escapeHTML(displayTitle)}</h3>
            <p>${escapeHTML(asset.description || asset.originalName || "Useful resource for designers")}</p>
            <div class="asset-meta-line">${escapeHTML(meta)}</div>
            <div class="asset-actions">
              <a class="btn mini blue-btn" href="${assetActionUrl(asset, false)}" target="_blank" rel="noopener">Preview</a>
              <a class="btn mini soft" href="${assetActionUrl(asset, true)}" target="_blank" rel="noopener">Download</a>
            </div>
          </div>
        </article>
      `;
    }).join("")}
  `;
}


$("#assetCategoryFilter")?.addEventListener("change", renderPublicAssets);

$("#assetCategoryFilter")?.addEventListener("change", renderPublicAssets);
$("#assetSearch")?.addEventListener("input", renderPublicAssets);

// -------------------- ADMIN PANEL --------------------
function isAdminPage() {
  return document.body?.dataset?.page === "admin";
}

function openAdminPanelTab() {
  const adminUrl = "admin.html";
  window.open(adminUrl, "_blank");
}

const ADMIN_TOKEN_KEY = "adsa_admin_token";

function getAdminToken() {
  return localStorage.getItem(ADMIN_TOKEN_KEY) || "";
}

function setAdminToken(token) {
  if (token) localStorage.setItem(ADMIN_TOKEN_KEY, token);
  else localStorage.removeItem(ADMIN_TOKEN_KEY);
}

async function adminFetch(path, options = {}) {
  const headers = {
    ...(options.headers || {}),
    Authorization: `Bearer ${getAdminToken()}`
  };

  const response = await fetch(`${PRINT_API_BASE}${path}`, { ...options, headers });
  const result = await response.json().catch(() => ({}));

  if (!response.ok || !result.success) {
    throw new Error(result.message || `Admin request failed (${response.status})`);
  }

  return result;
}

function showAdminDashboard(show) {
  $("#adminDashboard")?.classList.toggle("hidden", !show);
  // Main site has only login form. Admin page hides login after successful session.
  if (isAdminPage()) {
    $("#adminLoginForm")?.classList.toggle("hidden", show);
  }
}

async function adminLogin(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);
  const username = String(formData.get("username") || formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");

  try {
    setMessage("#adminLoginMessage", "Logging in...");
    const response = await fetch(`${PRINT_API_BASE}/api/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });
    const result = await response.json();
    if (!response.ok || !result.success) throw new Error(result.message || "Login failed");
    setAdminToken(result.token);
    form.reset();

    if (!isAdminPage()) {
      setMessage("#adminLoginMessage", "Login success. Admin panel പുതിയ tab-ൽ open ചെയ്യുന്നു...");
      openAdminPanelTab();
      return;
    }

    setMessage("#adminLoginMessage", "Login success.");
    showAdminDashboard(true);
    await loadAdminPanelData();
  } catch (error) {
    console.error(error);
    setMessage("#adminLoginMessage", error.message || "Login failed", true);
  }
}

function adminLogout() {
  setAdminToken("");
  showAdminDashboard(false);
  setMessage("#adminLoginMessage", "Logged out.");
}

async function checkExistingAdminSession() {
  // Main website should not show admin dashboard. It only opens admin.html after login.
  if (!isAdminPage()) return;

  if (!getAdminToken()) {
    showAdminDashboard(false);
    return;
  }

  try {
    await adminFetch("/api/admin/me");
    showAdminDashboard(true);
    await loadAdminPanelData();
  } catch {
    setAdminToken("");
    showAdminDashboard(false);
  }
}

async function loadAdminPanelData() {
  await Promise.allSettled([
    loadAdminDashboardStats(),
    loadAdminPrintFiles(),
    loadAdminStudentWorks(),
    loadAdminTutorials(),
    loadAdminAssets(),
    loadAdminWorkshopStudents(),
    loadAdminWorkshopAssignments(),
    loadAdminWorkshopSubmissions(),
    loadAdminAttendanceClasses(),
    loadAdminCertificates(),
    loadAdminAnnouncements()
  ]);
}

async function loadAdminDashboardStats() {
  try {
    const result = await adminFetch("/api/admin/dashboard");
    const s = result.stats || {};
    if ($("#statTodayPrints")) $("#statTodayPrints").textContent = s.todaysPrintUploads ?? 0;
    if ($("#statStudentWorks")) $("#statStudentWorks").textContent = s.totalStudentWorks ?? 0;
    if ($("#statTutorials")) $("#statTutorials").textContent = s.totalTutorials ?? 0;
    if ($("#statAssets")) $("#statAssets").textContent = s.totalAssets ?? 0;
    if ($("#statWorkshopStudents")) $("#statWorkshopStudents").textContent = s.totalWorkshopStudents ?? 0;
    if ($("#statWorkshopSubmissions")) $("#statWorkshopSubmissions").textContent = s.totalWorkshopSubmissions ?? 0;
    if ($("#statUnreviewedSubmissions")) $("#statUnreviewedSubmissions").textContent = s.unreviewedWorkshopSubmissions ?? 0;
    if ($("#statAssignments")) $("#statAssignments").textContent = s.activeAssignments ?? 0;
    if ($("#statAttendanceClasses")) $("#statAttendanceClasses").textContent = s.attendanceClasses ?? 0;
    if ($("#statCertificates")) $("#statCertificates").textContent = s.certificateEligible ?? 0;
    if ($("#statAnnouncements")) $("#statAnnouncements").textContent = s.activeAnnouncements ?? 0;
    if ($("#statStorageUsed")) $("#statStorageUsed").textContent = formatSize(s.totalUploadStorageBytes || 0);
  } catch (error) {
    console.error(error);
  }
}

async function loadAdminPrintFiles() {
  const box = $("#printAdminList");
  if (!box) return;
  try {
    box.innerHTML = `<div class="list-item">Loading print files...</div>`;
    const result = await adminFetch("/api/admin/print-files");
    const files = result.files || [];
    if (!files.length) {
      box.innerHTML = `<div class="list-item">Current print files ഒന്നുമില്ല.</div>`;
      return;
    }
    box.innerHTML = files.map((file) => `
      <div class="list-item admin-file-item">
        <div>
          <strong>${escapeHTML(file.studentName)}</strong>
          <span>${escapeHTML(file.batch || "-")} · ${escapeHTML(file.originalName)} · ${formatSize(file.size)}</span>
          <small>Uploaded: ${formatTime(file.uploadedAt)} · Expires: ${formatTime(file.expiresAt)}</small>
        </div>
        <div class="list-actions">
          <a class="btn mini blue-btn" href="${PRINT_API_BASE}/api/download/${file.id}" target="_blank" rel="noopener">Open</a>
          <button class="btn mini danger-btn" type="button" data-admin-delete-print="${file.id}">Delete</button>
        </div>
      </div>
    `).join("");
  } catch (error) {
    console.error(error);
    box.innerHTML = `<div class="list-item">Print files load failed: ${escapeHTML(error.message)}</div>`;
  }
}

async function loadAdminStudentWorks() {
  const box = $("#studentWorksAdminList");
  if (!box) return;
  try {
    box.innerHTML = `<div class="list-item">Loading student works...</div>`;
    const result = await adminFetch("/api/admin/student-works");
    const works = result.works || [];
    if (!works.length) {
      box.innerHTML = `<div class="list-item">Student works ഒന്നുമില്ല.</div>`;
      return;
    }
    box.innerHTML = works.map((work) => {
      const status = work.status || "approved";
      return `
      <div class="list-item admin-file-item work-approval-item ${approvalClass(status)}">
        <div>
          <div class="inline-status-row">
            <strong>${escapeHTML(work.title)}</strong>
            <span class="status-badge ${approvalClass(status)}">${escapeHTML(approvalLabel(status))}</span>
          </div>
          <span>${escapeHTML(work.studentName)} · ${escapeHTML(work.software || "-")} · ${escapeHTML(work.workType || "Work")} · ${formatSize(work.size)}</span>
          <small>${work.featured ? "Featured on home" : "Not featured"} · ${formatTime(work.uploadedAt)}</small>
        </div>
        <div class="list-actions">
          <button class="btn mini blue-btn" type="button" data-open-work="${work.id}">Preview</button>
          <button class="btn mini success-btn" type="button" data-admin-approve-work="${work.id}" data-status="approved">Approve</button>
          <button class="btn mini warning-btn" type="button" data-admin-approve-work="${work.id}" data-status="pending">Pending</button>
          <button class="btn mini soft" type="button" data-admin-feature-work="${work.id}" data-featured="${work.featured ? "false" : "true"}" ${status !== "approved" ? "disabled" : ""}>${work.featured ? "Unfeature" : "Feature"}</button>
          <button class="btn mini danger-btn" type="button" data-admin-approve-work="${work.id}" data-status="rejected">Reject</button>
          <button class="btn mini danger-btn" type="button" data-admin-delete-work="${work.id}">Delete</button>
        </div>
      </div>`;
    }).join("");
  } catch (error) {
    console.error(error);
    box.innerHTML = `<div class="list-item">Student works load failed: ${escapeHTML(error.message)}</div>`;
  }
}

async function addAdminAnnouncement(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const payload = Object.fromEntries(new FormData(form).entries());
  try {
    setMessage("#announcementAdminMessage", "Publishing announcement...");
    await adminFetch("/api/admin/workshop-announcements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    form.reset();
    const category = form.querySelector('[name="category"]');
    if (category) category.value = "All Categories";
    setMessage("#announcementAdminMessage", "Announcement published. Student notification bell-ൽ 24 hours കാണും.");
    await loadAdminAnnouncements();
    await loadAdminDashboardStats();
  } catch (error) {
    console.error(error);
    setMessage("#announcementAdminMessage", error.message || "Announcement add failed", true);
  }
}

async function loadAdminAnnouncements() {
  const box = $("#announcementAdminList");
  if (!box) return;
  try {
    box.innerHTML = `<div class="list-item">Loading announcements...</div>`;
    const result = await adminFetch("/api/admin/workshop-announcements");
    const announcements = result.announcements || [];
    if (!announcements.length) {
      box.innerHTML = `<div class="list-item">Announcements ഒന്നുമില്ല.</div>`;
      return;
    }
    box.innerHTML = announcements.map((item) => `
      <div class="list-item admin-file-item announcement-admin-item">
        <div>
          <strong>${escapeHTML(item.title || "Announcement")}</strong>
          <span>${escapeHTML(item.category || "All Categories")} · expires after 24 hours</span>
          <small>${escapeHTML(item.message || "")} · ${formatTime(item.createdAt)}</small>
        </div>
        <div class="list-actions">
          <button class="btn mini danger-btn" type="button" data-admin-delete-announcement="${item.id}">Delete</button>
        </div>
      </div>
    `).join("");
  } catch (error) {
    console.error(error);
    box.innerHTML = `<div class="list-item">Announcements load failed: ${escapeHTML(error.message)}</div>`;
  }
}

async function addTutorial(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);
  const payload = Object.fromEntries(formData.entries());

  try {
    setMessage("#tutorialAdminMessage", "Adding tutorial...");
    await adminFetch("/api/admin/tutorials", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    form.reset();
    const lang = form.querySelector('[name="language"]');
    const workshop = form.querySelector('[name="workshopId"]');
    if (lang) lang.value = "Malayalam";
    if (workshop) workshop.value = "illustrator-2026";
    setMessage("#tutorialAdminMessage", "Tutorial added.");
    await loadAdminTutorials();
    await loadPublicTutorials();
    await loadAdminDashboardStats();
  } catch (error) {
    console.error(error);
    setMessage("#tutorialAdminMessage", error.message || "Tutorial add failed", true);
  }
}

function renderAdminTutorialFolders() {
  const box = $("#tutorialAdminList");
  if (!box) return;

  const tutorials = adminTutorialCache.filter((item) => item.status !== "deleted");
  if (!tutorials.length) {
    box.innerHTML = `<div class="list-item">Tutorial links ഒന്നുമില്ല.</div>`;
    return;
  }

  const selectedAccess = adminTutorialView.access;
  const selectedCategory = adminTutorialView.category;

  if (!selectedAccess) {
    const grouped = countBy(tutorials, (item) => item.access === "workshop" ? "workshop" : "public");
    const order = ["public", "workshop"];
    box.innerHTML = `
      <div class="folder-view-head">
        <strong>Tutorial folders</strong>
        <small>Common and Workshop tutorials separate folders ആയി കാണിക്കും.</small>
      </div>
      <div class="resource-folder-grid admin-folder-grid">
        ${order.map((access, index) => `
          <button class="resource-folder-card tutorial-folder-card admin-tutorial-access-folder reveal-card is-visible" type="button" data-admin-tutorial-access="${escapeHTML(access)}" style="--folder-index:${index}">
            <span class="folder-3d-icon">${tutorialAccessIcon(access)}</span>
            <span class="folder-copy">
              <strong>${escapeHTML(tutorialAccessLabel(access))}</strong>
              <small>${grouped[access] || 0} tutorial${(grouped[access] || 0) === 1 ? "" : "s"}</small>
              <em>${escapeHTML(tutorialAccessNote(access))}</em>
            </span>
          </button>
        `).join("")}
      </div>
    `;
    return;
  }

  const accessTutorials = tutorials.filter((item) => (selectedAccess === "workshop" ? item.access === "workshop" : item.access !== "workshop"));

  if (!selectedCategory) {
    const grouped = countBy(accessTutorials, (item) => item.category || "Other");
    const categories = Object.keys(grouped).sort((a, b) => a.localeCompare(b));
    box.innerHTML = `
      <div class="folder-view-head">
        <button class="btn mini soft" type="button" data-admin-back-tutorial-root>← Back</button>
        <div><strong>${escapeHTML(tutorialAccessLabel(selectedAccess))}</strong><small>${accessTutorials.length} tutorials</small></div>
      </div>
      ${categories.length ? `<div class="resource-folder-grid admin-folder-grid">
        ${categories.map((category, index) => `
          <button class="resource-folder-card tutorial-folder-card admin-tutorial-category-folder reveal-card is-visible" type="button" data-admin-tutorial-category="${escapeHTML(category)}" style="--folder-index:${index}">
            <span class="folder-3d-icon">${tutorialCategoryIcon(category)}</span>
            <span class="folder-copy"><strong>${escapeHTML(category)}</strong><small>${grouped[category]} tutorial${grouped[category] === 1 ? "" : "s"}</small></span>
          </button>
        `).join("")}
      </div>` : `<div class="list-item">ഈ folder-ൽ tutorials ഇല്ല.</div>`}
    `;
    return;
  }

  const categoryTutorials = accessTutorials.filter((item) => (item.category || "Other") === selectedCategory);
  box.innerHTML = `
    <div class="folder-view-head">
      <button class="btn mini soft" type="button" data-admin-back-tutorial-categories>← Categories</button>
      <div><strong>${escapeHTML(selectedCategory)}</strong><small>${categoryTutorials.length} tutorials</small></div>
    </div>
    <div class="admin-tutorial-card-grid">
      ${categoryTutorials.map((tutorial) => {
        const thumb = tutorial.thumbnail || thumbnailFromYoutube(tutorial.youtubeLink);
        return `
          <article class="tutorial-card admin-tutorial-card reveal-card is-visible">
            <div class="tutorial-thumb image-thumb">
              ${thumb ? `<img src="${escapeHTML(thumb)}" alt="${escapeHTML(tutorial.title || "Tutorial")} thumbnail" loading="lazy">` : `<span>YT</span>`}
            </div>
            <div class="tutorial-body">
              <div class="tag-pair"><span>${escapeHTML(tutorial.level || "Beginner")}</span><span>${escapeHTML(tutorial.language || "Malayalam")}</span></div>
              <h3>${escapeHTML(tutorial.title || "Tutorial")}</h3>
              <p>${escapeHTML(tutorialAccessLabel(tutorial.access))}</p>
              <div class="list-actions">
                <a class="btn mini blue-btn" href="${escapeHTML(tutorial.youtubeLink || "#")}" target="_blank" rel="noopener">Watch</a>
                <button class="btn mini danger-btn" type="button" data-admin-delete-tutorial="${escapeHTML(tutorial.id)}">Delete</button>
              </div>
            </div>
          </article>
        `;
      }).join("")}
    </div>
  `;
}

async function loadAdminTutorials() {
  const box = $("#tutorialAdminList");
  if (!box) return;
  try {
    box.innerHTML = `<div class="list-item">Loading tutorial folders...</div>`;
    const result = await adminFetch("/api/admin/tutorials");
    adminTutorialCache = result.tutorials || [];
    renderAdminTutorialFolders();
  } catch (error) {
    console.error(error);
    box.innerHTML = `<div class="list-item">Tutorials load failed: ${escapeHTML(error.message)}</div>`;
  }
}


async function addAsset(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);
  const file = formData.get("file");
  const externalLink = String(formData.get("externalLink") || "").trim();

  if ((!file || !file.size) && !externalLink) {
    setMessage("#assetAdminMessage", "Asset file അല്ലെങ്കിൽ external link add ചെയ്യണം.", true);
    return;
  }

  try {
    setMessage("#assetAdminMessage", "Adding asset...");
    setProgress("#assetProgressWrap", "#assetProgress", "#assetProgressText", 0);

    await uploadWithProgress({
      url: `${PRINT_API_BASE}/api/admin/assets`,
      formData,
      headers: { Authorization: `Bearer ${getAdminToken()}` },
      onProgress: (percent) => setProgress("#assetProgressWrap", "#assetProgress", "#assetProgressText", percent)
    });

    form.reset();
    setProgress("#assetProgressWrap", "#assetProgress", "#assetProgressText", 100);
    setMessage("#assetAdminMessage", "Asset added.");
    await loadAdminAssets();
    await loadPublicAssets();
    await loadAdminDashboardStats();
    setTimeout(() => hideProgress("#assetProgressWrap", "#assetProgress", "#assetProgressText"), 1200);
  } catch (error) {
    console.error(error);
    markUploadWidgetError(form, "Asset upload failed. Try again.");
    setMessage("#assetAdminMessage", error.message || "Asset add failed", true);
  }
}

async function loadAdminAssets() {
  const box = $("#assetAdminList");
  if (!box) return;
  try {
    box.innerHTML = `<div class="list-item">Loading assets...</div>`;
    const result = await adminFetch("/api/admin/assets");
    const assets = result.assets || [];
    if (!assets.length) {
      box.innerHTML = `<div class="list-item">Assets ഒന്നുമില്ല.</div>`;
      return;
    }

    box.innerHTML = assets.map((asset) => `
      <div class="list-item admin-file-item">
        <div>
          <strong>${escapeHTML(isAssetFont(asset) ? getFontDisplayName(asset) : asset.title)}</strong>
          <span>${escapeHTML(asset.category || "Asset")} · ${asset.size ? formatSize(asset.size) : "External link"} · ${Number(asset.downloadCount || 0)} downloads</span>
          <small>${escapeHTML(asset.fontName ? `Font name: ${asset.fontName}` : (asset.originalName || asset.externalLink || ""))} · ${formatTime(asset.createdAt)}</small>
        </div>
        <div class="list-actions">
          <a class="btn mini blue-btn" href="${assetActionUrl(asset, false)}" target="_blank" rel="noopener">Open</a>
          <button class="btn mini danger-btn" type="button" data-admin-delete-asset="${asset.id}">Delete</button>
        </div>
      </div>
    `).join("");
  } catch (error) {
    console.error(error);
    box.innerHTML = `<div class="list-item">Assets load failed: ${escapeHTML(error.message)}</div>`;
  }
}

async function handleAdminActions(event) {
  const printId = event.target.closest?.("[data-admin-delete-print]")?.getAttribute("data-admin-delete-print");
  if (printId) {
    if (!confirm("ഈ print file delete ചെയ്യണോ?")) return;
    await adminFetch(`/api/admin/print-files/${printId}`, { method: "DELETE" });
    await loadPrintFiles();
    await loadAdminPrintFiles();
    await loadAdminDashboardStats();
    return;
  }

  const workDeleteId = event.target.closest?.("[data-admin-delete-work]")?.getAttribute("data-admin-delete-work");
  if (workDeleteId) {
    if (!confirm("ഈ student work delete ചെയ്യണോ?")) return;
    await adminFetch(`/api/admin/student-works/${workDeleteId}`, { method: "DELETE" });
    await loadStudentWorks();
    await refreshWorksModalIfOpen();
    await loadAdminStudentWorks();
    await loadAdminDashboardStats();
    return;
  }

  const approvalBtn = event.target.closest?.("[data-admin-approve-work]");
  if (approvalBtn) {
    const workId = approvalBtn.getAttribute("data-admin-approve-work");
    const status = approvalBtn.getAttribute("data-status") || "approved";
    await adminFetch(`/api/admin/student-works/${workId}/approval`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status })
    });
    await loadStudentWorks();
    await refreshWorksModalIfOpen();
    await loadAdminStudentWorks();
    await loadAdminDashboardStats();
    return;
  }

  const featureBtn = event.target.closest?.("[data-admin-feature-work]");
  if (featureBtn) {
    const workId = featureBtn.getAttribute("data-admin-feature-work");
    const featured = featureBtn.getAttribute("data-featured") === "true";
    await adminFetch(`/api/admin/student-works/${workId}/featured`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ featured })
    });
    await loadStudentWorks();
    await refreshWorksModalIfOpen();
    await loadAdminStudentWorks();
    return;
  }

  const assetId = event.target.closest?.("[data-admin-delete-asset]")?.getAttribute("data-admin-delete-asset");
  if (assetId) {
    if (!confirm("ഈ asset delete ചെയ്യണോ?")) return;
    await adminFetch(`/api/admin/assets/${assetId}`, { method: "DELETE" });
    await loadAdminAssets();
    await loadPublicAssets();
    await loadAdminDashboardStats();
    return;
  }

  const announcementId = event.target.closest?.("[data-admin-delete-announcement]")?.getAttribute("data-admin-delete-announcement");
  if (announcementId) {
    if (!confirm("ഈ announcement delete ചെയ്യണോ?")) return;
    await adminFetch(`/api/admin/workshop-announcements/${announcementId}`, { method: "DELETE" });
    await loadAdminAnnouncements();
    await loadAdminDashboardStats();
    return;
  }

  const tutorialId = event.target.closest?.("[data-admin-delete-tutorial]")?.getAttribute("data-admin-delete-tutorial");
  if (tutorialId) {
    if (!confirm("ഈ tutorial delete ചെയ്യണോ?")) return;
    await adminFetch(`/api/admin/tutorials/${tutorialId}`, { method: "DELETE" });
    await loadAdminTutorials();
    await loadPublicTutorials();
    await loadAdminDashboardStats();
  }
}



// -------------------- WORKSHOP PORTAL --------------------
const WORKSHOP_TOKEN_KEY = "adsa_workshop_token";
let workshopDashboardCache = null;

function isWorkshopPage() {
  return document.body?.dataset?.page === "workshop";
}

function getWorkshopToken() {
  return localStorage.getItem(WORKSHOP_TOKEN_KEY) || "";
}

function setWorkshopToken(token) {
  if (token) localStorage.setItem(WORKSHOP_TOKEN_KEY, token);
  else localStorage.removeItem(WORKSHOP_TOKEN_KEY);
}

async function workshopFetch(path, options = {}) {
  const headers = {
    ...(options.headers || {}),
    Authorization: `Bearer ${getWorkshopToken()}`
  };
  const response = await fetch(`${PRINT_API_BASE}${path}`, { ...options, headers });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.success) throw new Error(result.message || `Workshop request failed (${response.status})`);
  return result;
}

function showWorkshopDashboard(show) {
  $("#workshop-dashboard")?.classList.toggle("hidden", !show);
  $("#workshopLoginForm")?.classList.toggle("hidden", show);
  $(".workshop-login-shell")?.classList.toggle("logged-in", show);
}

function statusLabel(status = "submitted") {
  const map = {
    submitted: "Submitted",
    reviewed: "Reviewed",
    "need-correction": "Need Correction",
    approved: "Approved",
    present: "Present",
    absent: "Absent",
    late: "Late",
    excused: "Excused",
    "not-marked": "Not Marked"
  };
  return map[status] || status;
}

function statusBadge(status = "submitted") {
  const clean = String(status || "submitted").toLowerCase();
  return `<span class="status-pill status-${escapeHTML(clean)}">${escapeHTML(statusLabel(clean))}</span>`;
}

function timeAgo(ms) {
  if (!ms) return "Just now";
  const diff = Math.max(0, Date.now() - Number(ms));
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hr ago`;
  return formatTime(ms);
}

const WORKSHOP_CATEGORIES = [
  "Creative Graphic Design",
  "Video Editing & Motion",
  "Web Coding & Development",
  "Photo & Video Production"
];

function workshopCategoryLabel(value = "") {
  const clean = String(value || "").trim();
  if (!clean || clean === "Design Workshop") return "Creative Graphic Design";
  return clean;
}

function attendanceShortLabel(status = "not-marked") {
  const map = { present: "P", absent: "A", late: "L", excused: "E", "not-marked": "" };
  return map[status] ?? "";
}

let attendancePageIndex = 0;
const ATTENDANCE_PAGE_SIZE = 30;
let attendanceRegisterCache = { classes: [], students: [] };
let adminWorkshopStudentsCache = [];
let adminCertificateStudentsCache = [];
let adminWorkshopSubmissionsCache = [];

async function workshopLogin(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);
  const studentId = String(formData.get("studentId") || "").trim().toUpperCase();
  const password = String(formData.get("password") || "");
  try {
    setMessage("#workshopLoginMessage", "Logging in...");
    const response = await fetch(`${PRINT_API_BASE}/api/workshop/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId, password })
    });
    const result = await response.json();
    if (!response.ok || !result.success) throw new Error(result.message || "Login failed");
    setWorkshopToken(result.token);
    form.reset();
    setMessage("#workshopLoginMessage", "Login success.");
    showWorkshopDashboard(true);
    await loadWorkshopPanelData(result.student);
    document.querySelector("#workshop-dashboard")?.scrollIntoView({ behavior: "smooth" });
  } catch (error) {
    console.error(error);
    setMessage("#workshopLoginMessage", error.message || "Login failed", true);
  }
}

async function checkExistingWorkshopSession() {
  if (!isWorkshopPage()) return;
  if (!getWorkshopToken()) {
    showWorkshopDashboard(false);
    return;
  }
  try {
    const result = await workshopFetch("/api/workshop/me");
    showWorkshopDashboard(true);
    await loadWorkshopPanelData(result.student);
  } catch {
    setWorkshopToken("");
    showWorkshopDashboard(false);
  }
}

function logoutWorkshop() {
  setWorkshopToken("");
  showWorkshopDashboard(false);
  setMessage("#workshopLoginMessage", "Logged out.");
}

async function loadWorkshopPanelData(student = null) {
  try {
    const result = await workshopFetch("/api/workshop/dashboard");
    workshopDashboardCache = result;
    renderWorkshopStudentProfile(result.student || student);
    renderWorkshopProgress(result.progress || {});
    renderWorkshopAssignments(result.assignments || []);
    renderMyWorkshopSubmissions(result.submissions || []);
    renderWorkshopAttendance(result.attendance || []);
    renderWorkshopLeaderboard(result.leaderboard || []);
    renderWorkshopNotifications(result.notifications || []);
    renderWorkshopCertificate(result.certificate || {});
    await loadWorkshopTutorials();
  } catch (error) {
    console.error(error);
    setMessage("#workshopSubmitMessage", `Dashboard load failed: ${error.message}`, true);
  }
}

function renderWorkshopStudentProfile(student = {}) {
  if ($("#workshopWelcomeTitle")) $("#workshopWelcomeTitle").textContent = `Welcome, ${student.name || student.studentId || "Student"}`;
  if ($("#workshopStudentMeta")) $("#workshopStudentMeta").textContent = `${student.studentId || ""} · ${student.batch || "Workshop Batch"} · ${workshopCategoryLabel(student.category || student.skill)}`;
  const box = $("#workshopProfileCard");
  if (box) {
    box.innerHTML = `
      <div class="profile-avatar">${escapeHTML((student.name || student.studentId || "A").slice(0, 1).toUpperCase())}</div>
      <div>
        <span>Student Profile</span>
        <strong>${escapeHTML(student.name || "Student")}</strong>
        <small>${escapeHTML(student.studentId || "")} · ${escapeHTML(student.batch || "Batch not set")} · ${escapeHTML(workshopCategoryLabel(student.category || student.skill))}</small>
      </div>
    `;
  }
}

function renderWorkshopProgress(progress = {}) {
  const cards = [
    ["Total Submissions", progress.totalSubmissions ?? 0],
    ["Reviewed Works", progress.reviewedWorks ?? 0],
    ["Approved Works", progress.approvedWorks ?? 0],
    ["Average Mark", `${progress.averageMark ?? 0}%`],
    ["Attendance", `${progress.attendancePercent ?? 0}%`]
  ];
  const box = $("#workshopProgressCards");
  if (!box) return;
  box.innerHTML = cards.map(([label, value]) => `
    <div class="student-progress-card">
      <span>${escapeHTML(label)}</span>
      <strong>${escapeHTML(value)}</strong>
    </div>
  `).join("");
}

function renderWorkshopAssignments(assignments = []) {
  const list = $("#workshopAssignmentList");
  const select = $("#workshopAssignmentSelect");
  const filter = $("#workshopCategoryFilter")?.value || "all";
  const filteredAssignments = filter === "all" ? assignments : assignments.filter((item) => workshopCategoryLabel(item.category) === filter);

  if (select) {
    select.innerHTML = `<option value="">Select active assignment</option>` + assignments.map((item) => `
      <option value="${escapeHTML(item.id)}" data-title="${escapeHTML(item.title)}">${escapeHTML(item.title)}${item.dueDate ? ` · ${escapeHTML(item.dueDate)}` : ""}</option>
    `).join("");
  }
  if (!list) return;
  if (!filteredAssignments.length) {
    list.innerHTML = `<div class="list-item">ഈ category-ൽ active assignments ഇല്ല. Admin add ചെയ്താൽ ഇവിടെ കാണും.</div>`;
    return;
  }
  list.innerHTML = filteredAssignments.map((item) => {
    const due = getAssignmentDueState(item);
    return `
    <div class="assignment-card category-assignment-card ${escapeHTML(due.className)}">
      <div class="assignment-category-chip">${escapeHTML(workshopCategoryLabel(item.category))}</div>
      <div>
        <div class="inline-status-row"><strong>${escapeHTML(item.title)}</strong><span class="due-badge ${escapeHTML(due.className)}">${escapeHTML(due.label)}</span></div>
        <p>${escapeHTML(item.description || "No description")}</p>
        <small>Due: ${escapeHTML(item.dueDate || "Not set")} · Max mark: ${escapeHTML(item.maxMark || 100)} · ${escapeHTML(item.allowedFileTypes || "Any file")}</small>
      </div>
    </div>`;
  }).join("");
}

function renderWorkshopTutorialFolders() {
  const box = $("#workshopTutorialList");
  if (!box) return;

  // Student portal: only tutorials added as Workshop Advanced Tutorial.
  const tutorials = workshopTutorialCache.filter((item) => item.access === "workshop" || !item.access);
  const selectedCategory = workshopTutorialView.category;

  if (!tutorials.length) {
    box.innerHTML = `<div class="works-loading">Workshop Advanced tutorials admin add ചെയ്തിട്ടില്ല.</div>`;
    return;
  }

  if (!selectedCategory) {
    const grouped = countBy(tutorials, (item) => item.category || "Other");
    const categories = Object.keys(grouped).sort((a, b) => a.localeCompare(b));
    box.innerHTML = `
      <div class="folder-view-head workshop-folder-head">
        <strong>Workshop Tutorial Folders</strong>
        <small>Admin added Workshop Advanced tutorials മാത്രം ഇവിടെ കാണും.</small>
      </div>
      <div class="resource-folder-grid workshop-tutorial-folder-grid">
        ${categories.map((category, index) => `
          <button class="resource-folder-card tutorial-folder-card workshop-tutorial-folder reveal-card is-visible" type="button" data-workshop-tutorial-folder="${escapeHTML(category)}" style="--folder-index:${index}">
            <span class="folder-3d-icon">${tutorialCategoryIcon(category)}</span>
            <span class="folder-copy"><strong>${escapeHTML(category)}</strong><small>${grouped[category]} tutorial${grouped[category] === 1 ? "" : "s"}</small></span>
          </button>
        `).join("")}
      </div>
    `;
    return;
  }

  const filtered = tutorials.filter((item) => (item.category || "Other") === selectedCategory);
  box.innerHTML = `
    <div class="folder-view-head workshop-folder-head">
      <button class="btn mini soft" type="button" data-back-workshop-tutorial-folders>← Back to folders</button>
      <div><strong>${escapeHTML(selectedCategory)}</strong><small>${filtered.length} tutorial${filtered.length === 1 ? "" : "s"}</small></div>
    </div>
    <div class="tutorial-card-grid compact-tutorial-grid">
      ${filtered.map((tutorial) => `
        <article class="tutorial-card reveal-card is-visible">
          <div class="tutorial-thumb image-thumb">
            ${tutorial.thumbnail ? `<img src="${escapeHTML(tutorial.thumbnail)}" alt="${escapeHTML(tutorial.title || "Tutorial")}" loading="lazy">` : `<span>YT</span>`}
          </div>
          <div class="tutorial-body">
            <div class="tag-pair"><span>${escapeHTML(tutorial.category || "Workshop")}</span><span>${escapeHTML(tutorial.level || "Learning")}</span></div>
            <h3>${escapeHTML(tutorial.title || "Tutorial")}</h3>
            <p>${escapeHTML(tutorial.language || "Malayalam")}</p>
            <a class="btn mini blue-btn" href="${escapeHTML(tutorial.youtubeLink || "#")}" target="_blank" rel="noopener">Watch</a>
          </div>
        </article>
      `).join("")}
    </div>
  `;
}

async function loadWorkshopTutorials() {
  const box = $("#workshopTutorialList");
  if (!box) return;
  try {
    box.innerHTML = `<div class="works-loading">Loading tutorial folders...</div>`;
    const result = await workshopFetch("/api/workshop/tutorials");
    workshopTutorialCache = (result.tutorials || []).filter((item) => item.access === "workshop" || !item.access);
    workshopTutorialView.category = "";
    renderWorkshopTutorialFolders();
  } catch (error) {
    console.error(error);
    box.innerHTML = `<div class="works-loading">Tutorials load failed: ${escapeHTML(error.message)}</div>`;
  }
}

async function submitWorkshopAssignment(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);
  const select = $("#workshopAssignmentSelect");
  if (select && select.value) {
    const title = select.options[select.selectedIndex]?.dataset?.title || select.options[select.selectedIndex]?.textContent || "";
    formData.set("assignmentTitle", title.split(" · ")[0]);
  }
  if (!formData.get("file")) {
    setMessage("#workshopSubmitMessage", "File select ചെയ്യണം.", true);
    return;
  }
  if (!formData.get("assignmentId") && !String(formData.get("assignmentTitle") || "").trim()) {
    setMessage("#workshopSubmitMessage", "Assignment select/title വേണം.", true);
    return;
  }
  try {
    setMessage("#workshopSubmitMessage", "Uploading submission...");
    setProgress("#workshopProgressWrap", "#workshopProgress", "#workshopProgressText", 0);
    await uploadWithProgress({
      url: `${PRINT_API_BASE}/api/workshop/submit`,
      formData,
      headers: { Authorization: `Bearer ${getWorkshopToken()}` },
      onProgress: (percent) => setProgress("#workshopProgressWrap", "#workshopProgress", "#workshopProgressText", percent)
    });
    form.reset();
    setProgress("#workshopProgressWrap", "#workshopProgress", "#workshopProgressText", 100);
    setMessage("#workshopSubmitMessage", "Submission uploaded successfully.");
    setUploadWidgetState(getUploadWidgetForForm(form), "success", 100, "Submission uploaded successfully");
    await loadWorkshopPanelData();
    setTimeout(() => hideProgress("#workshopProgressWrap", "#workshopProgress", "#workshopProgressText"), 1200);
  } catch (error) {
    console.error(error);
    setUploadWidgetState(getUploadWidgetForForm(form), "error", 0, error.message);
    setMessage("#workshopSubmitMessage", error.message || "Submission failed", true);
  }
}

function renderMyWorkshopSubmissions(submissions = []) {
  const box = $("#myWorkshopSubmissionList");
  if (!box) return;
  if (!submissions.length) {
    box.innerHTML = `<div class="list-item">ഇതുവരെ submissions ഇല്ല.</div>`;
    return;
  }
  box.innerHTML = submissions.map((item) => `
    <div class="list-item admin-file-item submission-feedback-card">
      <div>
        <strong>${escapeHTML(item.assignmentTitle || "Workshop submission")}</strong>
        <span>${escapeHTML(item.originalName || "File")} · ${item.size ? formatSize(item.size) : "File"}</span>
        <small>${formatTime(item.createdAt)} · ${statusBadge(item.reviewStatus || item.status)}</small>
        <div class="student-feedback-box">
          <b>Mark:</b> ${item.mark !== "" && item.mark !== undefined ? `${escapeHTML(item.mark)} / ${escapeHTML(item.maxMark || 100)}` : "Not marked yet"}<br>
          <b>Feedback:</b> ${escapeHTML(item.feedback || "Feedback pending")}
        </div>
      </div>
      <div class="list-actions">
        <a class="btn mini blue-btn" href="${PRINT_API_BASE}/api/workshop/submission-file/${item.id}" target="_blank" rel="noopener">Open</a>
      </div>
    </div>
  `).join("");
}

async function loadMyWorkshopSubmissions() {
  try {
    const result = await workshopFetch("/api/workshop/my-submissions");
    renderMyWorkshopSubmissions(result.submissions || []);
  } catch (error) {
    const box = $("#myWorkshopSubmissionList");
    if (box) box.innerHTML = `<div class="list-item">Submissions load failed: ${escapeHTML(error.message)}</div>`;
  }
}

function renderWorkshopAttendance(attendance = []) {
  const box = $("#workshopAttendanceList");
  if (!box) return;
  if (!attendance.length) {
    box.innerHTML = `<div class="list-item">Attendance records ഇല്ല. Admin class date create ചെയ്താൽ ഇവിടെ കാണും.</div>`;
    return;
  }
  box.innerHTML = attendance.map((item) => `
    <div class="list-item attendance-history-item">
      <div>
        <strong>${escapeHTML(item.title || "Class")}</strong>
        <span>${escapeHTML(item.classDate || "")} ${item.time ? `· ${escapeHTML(item.time)}` : ""}</span>
        <small>${escapeHTML(item.topic || "")}</small>
      </div>
      <span class="status-pill status-${escapeHTML(item.status)}">${statusLabel(item.status)}</span>
    </div>
  `).join("");
}

function renderWorkshopLeaderboard(list = []) {
  const box = $("#workshopLeaderboardList");
  if (!box) return;
  if (!list.length) {
    box.innerHTML = `<div class="list-item">Leaderboard data ഇല്ല.</div>`;
    return;
  }
  box.innerHTML = list.map((item, index) => `
    <div class="leaderboard-row">
      <span class="leader-rank">${index + 1}</span>
      <div>
        <strong>${escapeHTML(item.name || item.studentId)}</strong>
        <small>${escapeHTML(item.studentId)} · Avg ${escapeHTML(item.progress?.averageMark || 0)}% · Approved ${escapeHTML(item.progress?.approvedWorks || 0)}</small>
      </div>
    </div>
  `).join("");
}

function renderWorkshopCertificate(certificate = {}) {
  const box = $("#workshopCertificateBox");
  if (!box) return;
  if (certificate.eligible) {
    box.innerHTML = `
      <div class="certificate-badge active premium-certificate-card">
        <span class="cert-icon-emoji">🏆</span>
        <img class="certificate-3d-icon" src="assets/certificate-3d.png" alt="Certificate icon" onerror="this.style.display='none'" />
        <div class="certificate-glow-ring"></div>
        <strong>${escapeHTML(certificate.title || "Certificate Eligible")}</strong>
        <small>${escapeHTML(certificate.note || "You are eligible for ADSA workshop completion badge.")}</small>
      </div>
    `;
  } else {
    box.innerHTML = `
      <div class="certificate-badge premium-certificate-card locked">
        <span class="cert-icon-emoji">🎓</span>
        <img class="certificate-3d-icon" src="assets/certificate-3d.png" alt="Certificate icon" onerror="this.style.display='none'" />
        <strong>Certificate Badge Locked</strong>
        <small>Admin mark ചെയ്താൽ eligible badge ഇവിടെ premium badge ആയി കാണും.</small>
      </div>
    `;
  }
}


function normalizeNotificationTimestamp(item = {}) {
  return Number(item.createdAt || item.updatedAt || item.publishedAt || item.created || 0);
}

function buildWorkshopFallbackNotifications(source = {}) {
  const maxAge = 24 * 60 * 60 * 1000;
  const now = Date.now();
  const items = [];

  (source.assignments || []).forEach((assignment) => {
    const stamp = normalizeNotificationTimestamp(assignment);
    if (stamp && now - stamp > maxAge) return;
    // If timestamp is missing, still announce active assignments with upcoming due date.
    const due = assignment.dueDate ? new Date(`${assignment.dueDate}T23:59:00`).getTime() : 0;
    if (!stamp && due && due < now) return;
    items.push({
      type: "assignment",
      title: assignment.title || "New Assignment",
      message: `${workshopCategoryLabel(assignment.category)}${assignment.dueDate ? ` · Due ${assignment.dueDate}` : ""}`,
      createdAt: stamp || now
    });
  });

  (source.announcements || source.notifications || []).forEach((notice) => {
    if (notice.type && notice.type !== "announcement") return;
    const stamp = normalizeNotificationTimestamp(notice);
    if (stamp && now - stamp > maxAge) return;
    items.push({
      type: "announcement",
      title: notice.title || "Workshop Announcement",
      message: notice.message || "",
      createdAt: stamp || now
    });
  });

  (source.attendance || source.classes || []).forEach((cls) => {
    const stamp = normalizeNotificationTimestamp(cls);
    if (stamp && now - stamp > maxAge) return;
    const classTime = cls.classDate ? new Date(`${cls.classDate}T23:59:00`).getTime() : 0;
    if (!stamp && classTime && classTime < now - maxAge) return;
    items.push({
      type: "class",
      title: cls.title || "Workshop Class",
      message: `${cls.classDate || "Class date added"}${cls.time ? ` · ${cls.time}` : ""}${cls.topic ? ` · ${cls.topic}` : ""}`,
      createdAt: stamp || classTime || now
    });
  });

  return items
    .filter((item) => !item.createdAt || now - Number(item.createdAt) <= maxAge || item.type === "class")
    .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))
    .slice(0, 12);
}

function renderWorkshopNotifications(notifications = []) {
  const btn = $("#workshopNotificationBtn");
  const count = $("#workshopNotificationCount");
  const list = $("#workshopNotificationList");
  if (!btn || !count || !list) return;

  const maxAge = 24 * 60 * 60 * 1000;
  const freshServerItems = (notifications || []).filter((item) => {
    const stamp = normalizeNotificationTimestamp(item);
    return !stamp || Date.now() - stamp <= maxAge;
  });

  const items = freshServerItems.length ? freshServerItems : buildWorkshopFallbackNotifications(workshopDashboardCache || {});
  count.textContent = String(items.length);
  count.classList.toggle("hidden", !items.length);
  btn.classList.toggle("has-notifications", Boolean(items.length));
  btn.classList.toggle("has-new", Boolean(items.length));

  if (!items.length) {
    list.innerHTML = `
      <div class="compact-empty-state notification-announcement">
        <strong>No fresh updates now</strong>
        <span>New assignments and class announcements will appear here for 24 hours.</span>
      </div>
      <div class="notification-item type-info">
        <span class="notification-type-icon">📢</span>
        <div>
          <strong>Workshop Notice Board</strong>
          <small>Admin add ചെയ്യുന്ന assignment / class date ഇവിടെ update ആയി കാണും.</small>
        </div>
      </div>
    `;
    return;
  }
  list.innerHTML = items.map((item) => `
    <div class="notification-item type-${escapeHTML(item.type || "info")}">
      <span class="notification-type-icon">${item.type === "class" ? "📅" : item.type === "assignment" ? "📝" : item.type === "announcement" ? "📣" : "📢"}</span>
      <div>
        <strong>${escapeHTML(item.title || "Notification")}</strong>
        <small>${escapeHTML(item.message || "")} · ${escapeHTML(timeAgo(item.createdAt))}</small>
      </div>
    </div>
  `).join("");
}


// -------------------- ADMIN: WORKSHOP MANAGEMENT --------------------

// -------------------- ADMIN: WORKSHOP MANAGEMENT --------------------
async function addWorkshopStudent(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);
  const payload = {
    studentId: String(formData.get("studentId") || "").trim().toUpperCase(),
    name: String(formData.get("name") || "").trim(),
    batch: String(formData.get("batch") || "").trim(),
    category: String(formData.get("category") || "Creative Graphic Design").trim(),
    skill: String(formData.get("category") || "Creative Graphic Design").trim(),
    password: String(formData.get("password") || "")
  };
  try {
    setMessage("#workshopStudentMessage", "Adding student...");
    await adminFetch("/api/admin/workshop-students", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    form.reset();
    const searchInput = $("#workshopStudentSearch");
    if (searchInput) searchInput.value = payload.studentId;
    setMessage("#workshopStudentMessage", "Student added. Search result card താഴെ കാണാം.");
    await loadAdminWorkshopStudents();
    await loadAdminCertificates();
    await loadAdminDashboardStats();
  } catch (error) {
    console.error(error);
    setMessage("#workshopStudentMessage", error.message || "Student add failed", true);
  }
}

async function loadAdminWorkshopStudents() {
  const box = $("#workshopStudentsAdminList");
  if (!box) return;
  try {
    box.innerHTML = `<div class="list-item">Loading student manager...</div>`;
    const result = await adminFetch("/api/admin/workshop-students");
    adminWorkshopStudentsCache = (result.students || []).slice().sort((a, b) => String(a.studentId || "").localeCompare(String(b.studentId || "")));
    renderAdminWorkshopStudentManager();
  } catch (error) {
    console.error(error);
    box.innerHTML = `<div class="list-item">Students load failed: ${escapeHTML(error.message)}</div>`;
  }
}

function getWorkshopStudentSearchValues() {
  return {
    query: String($("#workshopStudentSearch")?.value || "").trim().toLowerCase(),
    category: String($("#workshopStudentCategoryFilter")?.value || "").trim()
  };
}

function renderAdminWorkshopStudentManager() {
  const box = $("#workshopStudentsAdminList");
  if (!box) return;
  const countPill = $("#workshopStudentCompactCount");
  if (countPill) countPill.textContent = `${adminWorkshopStudentsCache.length} Students`;

  const summary = $("#workshopStudentsAdminSummary");
  if (summary) {
    const activeCount = adminWorkshopStudentsCache.filter((s) => s.active !== false).length;
    const disabledCount = adminWorkshopStudentsCache.length - activeCount;
    const categoryCards = WORKSHOP_CATEGORIES.map((cat) => {
      const count = adminWorkshopStudentsCache.filter((s) => workshopCategoryLabel(s.category || s.skill) === cat).length;
      return `<div class="compact-summary-card"><span>${escapeHTML(cat)}</span><strong>${count}</strong></div>`;
    }).join("");
    summary.innerHTML = `
      <div class="compact-summary-card"><span>Active</span><strong>${activeCount}</strong></div>
      <div class="compact-summary-card"><span>Disabled</span><strong>${disabledCount}</strong></div>
      ${categoryCards}
    `;
  }

  if (!adminWorkshopStudentsCache.length) {
    box.innerHTML = `<div class="list-item">Workshop students ഇല്ല. Add Student form ഉപയോഗിച്ച് add ചെയ്യുക.</div>`;
    return;
  }

  const { query, category } = getWorkshopStudentSearchValues();
  const filtered = adminWorkshopStudentsCache.filter((student) => {
    const haystack = `${student.studentId || ""} ${student.name || ""} ${student.batch || ""} ${student.category || student.skill || ""}`.toLowerCase();
    const categoryOk = !category || workshopCategoryLabel(student.category || student.skill) === category;
    const queryOk = query && haystack.includes(query);
    return categoryOk && queryOk;
  });

  if (!query) {
    box.innerHTML = `
      <div class="compact-empty-state">
        <strong>Full student list hidden</strong>
        <span>Student ID അല്ലെങ്കിൽ name search ചെയ്താൽ മാത്രം edit / password / disable / delete options കാണും.</span>
      </div>
    `;
    return;
  }

  if (!filtered.length) {
    box.innerHTML = `<div class="list-item">Search result ഇല്ല. Student ID/name ശരിയാണോ check ചെയ്യുക.</div>`;
    return;
  }

  const limited = filtered.slice(0, 6);
  box.innerHTML = `
    ${filtered.length > 6 ? `<div class="compact-result-note">${filtered.length} matches found. First 6 മാത്രം കാണിക്കുന്നു. Search കുറച്ച് കൂടുതൽ exact ആക്കൂ.</div>` : ""}
    ${limited.map((student) => `
      <div class="list-item admin-file-item workshop-student-item compact-student-card">
        <div>
          <strong>${escapeHTML(student.studentId)} · ${escapeHTML(student.name || "Student")}</strong>
          <span>${student.active === false ? "Disabled" : "Active"} · ${escapeHTML(student.batch || "No batch")} · ${escapeHTML(workshopCategoryLabel(student.category || student.skill))}</span>
          <small>Submissions: ${student.progress?.totalSubmissions || 0} · Avg: ${student.progress?.averageMark || 0}% · Attendance: ${student.progress?.attendancePercent || 0}%</small>
        </div>
        <div class="list-actions">
          <button class="btn mini blue-btn" type="button" data-admin-edit-student="${escapeHTML(student.studentId)}" data-current-name="${escapeHTML(student.name || "")}" data-current-batch="${escapeHTML(student.batch || "")}" data-current-skill="${escapeHTML(workshopCategoryLabel(student.category || student.skill))}">Edit</button>
          <button class="btn mini soft" type="button" data-admin-student-password="${escapeHTML(student.studentId)}">Password</button>
          <button class="btn mini soft" type="button" data-admin-toggle-student="${escapeHTML(student.studentId)}" data-active="${student.active === false ? "true" : "false"}">${student.active === false ? "Enable" : "Disable"}</button>
          <button class="btn mini danger-btn" type="button" data-admin-delete-student="${escapeHTML(student.studentId)}">Delete</button>
        </div>
      </div>
    `).join("")}
  `;
}

async function addWorkshopAssignment(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const payload = Object.fromEntries(new FormData(form).entries());
  payload.active = true;
  try {
    setMessage("#assignmentAdminMessage", "Adding assignment...");
    await adminFetch("/api/admin/workshop-assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    form.reset();
    setMessage("#assignmentAdminMessage", "Assignment added.");
    await loadAdminWorkshopAssignments();
    await loadAdminDashboardStats();
  } catch (error) {
    console.error(error);
    setMessage("#assignmentAdminMessage", error.message || "Assignment add failed", true);
  }
}

async function loadAdminWorkshopAssignments() {
  const box = $("#assignmentAdminList");
  if (!box) return;
  try {
    box.innerHTML = `<div class="list-item">Loading assignments...</div>`;
    const result = await adminFetch("/api/admin/workshop-assignments");
    const assignments = result.assignments || [];
    if (!assignments.length) {
      box.innerHTML = `<div class="list-item">Assignments ഇല്ല.</div>`;
      return;
    }
    box.innerHTML = assignments.map((item) => `
      <div class="list-item admin-file-item">
        <div>
          <strong>${escapeHTML(item.title)}</strong>
          <span>${item.active === false ? "Closed" : "Active"} · ${escapeHTML(workshopCategoryLabel(item.category))} · Due: ${escapeHTML(item.dueDate || "Not set")} · Max: ${escapeHTML(item.maxMark || 100)}</span>
          <small>${escapeHTML(item.description || "")}</small>
        </div>
        <div class="list-actions">
          <button class="btn mini soft" type="button" data-admin-toggle-assignment="${item.id}" data-active="${item.active === false ? "true" : "false"}">${item.active === false ? "Open" : "Close"}</button>
          <button class="btn mini danger-btn" type="button" data-admin-delete-assignment="${item.id}">Delete</button>
        </div>
      </div>
    `).join("");
  } catch (error) {
    console.error(error);
    box.innerHTML = `<div class="list-item">Assignments load failed: ${escapeHTML(error.message)}</div>`;
  }
}

async function loadAdminWorkshopSubmissions() {
  const box = $("#workshopSubmissionsAdminList");
  try {
    if (box) box.innerHTML = `<div class="list-item">Loading submission summary...</div>`;
    const result = await adminFetch("/api/admin/workshop-submissions");
    adminWorkshopSubmissionsCache = result.submissions || [];
    renderAdminWorkshopSubmissionSummary();
    renderAdminWorkshopSubmissionModalList();
  } catch (error) {
    console.error(error);
    if (box) box.innerHTML = `<div class="list-item">Submissions load failed: ${escapeHTML(error.message)}</div>`;
  }
}

function renderAdminWorkshopSubmissionSummary() {
  const summary = $("#workshopSubmissionSummary");
  const hiddenBox = $("#workshopSubmissionsAdminList");
  const statuses = ["submitted", "reviewed", "need-correction", "approved"];
  const counts = Object.fromEntries(statuses.map((status) => [status, 0]));
  for (const item of adminWorkshopSubmissionsCache) {
    const status = String(item.reviewStatus || item.status || "submitted");
    if (counts[status] !== undefined) counts[status] += 1;
  }
  if (summary) {
    summary.innerHTML = `
      <div class="compact-summary-card"><span>Total</span><strong>${adminWorkshopSubmissionsCache.length}</strong></div>
      <div class="compact-summary-card status-card submitted"><span>Submitted</span><strong>${counts.submitted}</strong></div>
      <div class="compact-summary-card status-card reviewed"><span>Reviewed</span><strong>${counts.reviewed}</strong></div>
      <div class="compact-summary-card status-card need-correction"><span>Need Correction</span><strong>${counts["need-correction"]}</strong></div>
      <div class="compact-summary-card status-card approved"><span>Approved</span><strong>${counts.approved}</strong></div>
    `;
  }
  if (hiddenBox) {
    hiddenBox.innerHTML = `<div class="compact-empty-state"><strong>Full list hidden</strong><span>${adminWorkshopSubmissionsCache.length} submission(s). Open Submissions popup ഉപയോഗിച്ച് review ചെയ്യുക.</span></div>`;
  }
}

function renderAdminWorkshopSubmissionModalList() {
  const box = $("#workshopSubmissionsModalList");
  if (!box) return;
  const query = String($("#submissionSearchInput")?.value || "").trim().toLowerCase();
  const filter = String($("#submissionStatusFilter")?.value || "all");
  let submissions = adminWorkshopSubmissionsCache.slice();
  if (filter !== "all") submissions = submissions.filter((item) => String(item.reviewStatus || item.status) === filter);
  if (query) {
    submissions = submissions.filter((item) => `${item.studentId || ""} ${item.studentName || ""} ${item.assignmentTitle || ""} ${item.originalName || ""}`.toLowerCase().includes(query));
  }
  if (!submissions.length) {
    box.innerHTML = `<div class="list-item">Matching submissions ഇല്ല.</div>`;
    return;
  }
  box.innerHTML = submissions.map((item) => `
      <div class="list-item admin-file-item feedback-admin-item submission-review-card">
        <div class="feedback-admin-info">
          <div class="submission-card-title-row">
            <strong>${escapeHTML(item.assignmentTitle || "Workshop submission")}</strong>
            ${statusBadge(item.reviewStatus || item.status)}
          </div>
          <span>${escapeHTML(item.studentId || "")} · ${escapeHTML(item.studentName || "Student")} · ${item.size ? formatSize(item.size) : "File"}</span>
          <small>${escapeHTML(item.originalName || "File")} · ${formatTime(item.createdAt)}</small>
          <small class="gallery-publish-status ${item.publishedToGallery ? "is-published" : "is-pending"}">Gallery: ${item.publishedToGallery ? "Published to Student Works" : "Not published"}</small>
          <div class="feedback-form-grid">
            <label>Mark
              <input class="input mini-input" type="number" min="0" max="${escapeHTML(item.maxMark || 100)}" value="${escapeHTML(item.mark ?? "")}" data-feedback-mark="${item.id}" placeholder="0-${escapeHTML(item.maxMark || 100)}">
            </label>
            <label>Status
              <select class="input mini-input" data-feedback-status="${item.id}">
                ${["submitted", "reviewed", "need-correction", "approved"].map((status) => `<option value="${status}" ${status === (item.reviewStatus || item.status) ? "selected" : ""}>${statusLabel(status)}</option>`).join("")}
              </select>
            </label>
          </div>
          <label>Feedback
            <textarea class="input" rows="2" data-feedback-text="${item.id}" placeholder="Feedback for student">${escapeHTML(item.feedback || "")}</textarea>
          </label>
        </div>
        <div class="list-actions stacked-actions">
          <a class="btn mini blue-btn" href="${PRINT_API_BASE}/api/workshop/submission-file/${item.id}" target="_blank" rel="noopener">Open</a>
          <a class="btn mini soft" href="${PRINT_API_BASE}/api/workshop/download-submission/${item.id}" target="_blank" rel="noopener">Download</a>
          <button class="btn mini primary" type="button" data-admin-save-feedback="${item.id}">Save Feedback</button>
          <button class="btn mini ${item.publishedToGallery ? "warning-btn" : "success-btn"}" type="button" data-admin-publish-submission="${item.id}" data-published="${item.publishedToGallery ? "false" : "true"}">${item.publishedToGallery ? "Unpublish" : "Publish to Works"}</button>
          <button class="btn mini danger-btn" type="button" data-admin-delete-workshop-submission="${item.id}">Delete</button>
        </div>
      </div>
    `).join("");
}

function setupSubmissionManagerModal() {
  const modal = $("#submissionManagerModal");
  const openBtn = $("#openSubmissionManagerBtn");
  const closeBtn = $("#closeSubmissionManagerBtn");
  const closeTargets = $$('[data-close-submission-modal]');
  const openModal = async () => {
    if (!modal) return;
    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
    if (!adminWorkshopSubmissionsCache.length) await loadAdminWorkshopSubmissions();
    renderAdminWorkshopSubmissionModalList();
  };
  const closeModal = () => {
    if (!modal) return;
    modal.classList.add("hidden");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
  };
  openBtn?.addEventListener("click", openModal);
  closeBtn?.addEventListener("click", closeModal);
  closeTargets.forEach((item) => item.addEventListener("click", closeModal));
  $("#submissionSearchInput")?.addEventListener("input", renderAdminWorkshopSubmissionModalList);
  $("#submissionStatusFilter")?.addEventListener("change", renderAdminWorkshopSubmissionModalList);
}

async function addAttendanceClass(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const payload = Object.fromEntries(new FormData(form).entries());
  try {
    setMessage("#attendanceAdminMessage", "Creating class...");
    await adminFetch("/api/admin/workshop-attendance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    form.reset();
    setMessage("#attendanceAdminMessage", "Class created. ഇനി attendance mark ചെയ്യാം.");
    await loadAdminAttendanceClasses();
    await loadAdminDashboardStats();
  } catch (error) {
    console.error(error);
    setMessage("#attendanceAdminMessage", error.message || "Class create failed", true);
  }
}

async function loadAdminAttendanceClasses() {
  const box = $("#attendanceAdminList");
  if (!box) return;
  try {
    box.innerHTML = `<div class="list-item">Loading attendance register...</div>`;
    const [classesResult, studentsResult] = await Promise.all([
      adminFetch("/api/admin/workshop-attendance"),
      adminFetch("/api/admin/workshop-students")
    ]);
    const classes = (classesResult.classes || []).slice().sort((a, b) => {
      const dateCompare = String(a.classDate || "").localeCompare(String(b.classDate || ""));
      return dateCompare || ((a.createdAt || 0) - (b.createdAt || 0));
    });
    const students = (studentsResult.students || []).slice().sort((a, b) => String(a.studentId || "").localeCompare(String(b.studentId || "")));
    attendanceRegisterCache = { classes, students };
    renderAttendanceRegisterTable();
  } catch (error) {
    console.error(error);
    box.innerHTML = `<div class="list-item">Attendance load failed: ${escapeHTML(error.message)}</div>`;
  }
}

function renderAttendanceRegisterTable() {
  const box = $("#attendanceAdminList");
  if (!box) return;
  const { classes, students } = attendanceRegisterCache;
  if (!students.length) {
    box.innerHTML = `<div class="list-item">Students ഇല്ല. ആദ്യം Workshop Students add ചെയ്യുക.</div>`;
    return;
  }
  if (!classes.length) {
    box.innerHTML = `<div class="list-item">Class date create ചെയ്തിട്ടില്ല. മുകളിൽ Add Class Date ഉപയോഗിച്ച് date add ചെയ്യുക.</div>`;
    updateAttendancePageControls();
    return;
  }

  const totalPages = Math.max(1, Math.ceil(classes.length / ATTENDANCE_PAGE_SIZE));
  attendancePageIndex = Math.min(Math.max(attendancePageIndex, 0), totalPages - 1);
  const start = attendancePageIndex * ATTENDANCE_PAGE_SIZE;
  const pageClasses = classes.slice(start, start + ATTENDANCE_PAGE_SIZE);

  box.innerHTML = `
    <div class="attendance-register-scroll">
      <table class="attendance-register-table">
        <thead>
          <tr>
            <th class="student-name-col">Student Name</th>
            ${pageClasses.map((cls, index) => `
              <th class="class-date-col" title="${escapeHTML(cls.title || "Class")} ${escapeHTML(cls.topic || "")}">
                <button class="attendance-date-chip" type="button" data-admin-delete-attendance="${escapeHTML(cls.id)}" title="Delete this class date">
                  <b>${escapeHTML(cls.classDate || `Class ${start + index + 1}`)}</b>
                  <small>${escapeHTML(cls.time || cls.topic || cls.title || "Class")}</small>
                  <em>Delete</em>
                </button>
              </th>
            `).join("")}
          </tr>
        </thead>
        <tbody>
          ${students.map((student) => `
            <tr>
              <td class="student-name-col student-name-cell"><strong>${escapeHTML(student.name || "Student")}</strong><small>${escapeHTML(student.studentId || "")} · ${escapeHTML(workshopCategoryLabel(student.category || student.skill))}</small></td>
              ${pageClasses.map((cls) => {
                const status = (cls.records || {})[student.studentId] || "not-marked";
                return `<td><button class="attendance-cell status-${escapeHTML(status)}" type="button" data-attendance-cell data-attendance-class-id="${escapeHTML(cls.id)}" data-attendance-student="${escapeHTML(student.studentId)}" data-status="${escapeHTML(status)}">${escapeHTML(attendanceShortLabel(status))}</button></td>`;
              }).join("")}
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
  updateAttendancePageControls();
}

function updateAttendancePageControls() {
  const total = attendanceRegisterCache.classes.length;
  const totalPages = Math.max(1, Math.ceil(total / ATTENDANCE_PAGE_SIZE));
  const info = $("#attendancePageInfo");
  if (info) info.textContent = `Page ${attendancePageIndex + 1} / ${totalPages} · ${total} class date(s)`;
  const prev = $("#attendancePrevPage");
  const next = $("#attendanceNextPage");
  if (prev) prev.disabled = attendancePageIndex <= 0;
  if (next) next.disabled = attendancePageIndex >= totalPages - 1;
}


async function loadImageAsDataURL(paths = []) {
  for (const src of paths) {
    try {
      const response = await fetch(src, { cache: "force-cache" });
      if (!response.ok) continue;
      const blob = await response.blob();
      return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.warn("Attendance PDF image load failed", src, error.message);
    }
  }
  return "";
}

function addAttendancePdfHeader(doc, { page, totalPages, logoData, calligraphyData }) {
  const margin = 6;
  if (logoData) {
    try { doc.addImage(logoData, undefined, margin, 4.2, 14, 14); } catch (error) { console.warn("Logo add failed", error.message); }
  }
  if (calligraphyData) {
    try { doc.addImage(calligraphyData, undefined, 247, 4.2, 42, 13); } catch (error) { console.warn("Calligraphy add failed", error.message); }
  }
  doc.setFont("helvetica", "bold");
  doc.setTextColor(17, 24, 39);
  doc.setFontSize(13.5);
  doc.text("ADSA Media Lab", logoData ? 23 : margin, 9);
  doc.setFontSize(10.5);
  doc.text("Workshop Attendance Register", logoData ? 23 : margin, 14);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  doc.setFontSize(7.2);
  doc.text(`Page ${page + 1} / ${totalPages} · 30 class boxes per A4 landscape page`, logoData ? 23 : margin, 18.2);
}

function attendancePdfStatusLabel(status = "not-marked") {
  if (status === "present") return "P";
  if (status === "absent") return "A";
  return "";
}

function getAttendancePdfPages(classes = [], pageSize = ATTENDANCE_PAGE_SIZE) {
  const totalSlots = Math.max(pageSize, Math.ceil(Math.max(classes.length, 1) / pageSize) * pageSize);
  const padded = Array.from({ length: totalSlots }, (_, index) => classes[index] || {
    id: `blank-${index + 1}`,
    classDate: "",
    time: "",
    title: "",
    topic: "",
    records: {},
    isBlank: true
  });
  const pages = [];
  for (let index = 0; index < padded.length; index += pageSize) {
    pages.push(padded.slice(index, index + pageSize));
  }
  return pages;
}

function buildAttendancePrintableHtml() {
  const { classes, students } = attendanceRegisterCache;
  const pageSize = ATTENDANCE_PAGE_SIZE;
  const pages = getAttendancePdfPages(classes, pageSize);
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>ADSA Attendance Register</title>
      <style>
        @page { size: A4 landscape; margin: 6mm; }
        * { box-sizing: border-box; }
        body { margin: 0; font-family: Arial, sans-serif; color: #111827; }
        .print-page { page-break-after: always; }
        .print-page:last-child { page-break-after: auto; }
        h1 { margin: 0 0 1mm; font-size: 14px; line-height: 1.1; } .pdf-top { display:flex; align-items:center; justify-content:space-between; gap:4mm; margin-bottom:2mm; } .pdf-top img { width:14mm; height:14mm; object-fit:contain; } .pdf-top .calligraphy { width:38mm; height:13mm; }
        p { margin: 0 0 2mm; font-size: 8px; color: #475569; }
        table { width: 100%; border-collapse: collapse; table-layout: fixed; }
        th, td { border: 1px solid #94a3b8; text-align: center; padding: 0.6mm; font-size: 6.2px; height: 5.6mm; vertical-align: middle; }
        th { background: #e0f2fe; font-weight: 800; }
        .name-col { width: 38mm; text-align: left; }
        .date-col { width: calc((100% - 38mm) / 30); }
        .date-box { display: block; min-height: 4.8mm; line-height: 1.1; overflow: hidden; word-break: break-all; }
        small { font-size: 5.4px; color: #475569; }
        td.present { color: #166534; font-weight: 900; }
        td.absent { color: #991b1b; font-weight: 900; }
      </style>
    </head>
    <body>
      ${pages.map((pageClasses, page) => `
        <section class="print-page">
          <div class="pdf-top"><img src="assets/images/logo.png" onerror="this.src='assets/logo.png'" /><div><h1>ADSA Media Lab</h1><p>Workshop Attendance Register · Page ${page + 1} / ${pages.length} · 30 class boxes per A4 landscape page</p></div><img class="calligraphy" src="assets/images/calligraphy.png" onerror="this.style.display='none'" /></div>
          <table>
            <thead>
              <tr>
                <th class="name-col">Student Name</th>
                ${pageClasses.map((cls) => `<th class="date-col"><span class="date-box">${escapeHTML(cls.classDate || "")}</span></th>`).join("")}
              </tr>
            </thead>
            <tbody>
              ${students.map((student) => `
                <tr>
                  <td class="name-col"><strong>${escapeHTML(student.name || "Student")}</strong><br><small>${escapeHTML(student.studentId || "")}</small></td>
                  ${pageClasses.map((cls) => {
                    const status = cls.isBlank ? "not-marked" : ((cls.records || {})[student.studentId] || "not-marked");
                    return `<td class="${status === "present" ? "present" : status === "absent" ? "absent" : ""}">${escapeHTML(attendancePdfStatusLabel(status))}</td>`;
                  }).join("")}
                </tr>
              `).join("")}
            </tbody>
          </table>
        </section>
      `).join("")}
    </body>
    </html>
  `;
}

async function downloadAttendancePdf() {
  const { classes, students } = attendanceRegisterCache;
  if (!students.length) {
    alert("Attendance PDF ഉണ്ടാക്കാൻ students വേണം.");
    return;
  }

  const jsPDF = window.jspdf?.jsPDF;
  if (!jsPDF) {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Popup blocked. Browser popup allow ചെയ്യുക.");
      return;
    }
    printWindow.document.open();
    printWindow.document.write(buildAttendancePrintableHtml());
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 500);
    return;
  }

  const [logoData, calligraphyData] = await Promise.all([
    loadImageAsDataURL(["assets/images/logo.png", "assets/logo.png"]),
    loadImageAsDataURL(["assets/images/calligraphy.png", "assets/calligraphy.png"])
  ]);

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = 297;
  const pageH = 210;
  const margin = 6;
  const titleH = 17;
  const rowH = 5.45;
  const headerH = 11;
  const nameW = 38;
  const pageSize = ATTENDANCE_PAGE_SIZE;
  const pages = getAttendancePdfPages(classes, pageSize);
  const colW = (pageW - (margin * 2) - nameW) / pageSize;

  pages.forEach((pageClasses, page) => {
    if (page > 0) doc.addPage("a4", "landscape");
    let y = margin;

    addAttendancePdfHeader(doc, { page, totalPages: pages.length, logoData, calligraphyData });

    y += titleH;
    doc.setFillColor(224, 242, 254);
    doc.rect(margin, y, pageW - margin * 2, headerH, "F");
    doc.setDrawColor(148, 163, 184);
    doc.setLineWidth(0.16);
    doc.rect(margin, y, nameW, headerH);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(17, 24, 39);
    doc.setFontSize(7);
    doc.text("Student Name", margin + 1.5, y + 6.5);

    pageClasses.forEach((cls, index) => {
      const x = margin + nameW + index * colW;
      doc.rect(x, y, colW, headerH);
      if (cls.classDate) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(4.8);
        doc.setTextColor(17, 24, 39);
        doc.text(String(cls.classDate).slice(0, 10), x + colW / 2, y + 6, { align: "center", maxWidth: colW - 0.8 });
      }
    });

    y += headerH;
    students.forEach((student) => {
      if (y + rowH > pageH - margin) return;
      doc.setFillColor(255, 255, 255);
      doc.rect(margin, y, nameW, rowH);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(17, 24, 39);
      doc.setFontSize(5.8);
      doc.text(String(student.name || "Student").slice(0, 26), margin + 1, y + 2.25, { maxWidth: nameW - 2 });
      doc.setFont("helvetica", "normal");
      doc.setTextColor(71, 85, 105);
      doc.setFontSize(4.8);
      doc.text(String(student.studentId || "").slice(0, 18), margin + 1, y + 4.7, { maxWidth: nameW - 2 });

      pageClasses.forEach((cls, index) => {
        const x = margin + nameW + index * colW;
        const status = cls.isBlank ? "not-marked" : ((cls.records || {})[student.studentId] || "not-marked");
        doc.setFillColor(255, 255, 255);
        doc.rect(x, y, colW, rowH, "F");
        doc.rect(x, y, colW, rowH);
        const label = attendancePdfStatusLabel(status);
        if (label) {
          doc.setFont("helvetica", "bold");
          doc.setFontSize(6.2);
          doc.setTextColor(status === "present" ? 22 : 153, status === "present" ? 101 : 27, status === "present" ? 52 : 27);
          doc.text(label, x + colW / 2, y + 3.55, { align: "center" });
          doc.setTextColor(17, 24, 39);
        }
      });
      y += rowH;
    });
  });

  doc.save(`ADSA-Attendance-Register-${new Date().toISOString().slice(0, 10)}.pdf`);
}


function setupAttendanceRegisterModal() {
  const modal = $("#attendanceRegisterModal");
  const openBtn = $("#openAttendanceRegisterBtn");
  const closeBtn = $("#closeAttendanceRegisterBtn");
  const closeTargets = $$('[data-close-attendance-modal]');
  const openModal = async () => {
    if (!modal) return;
    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
    await loadAdminAttendanceClasses();
  };
  const closeModal = () => {
    if (!modal) return;
    modal.classList.add("hidden");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
  };
  openBtn?.addEventListener("click", openModal);
  closeBtn?.addEventListener("click", closeModal);
  closeTargets.forEach((item) => item.addEventListener("click", closeModal));
  $("#attendancePrevPage")?.addEventListener("click", () => {
    attendancePageIndex = Math.max(0, attendancePageIndex - 1);
    renderAttendanceRegisterTable();
  });
  $("#attendanceNextPage")?.addEventListener("click", () => {
    const totalPages = Math.max(1, Math.ceil(attendanceRegisterCache.classes.length / ATTENDANCE_PAGE_SIZE));
    attendancePageIndex = Math.min(totalPages - 1, attendancePageIndex + 1);
    renderAttendanceRegisterTable();
  });
  $("#downloadAttendancePdfBtn")?.addEventListener("click", downloadAttendancePdf);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && modal && !modal.classList.contains("hidden")) closeModal();
  });
}

async function loadAdminCertificates() {
  const box = $("#certificateAdminList");
  if (!box) return;
  try {
    box.innerHTML = `<div class="list-item">Loading certificate manager...</div>`;
    const result = await adminFetch("/api/admin/workshop-certificates");
    adminCertificateStudentsCache = result.students || [];
    renderAdminCertificateManager();
  } catch (error) {
    console.error(error);
    box.innerHTML = `<div class="list-item">Certificates load failed: ${escapeHTML(error.message)}</div>`;
  }
}

function renderAdminCertificateManager() {
  const box = $("#certificateAdminList");
  if (!box) return;
  const eligible = adminCertificateStudentsCache.filter((student) => student.certificateEligible).length;
  const countPill = $("#certificateCompactCount");
  if (countPill) countPill.textContent = `${eligible} Eligible`;

  if (!adminCertificateStudentsCache.length) {
    box.innerHTML = `<div class="list-item">Students ഇല്ല.</div>`;
    return;
  }

  const query = String($("#certificateStudentSearch")?.value || "").trim().toLowerCase();
  if (!query) {
    box.innerHTML = `
      <div class="compact-empty-state">
        <strong>Certificate full list hidden</strong>
        <span>Student ID അല്ലെങ്കിൽ name search ചെയ്താൽ certificate eligibility update ചെയ്യാം.</span>
      </div>
    `;
    return;
  }

  const filtered = adminCertificateStudentsCache.filter((student) => {
    const haystack = `${student.studentId || ""} ${student.name || ""} ${student.certificateTitle || ""}`.toLowerCase();
    return haystack.includes(query);
  });

  if (!filtered.length) {
    box.innerHTML = `<div class="list-item">Search result ഇല്ല.</div>`;
    return;
  }

  const limited = filtered.slice(0, 6);
  box.innerHTML = `
    ${filtered.length > 6 ? `<div class="compact-result-note">${filtered.length} matches found. First 6 മാത്രം കാണിക്കുന്നു.</div>` : ""}
    ${limited.map((student) => `
      <div class="list-item admin-file-item certificate-admin-item compact-student-card">
        <div>
          <strong>${escapeHTML(student.studentId)} · ${escapeHTML(student.name)}</strong>
          <span>${student.certificateEligible ? "Certificate Eligible" : "Not Eligible"}</span>
          <small>${escapeHTML(student.certificateTitle || "ADSA Workshop Completion Badge")}</small>
          <input class="input" data-certificate-title="${escapeHTML(student.studentId)}" value="${escapeHTML(student.certificateTitle || "ADSA Workshop Completion Badge")}" placeholder="Certificate title">
          <textarea class="input" rows="2" data-certificate-note="${escapeHTML(student.studentId)}" placeholder="Certificate note">${escapeHTML(student.certificateNote || "")}</textarea>
        </div>
        <div class="list-actions stacked-actions">
          <button class="btn mini ${student.certificateEligible ? "soft" : "blue-btn"}" type="button" data-admin-certificate-toggle="${escapeHTML(student.studentId)}" data-eligible="${student.certificateEligible ? "false" : "true"}">${student.certificateEligible ? "Remove" : "Make Eligible"}</button>
          <button class="btn mini primary" type="button" data-admin-certificate-save="${escapeHTML(student.studentId)}" data-eligible="${student.certificateEligible ? "true" : "false"}">Save</button>
        </div>
      </div>
    `).join("")}
  `;
}

async function handleWorkshopAdminActions(event) {
  const editBtn = event.target.closest?.("[data-admin-edit-student]");
  if (editBtn) {
    const oldId = editBtn.getAttribute("data-admin-edit-student");
    const currentName = editBtn.getAttribute("data-current-name") || "";
    const currentBatch = editBtn.getAttribute("data-current-batch") || "";
    const currentSkill = editBtn.getAttribute("data-current-skill") || "";
    const newId = prompt("Student ID edit ചെയ്യാം:", oldId);
    if (!newId) return;
    const newName = prompt("Student name edit ചെയ്യാം:", currentName);
    if (!newName) return;
    const batch = prompt("Batch:", currentBatch) || "";
    const skill = prompt("Workshop Category:", currentSkill) || "Creative Graphic Design";
    await adminFetch(`/api/admin/workshop-students/${encodeURIComponent(oldId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId: newId.trim().toUpperCase(), name: newName.trim(), batch, skill, category: skill })
    });
    await loadAdminWorkshopStudents();
    await loadAdminWorkshopSubmissions();
    await loadAdminCertificates();
    return;
  }

  const passwordBtn = event.target.closest?.("[data-admin-student-password]");
  if (passwordBtn) {
    const studentId = passwordBtn.getAttribute("data-admin-student-password");
    const password = prompt(`${studentId} new password enter ചെയ്യുക:`);
    if (!password) return;
    await adminFetch(`/api/admin/workshop-students/${encodeURIComponent(studentId)}/password`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password })
    });
    alert("Password updated.");
    return;
  }

  const toggleBtn = event.target.closest?.("[data-admin-toggle-student]");
  if (toggleBtn) {
    const studentId = toggleBtn.getAttribute("data-admin-toggle-student");
    const active = toggleBtn.getAttribute("data-active") === "true";
    await adminFetch(`/api/admin/workshop-students/${encodeURIComponent(studentId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active })
    });
    await loadAdminWorkshopStudents();
    await loadAdminDashboardStats();
    return;
  }

  const deleteStudentBtn = event.target.closest?.("[data-admin-delete-student]");
  if (deleteStudentBtn) {
    const studentId = deleteStudentBtn.getAttribute("data-admin-delete-student");
    if (!confirm(`${studentId} delete ചെയ്യണോ?`)) return;
    await adminFetch(`/api/admin/workshop-students/${encodeURIComponent(studentId)}`, { method: "DELETE" });
    await loadAdminWorkshopStudents();
    await loadAdminCertificates();
    await loadAdminDashboardStats();
    return;
  }

  const toggleAssignment = event.target.closest?.("[data-admin-toggle-assignment]");
  if (toggleAssignment) {
    const id = toggleAssignment.getAttribute("data-admin-toggle-assignment");
    const active = toggleAssignment.getAttribute("data-active") === "true";
    await adminFetch(`/api/admin/workshop-assignments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active })
    });
    await loadAdminWorkshopAssignments();
    await loadAdminDashboardStats();
    return;
  }

  const deleteAssignment = event.target.closest?.("[data-admin-delete-assignment]");
  if (deleteAssignment) {
    const id = deleteAssignment.getAttribute("data-admin-delete-assignment");
    if (!confirm("Assignment delete ചെയ്യണോ?")) return;
    await adminFetch(`/api/admin/workshop-assignments/${id}`, { method: "DELETE" });
    await loadAdminWorkshopAssignments();
    await loadAdminDashboardStats();
    return;
  }

  const saveFeedback = event.target.closest?.("[data-admin-save-feedback]");
  if (saveFeedback) {
    const id = saveFeedback.getAttribute("data-admin-save-feedback");
    const mark = document.querySelector(`[data-feedback-mark="${CSS.escape(id)}"]`)?.value ?? "";
    const reviewStatus = document.querySelector(`[data-feedback-status="${CSS.escape(id)}"]`)?.value || "reviewed";
    const feedback = document.querySelector(`[data-feedback-text="${CSS.escape(id)}"]`)?.value || "";
    await adminFetch(`/api/admin/workshop-submissions/${id}/feedback`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mark, reviewStatus, feedback })
    });
    alert("Feedback saved.");
    await loadAdminWorkshopSubmissions();
    renderAdminWorkshopSubmissionModalList();
    await loadAdminDashboardStats();
    return;
  }

  const publishSubmissionBtn = event.target.closest?.("[data-admin-publish-submission]");
  if (publishSubmissionBtn) {
    const id = publishSubmissionBtn.getAttribute("data-admin-publish-submission");
    const published = publishSubmissionBtn.getAttribute("data-published") === "true";
    const confirmText = published
      ? "ഈ workshop work main page Student Works section-ൽ publish ചെയ്യണോ?"
      : "ഈ work main page Student Works section-ൽ നിന്നും remove ചെയ്യണോ?";
    if (!confirm(confirmText)) return;
    await adminFetch(`/api/admin/workshop-submissions/${id}/publish`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ published })
    });
    alert(published ? "Main page Student Works section-ലേക്ക് publish ചെയ്തു." : "Main page Student Works section-ൽ നിന്ന് remove ചെയ്തു.");
    await loadAdminWorkshopSubmissions();
    renderAdminWorkshopSubmissionModalList();
    await loadAdminDashboardStats();
    return;
  }

  const deleteSubmissionBtn = event.target.closest?.("[data-admin-delete-workshop-submission]");
  if (deleteSubmissionBtn) {
    const id = deleteSubmissionBtn.getAttribute("data-admin-delete-workshop-submission");
    if (!confirm("ഈ workshop submission delete ചെയ്യണോ?")) return;
    await adminFetch(`/api/admin/workshop-submissions/${id}`, { method: "DELETE" });
    await loadAdminWorkshopSubmissions();
    renderAdminWorkshopSubmissionModalList();
    await loadAdminDashboardStats();
    return;
  }

  const attendanceCell = event.target.closest?.("[data-attendance-cell]");
  if (attendanceCell) {
    const current = attendanceCell.getAttribute("data-status") || "not-marked";
    const next = current === "not-marked" ? "present" : current === "present" ? "absent" : "not-marked";
    attendanceCell.setAttribute("data-status", next);
    attendanceCell.textContent = attendanceShortLabel(next);
    attendanceCell.classList.remove("status-not-marked", "status-present", "status-absent", "status-late", "status-excused");
    attendanceCell.classList.add(`status-${next}`);
    return;
  }

  const saveAttendanceRegister = event.target.closest?.("[data-admin-save-attendance-register]");
  if (saveAttendanceRegister) {
    const classRecords = {};
    document.querySelectorAll("[data-attendance-cell]").forEach((cell) => {
      const classId = cell.getAttribute("data-attendance-class-id");
      const studentId = cell.getAttribute("data-attendance-student");
      const status = cell.getAttribute("data-status") || "not-marked";
      if (!classRecords[classId]) classRecords[classId] = {};
      classRecords[classId][studentId] = status;
    });
    const entries = Object.entries(classRecords);
    for (const [id, records] of entries) {
      await adminFetch(`/api/admin/workshop-attendance/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ records })
      });
    }
    alert("Attendance register saved.");
    await loadAdminAttendanceClasses();
    await loadAdminDashboardStats();
    return;
  }

  const deleteAttendance = event.target.closest?.("[data-admin-delete-attendance]");
  if (deleteAttendance) {
    const id = deleteAttendance.getAttribute("data-admin-delete-attendance");
    if (!confirm("Attendance class delete ചെയ്യണോ?")) return;
    await adminFetch(`/api/admin/workshop-attendance/${id}`, { method: "DELETE" });
    await loadAdminAttendanceClasses();
    await loadAdminDashboardStats();
    return;
  }

  const certificateBtn = event.target.closest?.("[data-admin-certificate-toggle], [data-admin-certificate-save]");
  if (certificateBtn) {
    const studentId = certificateBtn.getAttribute("data-admin-certificate-toggle") || certificateBtn.getAttribute("data-admin-certificate-save");
    const eligible = certificateBtn.getAttribute("data-eligible") === "true";
    const title = document.querySelector(`[data-certificate-title="${CSS.escape(studentId)}"]`)?.value || "ADSA Workshop Completion Badge";
    const note = document.querySelector(`[data-certificate-note="${CSS.escape(studentId)}"]`)?.value || "";
    await adminFetch(`/api/admin/workshop-certificates/${encodeURIComponent(studentId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ certificateEligible: eligible, certificateTitle: title, certificateNote: note })
    });
    await loadAdminCertificates();
    await loadAdminDashboardStats();
  }
}


function setupWorkshopNotificationPanel() {
  const btn = $("#workshopNotificationBtn");
  const panel = $("#workshopNotificationPanel");
  if (!btn || !panel) return;
  btn.addEventListener("click", () => panel.classList.toggle("hidden"));
  document.addEventListener("click", (event) => {
    if (!panel.classList.contains("hidden") && !panel.contains(event.target) && !btn.contains(event.target)) {
      panel.classList.add("hidden");
    }
  });
}



// -------------------- PERFORMANCE SAFE UI ANIMATIONS --------------------
function setupSmoothUiAnimations() {
  const prefersReduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (prefersReduced) {
    document.documentElement.classList.add("reduce-motion");
    return;
  }

  const revealSelector = [
    ".reveal",
    ".reveal-card",
    ".section-panel",
    ".tutorials-panel",
    ".student-works-board",
    ".work-upload-panel",
    ".print-card",
    ".form-card",
    ".asset-card",
    ".tutorial-card",
    ".workshop-premium-card",
    ".premium-workshop-shell",
    ".admin-panel-shell",
    ".dashboard",
    ".panel",
    ".admin-stat-card",
    ".student-progress-card",
    ".submission-summary-card",
    ".premium-certificate-card",
    ".workshop-track-card",
    ".category-mini-card",
    ".common-dashboard-preview"
  ].join(",");

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("visible", "is-visible");
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });

  const prepareElement = (element, index = 0) => {
    if (!element || element.dataset.motionReady === "1") return;
    element.dataset.motionReady = "1";
    element.classList.add("animate-on-scroll");
    element.style.setProperty("--anim-delay", `${Math.min(index % 6, 5) * 60}ms`);
    observer.observe(element);
  };

  document.querySelectorAll(revealSelector).forEach((element, index) => prepareElement(element, index));

  const mutationObserver = new MutationObserver((mutations) => {
    let queue = [];
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (!(node instanceof HTMLElement)) return;
        if (node.matches?.(revealSelector)) queue.push(node);
        node.querySelectorAll?.(revealSelector).forEach((child) => queue.push(child));
      });
    });
    queue.slice(0, 40).forEach((element, index) => prepareElement(element, index));
  });

  mutationObserver.observe(document.body, { childList: true, subtree: true });

  document.addEventListener("click", (event) => {
    const attendanceCell = event.target.closest?.(".attendance-cell, .attendance-status-cell, .attendance-mark-cell, .attendance-toggle-cell");
    if (!attendanceCell) return;
    attendanceCell.classList.remove("just-changed");
    void attendanceCell.offsetWidth;
    attendanceCell.classList.add("just-changed");
    window.setTimeout(() => attendanceCell.classList.remove("just-changed"), 260);
  }, { passive: true });
}

// Connect after page loads
function setupCompactStudentManagers() {
  const studentSearch = $("#workshopStudentSearch");
  const studentCategory = $("#workshopStudentCategoryFilter");
  studentSearch?.addEventListener("input", renderAdminWorkshopStudentManager);
  studentCategory?.addEventListener("change", renderAdminWorkshopStudentManager);

  const certificateSearch = $("#certificateStudentSearch");
  certificateSearch?.addEventListener("input", renderAdminCertificateManager);
}

window.addEventListener("DOMContentLoaded", () => {
  setupUploadWidgets();
  setupSmoothUiAnimations();
  setupCompactStudentManagers();

  const printForm = $("#printUploadForm");
  if (printForm) printForm.addEventListener("submit", uploadPrintFile);

  const workForm = $("#workUploadForm");
  if (workForm) workForm.addEventListener("submit", uploadStudentWork);

  const adminForm = $("#adminLoginForm");
  if (adminForm) adminForm.addEventListener("submit", adminLogin);

  const announcementForm = $("#addAnnouncementForm");
  if (announcementForm) announcementForm.addEventListener("submit", addAdminAnnouncement);

  const tutorialForm = $("#addTutorialForm");
  if (tutorialForm) tutorialForm.addEventListener("submit", addTutorial);

  const assetForm = $("#addAssetForm");
  if (assetForm) assetForm.addEventListener("submit", addAsset);

  const workshopStudentForm = $("#addWorkshopStudentForm");
  if (workshopStudentForm) workshopStudentForm.addEventListener("submit", addWorkshopStudent);

  const assignmentForm = $("#addWorkshopAssignmentForm");
  if (assignmentForm) assignmentForm.addEventListener("submit", addWorkshopAssignment);

  const attendanceForm = $("#addAttendanceClassForm");
  if (attendanceForm) attendanceForm.addEventListener("submit", addAttendanceClass);

  const workshopLoginForm = $("#workshopLoginForm");
  if (workshopLoginForm) workshopLoginForm.addEventListener("submit", workshopLogin);

  const workshopSubmissionForm = $("#workshopSubmissionForm");
  if (workshopSubmissionForm) workshopSubmissionForm.addEventListener("submit", submitWorkshopAssignment);

  $("#workshopCategoryFilter")?.addEventListener("change", () => renderWorkshopAssignments(workshopDashboardCache?.assignments || []));

  $("#logoutWorkshopBtn")?.addEventListener("click", logoutWorkshop);
  $("#logoutAdminBtn")?.addEventListener("click", adminLogout);
  document.addEventListener("click", handleAdminActions);
  document.addEventListener("click", (event) => {
    handleWorkshopAdminActions(event).catch((error) => {
      console.error(error);
      alert(error.message || "Workshop admin action failed.");
    });
  });


  document.addEventListener("click", (event) => {
    const assetFolder = event.target.closest?.("[data-asset-folder]");
    if (assetFolder) {
      event.preventDefault();
      const select = $("#assetCategoryFilter");
      if (select) select.value = assetFolder.getAttribute("data-asset-folder") || "all";
      renderPublicAssets();
      $("#assetGrid")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    const backAsset = event.target.closest?.("[data-back-asset-folders]");
    if (backAsset) {
      event.preventDefault();
      const select = $("#assetCategoryFilter");
      const search = $("#assetSearch");
      if (select) select.value = "all";
      if (search) search.value = "";
      renderPublicAssets();
      return;
    }

    const tutorialFolder = event.target.closest?.("[data-tutorial-folder]");
    if (tutorialFolder) {
      event.preventDefault();
      const select = $("#tutorialCategoryFilter");
      if (select) select.value = tutorialFolder.getAttribute("data-tutorial-folder") || "all";
      renderPublicTutorials();
      $("#publicTutorials")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    const backTutorial = event.target.closest?.("[data-back-tutorial-folders]");
    if (backTutorial) {
      event.preventDefault();
      const select = $("#tutorialCategoryFilter");
      const search = $("#tutorialSearch");
      if (select) select.value = "all";
      if (search) search.value = "";
      renderPublicTutorials();
      return;
    }

    const adminTutorialAccess = event.target.closest?.("[data-admin-tutorial-access]");
    if (adminTutorialAccess) {
      event.preventDefault();
      adminTutorialView.access = adminTutorialAccess.getAttribute("data-admin-tutorial-access") || "";
      adminTutorialView.category = "";
      renderAdminTutorialFolders();
      return;
    }

    const adminTutorialCategory = event.target.closest?.("[data-admin-tutorial-category]");
    if (adminTutorialCategory) {
      event.preventDefault();
      adminTutorialView.category = adminTutorialCategory.getAttribute("data-admin-tutorial-category") || "";
      renderAdminTutorialFolders();
      return;
    }

    const adminTutorialRootBack = event.target.closest?.("[data-admin-back-tutorial-root]");
    if (adminTutorialRootBack) {
      event.preventDefault();
      adminTutorialView.access = "";
      adminTutorialView.category = "";
      renderAdminTutorialFolders();
      return;
    }

    const adminTutorialCategoryBack = event.target.closest?.("[data-admin-back-tutorial-categories]");
    if (adminTutorialCategoryBack) {
      event.preventDefault();
      adminTutorialView.category = "";
      renderAdminTutorialFolders();
      return;
    }

    const workshopTutorialFolder = event.target.closest?.("[data-workshop-tutorial-folder]");
    if (workshopTutorialFolder) {
      event.preventDefault();
      workshopTutorialView.category = workshopTutorialFolder.getAttribute("data-workshop-tutorial-folder") || "";
      renderWorkshopTutorialFolders();
      return;
    }

    const workshopTutorialBack = event.target.closest?.("[data-back-workshop-tutorial-folders]");
    if (workshopTutorialBack) {
      event.preventDefault();
      workshopTutorialView.category = "";
      renderWorkshopTutorialFolders();
      return;
    }
  });

  setupWorksModal();
  setupWorkViewer();
  setupFontDownloadLinks();
  setupAttendanceRegisterModal();
  setupSubmissionManagerModal();
  setupWorkshopNotificationPanel();
  loadPrintFiles();
  loadStudentWorks();
  loadPublicTutorials();
  loadPublicAssets();
  checkExistingAdminSession();
  checkExistingWorkshopSession();
});
