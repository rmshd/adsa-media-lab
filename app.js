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
    setMessage("#workMessage", "Work upload success. Student works folder-ൽ save ആയി.");
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

function renderPublicTutorials() {
  const container = $("#publicTutorials");
  if (!container) return;
  const category = $("#tutorialCategoryFilter")?.value || "all";
  const search = ($("#tutorialSearch")?.value || "").toLowerCase().trim();

  let tutorials = tutorialCache.filter((item) => item.access === "public");
  if (category !== "all") tutorials = tutorials.filter((item) => item.category === category);
  if (search) {
    tutorials = tutorials.filter((item) => [item.title, item.category, item.level, item.language].join(" ").toLowerCase().includes(search));
  }

  if (!tutorials.length) {
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

  container.innerHTML = tutorials.map((tutorial) => {
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
  }).join("");
}

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

  let assets = assetCache;
  if (category !== "all") assets = assets.filter((asset) => asset.category === category);
  if (search) {
    assets = assets.filter((asset) => [asset.title, asset.fontName, asset.category, asset.description, asset.originalName].join(" ").toLowerCase().includes(search));
  }

  if (!assets.length) {
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

  container.innerHTML = assets.map((asset) => {
    const displayTitle = isAssetFont(asset) ? getFontDisplayName(asset) : (asset.title || asset.originalName || "Design Asset");
    const meta = isAssetFont(asset) && asset.fontName ? `Detected font · ${asset.size ? formatSize(asset.size) : "File"}` : (asset.size ? formatSize(asset.size) : asset.externalLink ? "External link" : "File");
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
  }).join("");
}


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
    loadAdminCertificates()
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
    box.innerHTML = works.map((work) => `
      <div class="list-item admin-file-item">
        <div>
          <strong>${escapeHTML(work.title)}</strong>
          <span>${escapeHTML(work.studentName)} · ${escapeHTML(work.software || "-")} · ${escapeHTML(work.workType || "Work")} · ${formatSize(work.size)}</span>
          <small>${work.featured ? "Featured on home" : "Not featured"} · ${formatTime(work.uploadedAt)}</small>
        </div>
        <div class="list-actions">
          <button class="btn mini blue-btn" type="button" data-open-work="${work.id}">Preview</button>
          <button class="btn mini soft" type="button" data-admin-feature-work="${work.id}" data-featured="${work.featured ? "false" : "true"}">${work.featured ? "Unfeature" : "Feature"}</button>
          <button class="btn mini danger-btn" type="button" data-admin-delete-work="${work.id}">Delete</button>
        </div>
      </div>
    `).join("");
  } catch (error) {
    console.error(error);
    box.innerHTML = `<div class="list-item">Student works load failed: ${escapeHTML(error.message)}</div>`;
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

async function loadAdminTutorials() {
  const box = $("#tutorialAdminList");
  if (!box) return;
  try {
    box.innerHTML = `<div class="list-item">Loading tutorials...</div>`;
    const result = await adminFetch("/api/admin/tutorials");
    const tutorials = result.tutorials || [];
    if (!tutorials.length) {
      box.innerHTML = `<div class="list-item">Tutorial links ഒന്നുമില്ല.</div>`;
      return;
    }
    box.innerHTML = tutorials.map((tutorial) => `
      <div class="list-item admin-file-item">
        <div>
          <strong>${escapeHTML(tutorial.title)}</strong>
          <span>${escapeHTML(tutorial.category)} · ${escapeHTML(tutorial.level)} · ${escapeHTML(tutorial.language)} · ${escapeHTML(tutorial.access)}</span>
          <small>${escapeHTML(tutorial.youtubeLink)}</small>
        </div>
        <div class="list-actions">
          <a class="btn mini blue-btn" href="${escapeHTML(tutorial.youtubeLink)}" target="_blank" rel="noopener">Watch</a>
          <button class="btn mini danger-btn" type="button" data-admin-delete-tutorial="${tutorial.id}">Delete</button>
        </div>
      </div>
    `).join("");
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
          <span>${escapeHTML(asset.category || "Asset")} · ${asset.size ? formatSize(asset.size) : "External link"}</span>
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
    renderWorkshopCertificate(result.certificate || {});
    await loadWorkshopTutorials();
  } catch (error) {
    console.error(error);
    setMessage("#workshopSubmitMessage", `Dashboard load failed: ${error.message}`, true);
  }
}

function renderWorkshopStudentProfile(student = {}) {
  if ($("#workshopWelcomeTitle")) $("#workshopWelcomeTitle").textContent = `Welcome, ${student.name || student.studentId || "Student"}`;
  if ($("#workshopStudentMeta")) $("#workshopStudentMeta").textContent = `${student.studentId || ""} · ${student.batch || "Workshop Batch"} · ${student.skill || "Design Workshop"}`;
  const box = $("#workshopProfileCard");
  if (box) {
    box.innerHTML = `
      <div class="profile-avatar">${escapeHTML((student.name || student.studentId || "A").slice(0, 1).toUpperCase())}</div>
      <div>
        <span>Student Profile</span>
        <strong>${escapeHTML(student.name || "Student")}</strong>
        <small>${escapeHTML(student.studentId || "")} · ${escapeHTML(student.batch || "Batch not set")} · ${escapeHTML(student.skill || "Skill not set")}</small>
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
  if (select) {
    select.innerHTML = `<option value="">Select active assignment</option>` + assignments.map((item) => `
      <option value="${escapeHTML(item.id)}" data-title="${escapeHTML(item.title)}">${escapeHTML(item.title)}${item.dueDate ? ` · ${escapeHTML(item.dueDate)}` : ""}</option>
    `).join("");
  }
  if (!list) return;
  if (!assignments.length) {
    list.innerHTML = `<div class="list-item">Active assignments ഇല്ല. Admin add ചെയ്താൽ ഇവിടെ കാണും.</div>`;
    return;
  }
  list.innerHTML = assignments.map((item) => `
    <div class="assignment-card">
      <div>
        <strong>${escapeHTML(item.title)}</strong>
        <p>${escapeHTML(item.description || "No description")}</p>
        <small>Due: ${escapeHTML(item.dueDate || "Not set")} · Max mark: ${escapeHTML(item.maxMark || 100)} · ${escapeHTML(item.allowedFileTypes || "Any file")}</small>
      </div>
    </div>
  `).join("");
}

async function loadWorkshopTutorials() {
  const box = $("#workshopTutorialList");
  if (!box) return;
  try {
    box.innerHTML = `<div class="works-loading">Loading tutorials...</div>`;
    const result = await workshopFetch("/api/workshop/tutorials");
    const tutorials = result.tutorials || [];
    if (!tutorials.length) {
      box.innerHTML = `<div class="works-loading">Workshop tutorials admin add ചെയ്തിട്ടില്ല.</div>`;
      return;
    }
    box.innerHTML = tutorials.map((tutorial) => `
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
    `).join("");
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
        <small>${formatTime(item.createdAt)} · ${statusLabel(item.reviewStatus || item.status)}</small>
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
      <div class="certificate-badge active">
        <span>🏆</span>
        <strong>${escapeHTML(certificate.title || "Certificate Eligible")}</strong>
        <small>${escapeHTML(certificate.note || "You are eligible for ADSA workshop completion badge.")}</small>
      </div>
    `;
  } else {
    box.innerHTML = `
      <div class="certificate-badge">
        <span>🎓</span>
        <strong>Certificate Badge Locked</strong>
        <small>Admin mark ചെയ്താൽ eligible badge ഇവിടെ കാണും.</small>
      </div>
    `;
  }
}

// -------------------- ADMIN: WORKSHOP MANAGEMENT --------------------
async function addWorkshopStudent(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);
  const payload = {
    studentId: String(formData.get("studentId") || "").trim().toUpperCase(),
    name: String(formData.get("name") || "").trim(),
    batch: String(formData.get("batch") || "").trim(),
    skill: String(formData.get("skill") || "Design Workshop").trim(),
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
    setMessage("#workshopStudentMessage", "Student added.");
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
    box.innerHTML = `<div class="list-item">Loading workshop students...</div>`;
    const result = await adminFetch("/api/admin/workshop-students");
    const students = result.students || [];
    if (!students.length) {
      box.innerHTML = `<div class="list-item">Workshop students ഇല്ല.</div>`;
      return;
    }
    box.innerHTML = students.map((student) => `
      <div class="list-item admin-file-item workshop-student-item">
        <div>
          <strong>${escapeHTML(student.studentId)} · ${escapeHTML(student.name || "Student")}</strong>
          <span>${student.active === false ? "Disabled" : "Active"} · ${escapeHTML(student.batch || "No batch")} · ${escapeHTML(student.skill || "No skill")}</span>
          <small>Submissions: ${student.progress?.totalSubmissions || 0} · Avg: ${student.progress?.averageMark || 0}% · Attendance: ${student.progress?.attendancePercent || 0}%</small>
        </div>
        <div class="list-actions">
          <button class="btn mini blue-btn" type="button" data-admin-edit-student="${escapeHTML(student.studentId)}" data-current-name="${escapeHTML(student.name || "")}" data-current-batch="${escapeHTML(student.batch || "")}" data-current-skill="${escapeHTML(student.skill || "")}">Edit</button>
          <button class="btn mini soft" type="button" data-admin-student-password="${escapeHTML(student.studentId)}">Password</button>
          <button class="btn mini soft" type="button" data-admin-toggle-student="${escapeHTML(student.studentId)}" data-active="${student.active === false ? "true" : "false"}">${student.active === false ? "Enable" : "Disable"}</button>
          <button class="btn mini danger-btn" type="button" data-admin-delete-student="${escapeHTML(student.studentId)}">Delete</button>
        </div>
      </div>
    `).join("");
  } catch (error) {
    console.error(error);
    box.innerHTML = `<div class="list-item">Students load failed: ${escapeHTML(error.message)}</div>`;
  }
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
          <span>${item.active === false ? "Closed" : "Active"} · Due: ${escapeHTML(item.dueDate || "Not set")} · Max: ${escapeHTML(item.maxMark || 100)}</span>
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
  if (!box) return;
  try {
    box.innerHTML = `<div class="list-item">Loading workshop submissions...</div>`;
    const result = await adminFetch("/api/admin/workshop-submissions");
    const submissions = result.submissions || [];
    if (!submissions.length) {
      box.innerHTML = `<div class="list-item">Workshop submissions ഇല്ല.</div>`;
      return;
    }
    box.innerHTML = submissions.map((item) => `
      <div class="list-item admin-file-item feedback-admin-item">
        <div class="feedback-admin-info">
          <strong>${escapeHTML(item.assignmentTitle || "Workshop submission")}</strong>
          <span>${escapeHTML(item.studentId || "")} · ${escapeHTML(item.studentName || "Student")} · ${item.size ? formatSize(item.size) : "File"}</span>
          <small>${escapeHTML(item.originalName || "File")} · ${formatTime(item.createdAt)} · ${statusLabel(item.reviewStatus || item.status)}</small>
          <label>Mark
            <input class="input mini-input" type="number" min="0" max="${escapeHTML(item.maxMark || 100)}" value="${escapeHTML(item.mark ?? "")}" data-feedback-mark="${item.id}" placeholder="0-${escapeHTML(item.maxMark || 100)}">
          </label>
          <label>Status
            <select class="input mini-input" data-feedback-status="${item.id}">
              ${["submitted", "reviewed", "need-correction", "approved"].map((status) => `<option value="${status}" ${status === (item.reviewStatus || item.status) ? "selected" : ""}>${statusLabel(status)}</option>`).join("")}
            </select>
          </label>
          <label>Feedback
            <textarea class="input" rows="2" data-feedback-text="${item.id}" placeholder="Feedback for student">${escapeHTML(item.feedback || "")}</textarea>
          </label>
        </div>
        <div class="list-actions stacked-actions">
          <a class="btn mini blue-btn" href="${PRINT_API_BASE}/api/workshop/submission-file/${item.id}" target="_blank" rel="noopener">Open</a>
          <a class="btn mini soft" href="${PRINT_API_BASE}/api/workshop/download-submission/${item.id}" target="_blank" rel="noopener">Download</a>
          <button class="btn mini primary" type="button" data-admin-save-feedback="${item.id}">Save Feedback</button>
          <button class="btn mini danger-btn" type="button" data-admin-delete-workshop-submission="${item.id}">Delete</button>
        </div>
      </div>
    `).join("");
  } catch (error) {
    console.error(error);
    box.innerHTML = `<div class="list-item">Submissions load failed: ${escapeHTML(error.message)}</div>`;
  }
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
    const classes = classesResult.classes || [];
    const students = studentsResult.students || [];
    if (!classes.length) {
      box.innerHTML = `<div class="list-item">Class dates create ചെയ്തിട്ടില്ല. Class ഉണ്ടെങ്കിൽ 1/2 days മുമ്പ് date add ചെയ്യുക.</div>`;
      return;
    }
    box.innerHTML = classes.map((cls) => `
      <div class="attendance-class-card" data-attendance-class="${cls.id}">
        <div class="attendance-class-head">
          <div>
            <strong>${escapeHTML(cls.title)}</strong>
            <span>${escapeHTML(cls.classDate)} ${cls.time ? `· ${escapeHTML(cls.time)}` : ""}</span>
            <small>${escapeHTML(cls.topic || cls.notes || "")}</small>
          </div>
          <div class="list-actions">
            <button class="btn mini blue-btn" type="button" data-admin-save-attendance="${cls.id}">Save Attendance</button>
            <button class="btn mini danger-btn" type="button" data-admin-delete-attendance="${cls.id}">Delete Class</button>
          </div>
        </div>
        <div class="attendance-student-grid">
          ${students.map((student) => {
            const current = (cls.records || {})[student.studentId] || "not-marked";
            return `
              <label class="attendance-student-row">
                <span>${escapeHTML(student.studentId)} · ${escapeHTML(student.name)}</span>
                <select class="input mini-input" data-attendance-student="${escapeHTML(student.studentId)}">
                  ${["not-marked", "present", "absent", "late", "excused"].map((status) => `<option value="${status}" ${status === current ? "selected" : ""}>${statusLabel(status)}</option>`).join("")}
                </select>
              </label>
            `;
          }).join("")}
        </div>
      </div>
    `).join("");
  } catch (error) {
    console.error(error);
    box.innerHTML = `<div class="list-item">Attendance load failed: ${escapeHTML(error.message)}</div>`;
  }
}

async function loadAdminCertificates() {
  const box = $("#certificateAdminList");
  if (!box) return;
  try {
    box.innerHTML = `<div class="list-item">Loading certificates...</div>`;
    const result = await adminFetch("/api/admin/workshop-certificates");
    const students = result.students || [];
    if (!students.length) {
      box.innerHTML = `<div class="list-item">Students ഇല്ല.</div>`;
      return;
    }
    box.innerHTML = students.map((student) => `
      <div class="list-item admin-file-item certificate-admin-item">
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
    `).join("");
  } catch (error) {
    console.error(error);
    box.innerHTML = `<div class="list-item">Certificates load failed: ${escapeHTML(error.message)}</div>`;
  }
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
    const skill = prompt("Skill/Course:", currentSkill) || "";
    await adminFetch(`/api/admin/workshop-students/${encodeURIComponent(oldId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId: newId.trim().toUpperCase(), name: newName.trim(), batch, skill })
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
    await loadAdminDashboardStats();
    return;
  }

  const deleteSubmissionBtn = event.target.closest?.("[data-admin-delete-workshop-submission]");
  if (deleteSubmissionBtn) {
    const id = deleteSubmissionBtn.getAttribute("data-admin-delete-workshop-submission");
    if (!confirm("ഈ workshop submission delete ചെയ്യണോ?")) return;
    await adminFetch(`/api/admin/workshop-submissions/${id}`, { method: "DELETE" });
    await loadAdminWorkshopSubmissions();
    await loadAdminDashboardStats();
    return;
  }

  const saveAttendance = event.target.closest?.("[data-admin-save-attendance]");
  if (saveAttendance) {
    const id = saveAttendance.getAttribute("data-admin-save-attendance");
    const card = document.querySelector(`[data-attendance-class="${CSS.escape(id)}"]`);
    const records = {};
    card?.querySelectorAll("[data-attendance-student]").forEach((select) => {
      records[select.getAttribute("data-attendance-student")] = select.value;
    });
    await adminFetch(`/api/admin/workshop-attendance/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ records })
    });
    alert("Attendance saved.");
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

// Connect after page loads
window.addEventListener("DOMContentLoaded", () => {
  setupUploadWidgets();

  const printForm = $("#printUploadForm");
  if (printForm) printForm.addEventListener("submit", uploadPrintFile);

  const workForm = $("#workUploadForm");
  if (workForm) workForm.addEventListener("submit", uploadStudentWork);

  const adminForm = $("#adminLoginForm");
  if (adminForm) adminForm.addEventListener("submit", adminLogin);

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

  $("#logoutWorkshopBtn")?.addEventListener("click", logoutWorkshop);
  $("#logoutAdminBtn")?.addEventListener("click", adminLogout);
  document.addEventListener("click", handleAdminActions);
  document.addEventListener("click", (event) => {
    handleWorkshopAdminActions(event).catch((error) => {
      console.error(error);
      alert(error.message || "Workshop admin action failed.");
    });
  });

  setupWorksModal();
  setupWorkViewer();
  setupFontDownloadLinks();
  loadPrintFiles();
  loadStudentWorks();
  loadPublicTutorials();
  loadPublicAssets();
  checkExistingAdminSession();
  checkExistingWorkshopSession();
});
