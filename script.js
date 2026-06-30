async function loadJSON(path) {
  try {
    console.log(`Attempting to fetch: ${path}`);
    const res = await fetch(path, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    });
    console.log(`Fetch response for ${path}:`, res.status, res.statusText);

    if (!res.ok) {
      throw new Error(
        `Failed to load ${path}: ${res.status} ${res.statusText}`
      );
    }

    const data = await res.json();
    console.log(`Successfully loaded ${path}:`, data);
    return data;
  } catch (error) {
    console.error(`Error loading ${path}:`, error);
    throw error;
  }
}

async function loadManifest() {
  return loadJSON("/manifest.json");
}

async function loadRoutes() {
  return loadJSON("/routes.json");
}

async function loadMeta(relativePath) {
  const path = `/Files/${relativePath}/meta.json`;
  return loadJSON(path);
}

const CONTENT_KEY = "__content";

function normalizeMetaList(value) {
  if (!value) return [];
  const items = Array.isArray(value) ? value : [value];
  return items.filter((item) => typeof item === "string" && item.trim() !== "");
}

function getMediaEmbeds(meta) {
  const youtubeVideos = normalizeMetaList(meta.youtube).map((videoId, index) => ({
    src: `https://www.youtube.com/embed/${videoId.trim()}`,
    title: `YouTube player ${index + 1}`,
    allow:
      "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share",
    allowfullscreen: "",
  }));

  const driveVideos = normalizeMetaList(meta.googleDrive || meta.drive).map(
    (fileId, index) => ({
      src: `https://drive.google.com/file/d/${fileId.trim()}/preview`,
      title: `Google Drive player ${index + 1}`,
      allow: "autoplay",
      allowfullscreen: "",
    })
  );

  return [...youtubeVideos, ...driveVideos];
}

function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  Object.entries(props).forEach(([k, v]) => {
    if (k === "class") node.className = v;
    else if (k.startsWith("on") && typeof v === "function")
      node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  });
  children
    .flat()
    .forEach((c) =>
      node.appendChild(typeof c === "string" ? document.createTextNode(c) : c)
    );
  return node;
}

function renderNav(manifest, routes) {
  const nav = document.getElementById("nav");
  nav.innerHTML = "";
  const listItems = [];

  function renderLevel(data, container, depth = 0, pathPrefix = []) {
    // Safety check to prevent infinite recursion
    if (!data || typeof data !== "object" || depth > 10) {
      console.error("Invalid data or max depth reached:", {
        data,
        depth,
        pathPrefix,
      });
      return;
    }

    const keys = Object.keys(data).sort();

    for (const key of keys) {
      if (key === CONTENT_KEY) continue;

      const value = data[key];
      const currentPath = [...pathPrefix, key];

      if (typeof value === "string" || value === null) {
        // This is a leaf node (string = base filename, or null = YouTube/media only)
        const fullPath = currentPath.join("/");
        const li = el("li", { "data-content-path": fullPath }, cap(key));
        li.addEventListener("click", (e) => {
          e.stopPropagation();
          listItems.forEach((x) => x.classList.remove("active"));
          li.classList.add("active");

          showContent(fullPath, value);

          const route = routes.byContentPath[fullPath];
          if (route) {
            window.history.pushState({}, "", route);
          }

          // Close mobile nav when item is selected
          if (window.innerWidth <= 1024) {
            const nav = document.getElementById("nav");
            const navOverlay = document.getElementById("nav-overlay");
            const navToggle = document.getElementById("nav-toggle");

            nav.classList.remove("open");
            navOverlay.classList.remove("active");
            navToggle.classList.remove("active");
            document.body.style.overflow = "";
          }
        });
        listItems.push(li);

        const ul = el("ul");
        ul.appendChild(li);
        container.appendChild(ul);
      } else if (value && typeof value === "object" && !Array.isArray(value)) {
        // This is a branch node, create header and recurse
        const headerTag = depth === 0 ? "h2" : "h3";
        const header = el(
          headerTag,
          { class: "collapsed", "data-branch-path": currentPath.join("/") },
          cap(key)
        );
        const section = el("div", {
          class:
            depth === 0
              ? "sefer-section collapsed"
              : "section-level-" + depth + " collapsed",
        });

        // Add accordion functionality
        header.addEventListener("click", (e) => {
          e.preventDefault();
          header.classList.toggle("collapsed");
          section.classList.toggle("collapsed");

        });

        // Add accordion functionality consistently
        container.appendChild(header);

        if (Object.prototype.hasOwnProperty.call(value, CONTENT_KEY)) {
          const fullPath = currentPath.join("/");
          const contentValue = value[CONTENT_KEY];
          const selfItem = el("li", { "data-content-path": fullPath }, cap(key));

          selfItem.addEventListener("click", (e) => {
            e.stopPropagation();
            listItems.forEach((x) => x.classList.remove("active"));
            selfItem.classList.add("active");
            showContent(fullPath, contentValue);

            const route = routes.byContentPath[fullPath];
          if (route) {
            window.history.pushState({}, "", route);
          }

          if (window.innerWidth <= 1024) {
            const nav = document.getElementById("nav");
            const navOverlay = document.getElementById("nav-overlay");
            const navToggle = document.getElementById("nav-toggle");

            nav.classList.remove("open");
            navOverlay.classList.remove("active");
            navToggle.classList.remove("active");
            document.body.style.overflow = "";
          }
        });

          listItems.push(selfItem);
          section.appendChild(el("ul", {}, selfItem));
        }

        renderLevel(value, section, depth + 1, currentPath);
        container.appendChild(section);
      } else if (value === null) {
        // Handle null values (missing PDFs) - show as disabled item
        const li = el("li", { class: "disabled" }, `${cap(key)} (No PDF)`);
        listItems.push(li);

        const ul = el("ul");
        ul.appendChild(li);
        container.appendChild(ul);
      } else {
        console.warn("Unexpected value type:", {
          key,
          value,
          type: typeof value,
        });
      }
    }
  }

  renderLevel(manifest, nav);
}

function cap(s) {
  if (!s || typeof s !== "string") {
    console.warn("cap() received invalid input:", s);
    return String(s || "");
  }

  // Strip number prefixes like "1-", "01 - ", "10-", etc. for display
  const withoutPrefix = s.replace(/^\d+\s*-\s*/, "");

  return withoutPrefix.replace(
    /(^|[-_\s])(\w)/g,
    (_, p, c) => (p ? " " : "") + c.toUpperCase()
  );
}

async function showContent(relativePath, baseFilename) {
  const pathParts = relativePath.split("/");
  const displayName = pathParts[pathParts.length - 1];

  // Create breadcrumb from path parts
  const breadcrumb = pathParts.map(cap).join(" › ");

  document.getElementById("title").textContent = cap(displayName);
  document.getElementById("crumbs").textContent = breadcrumb;

  const content = document.getElementById("content");
  content.innerHTML = "";

  // Create status container for error messages at top
  const statusContainer = el("div", { class: "status-messages" });
  content.appendChild(statusContainer);

  // Always check for PDF and audio files regardless of manifest value
  // Determine base filename - use manifest value or directory name
  const actualBaseFilename = baseFilename || relativePath.split("/").pop();

  // Check for PDF file
  const pdfFilename = `${actualBaseFilename}.pdf`;
  const pdfPath = `/Files/${relativePath}/${pdfFilename}`;

  // Check for MP3 file
  const mp3Filename = `${actualBaseFilename}.mp3`;
  const mp3Path = `/Files/${relativePath}/${mp3Filename}`;

  console.log("Checking for files:", { pdfPath, mp3Path, actualBaseFilename });

  // Check PDF existence
  fetch(pdfPath, { method: "HEAD" })
    .then((response) => {
      if (!response.ok) {
        const pdfError = el("div", { class: "media-error" }, "📄 No PDF found");
        statusContainer.appendChild(pdfError);
      }
    })
    .catch(() => {
      const pdfError = el("div", { class: "media-error" }, "📄 No PDF found");
      statusContainer.appendChild(pdfError);
    });

  // Check MP3 existence
  fetch(mp3Path, { method: "HEAD" })
    .then((response) => {
      if (!response.ok) {
        const audioError = el(
          "div",
          { class: "media-error" },
          "🎵 No audio found"
        );
        statusContainer.appendChild(audioError);
      }
    })
    .catch(() => {
      const audioError = el(
        "div",
        { class: "media-error" },
        "🎵 No audio found"
      );
      statusContainer.appendChild(audioError);
    });

  // Create embeds container for YouTube + Audio
  const embedsContainer = el("div", { class: "embeds-container" });

  // Meta (YouTube and Google Drive)
  try {
    const meta = await loadMeta(relativePath);
    let hasEmbeds = false;
    const mediaEmbeds = getMediaEmbeds(meta);

    if (mediaEmbeds.length === 0) {
      const mediaError = el(
        "div",
        { class: "media-error" },
        "📺 No video found"
      );
      statusContainer.appendChild(mediaError);
    } else {
      // Create container for all videos
      const videosContainer = el("div", { class: "videos-container" });

      mediaEmbeds.forEach((embed) => {
        const ytWrapper = el("div", { class: "youtube-wrapper" });
        const yt = el("iframe", embed);
        ytWrapper.appendChild(yt);
        videosContainer.appendChild(ytWrapper);
      });

      embedsContainer.appendChild(videosContainer);
      hasEmbeds = true;
    }

    // Try to show audio player using base filename
    if (baseFilename && baseFilename !== null) {
      const mp3Filename = `${baseFilename}.mp3`;
      const mp3Path = `/Files/${relativePath}/${mp3Filename}`;

      console.log("Trying to load audio:", mp3Path);

      const audioWrapper = el("div", { class: "audio-wrapper" });
      const audioTitle = el("h4", { class: "audio-title" }, "Audio");
      const audio = el("audio", {
        preload: "metadata",
        id: `audio-${Date.now()}`,
      });

      const source = el("source", {
        src: mp3Path,
        type: "audio/mpeg",
      });
      audio.appendChild(source);

      // Add error handling
      audio.addEventListener("error", () => {
        console.log("Audio not found:", mp3Path);
        const audioError = el(
          "div",
          { class: "media-error" },
          "🎵 No audio found"
        );
        statusContainer.appendChild(audioError);
        audioWrapper.style.display = "none";
      });

      audio.addEventListener("loadedmetadata", () => {
        console.log("Audio loaded successfully:", mp3Path);
      });

      // Player controls container
      const controlsContainer = el("div", { class: "audio-controls" });
      const playBtn = el("button", { class: "audio-btn play-btn" }, "▶️");

      const progressContainer = el("div", { class: "progress-container" });
      const progressBar = el("div", { class: "progress-bar" });
      const progressFill = el("div", { class: "progress-fill" });
      progressBar.appendChild(progressFill);

      const timeDisplay = el("span", { class: "time-display" }, "0:00 / 0:00");
      progressContainer.appendChild(progressBar);
      progressContainer.appendChild(timeDisplay);

      const speedBtn = el("button", { class: "audio-btn speed-btn" }, "1x");
      const downloadBtn = el(
        "a",
        {
          class: "audio-btn download-btn",
          href: mp3Path,
          download: mp3Filename,
          title: "Download audio file",
        },
        "⬇️"
      );

      controlsContainer.appendChild(playBtn);
      controlsContainer.appendChild(progressContainer);
      controlsContainer.appendChild(speedBtn);
      controlsContainer.appendChild(downloadBtn);

      audioWrapper.appendChild(audioTitle);
      audioWrapper.appendChild(audio);
      audioWrapper.appendChild(controlsContainer);

      setupAudioPlayer(audio, playBtn, progressFill, timeDisplay, speedBtn);
      embedsContainer.appendChild(audioWrapper);
      hasEmbeds = true;
    }

    if (hasEmbeds) {
      content.appendChild(embedsContainer);
    }
  } catch (e) {
    console.error(e);
    const warn = el("div", {}, "Could not load meta.json for this entry.");
    content.appendChild(warn);
  }

  // PDF - Only create viewer if PDF actually exists
  if (baseFilename && baseFilename !== null) {
    console.log("Checking for PDF:", pdfPath);

    // Check if PDF exists before creating any viewer
    fetch(pdfPath, { method: "HEAD" })
      .then((response) => {
        if (response.ok) {
          console.log("PDF found, creating viewer");
          createPdfViewer();
        } else {
          console.log("PDF not found, skipping viewer creation");
        }
      })
      .catch(() => {
        console.log("PDF check failed, skipping viewer creation");
      });

    function createPdfViewer() {
      const isMobile = window.innerWidth <= 768;
      const pdfWrap = el("div", { class: "pdf-wrap" });

      if (isMobile) {
        const mobilePdfPath = encodeURIComponent(
          `${window.location.origin}/Files/${relativePath}/${pdfFilename}`
        );
        const pdfViewerUrl = `https://mozilla.github.io/pdf.js/web/viewer.html?file=${mobilePdfPath}`;

        // Create mobile PDF container with iframe and download option
        const mobileContainer = el("div", { class: "mobile-pdf-container" });

        const pdfViewer = el("iframe", {
          src: pdfViewerUrl,
          class: "mobile-pdf-viewer",
          title: "PDF Viewer",
        });

        const downloadBtn = el(
          "a",
          {
            href: `/Files/${relativePath}/${pdfFilename}`,
            download: pdfFilename,
            class: "pdf-download-btn",
          },
          "📄 Download PDF"
        );

        mobileContainer.appendChild(downloadBtn);
        mobileContainer.appendChild(pdfViewer);
        pdfWrap.appendChild(mobileContainer);
      } else {
        // Desktop: Use root-relative path
        const desktopPdfPath = `/Files/${relativePath}/${pdfFilename}`;
        const pdfPathWithParams = `${desktopPdfPath}#navpanes=0&scrollbar=1&toolbar=1&view=FitH`;
        const pdfEmbed = el("embed", {
          class: "pdf",
          src: pdfPathWithParams,
          type: "application/pdf",
        });

        pdfWrap.appendChild(pdfEmbed);
      }

      content.appendChild(pdfWrap);
    }
  }
}

// Mobile navigation toggle functionality
function initMobileNav() {
  const navToggle = document.getElementById("nav-toggle");
  const nav = document.getElementById("nav");
  const navOverlay = document.getElementById("nav-overlay");

  if (!navToggle) return; // Desktop mode

  // Check if we should auto-open on mobile
  function checkAutoOpen() {
    if (window.innerWidth <= 1024) {
      // Check if any content is selected (no active nav items)
      const hasActiveItem = document.querySelector("nav li.active");
      const isCurrentlyOpen = nav.classList.contains("open");

      if (!hasActiveItem && !isCurrentlyOpen) {
        // No content selected and nav not already open - open it
        setTimeout(openNav, 100); // Small delay to ensure DOM is ready
      }
    }
  }

  function toggleNav() {
    const isOpen = nav.classList.contains("open");

    if (isOpen) {
      closeNav();
    } else {
      openNav();
    }
  }

  function openNav() {
    nav.classList.add("open");
    navOverlay.classList.add("active");
    navToggle.classList.add("active");
    document.body.style.overflow = "hidden"; // Prevent background scrolling
  }

  function closeNav() {
    nav.classList.remove("open");
    navOverlay.classList.remove("active");
    navToggle.classList.remove("active");
    document.body.style.overflow = ""; // Restore scrolling
  }

  // Toggle nav when hamburger is clicked
  navToggle.addEventListener("click", toggleNav);

  // Close nav when overlay is clicked
  navOverlay.addEventListener("click", closeNav);

  // Close nav when escape key is pressed
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && nav.classList.contains("open")) {
      closeNav();
    }
  });

  // Auto-open on initial load if mobile and no content selected
  checkAutoOpen();

  // Update nav position based on header height
  function updateNavPosition() {
    if (window.innerWidth <= 1024) {
      const header = document.querySelector(".top-header");
      const nav = document.getElementById("nav");
      if (header && nav) {
        const headerRect = header.getBoundingClientRect();
        const headerBottom = headerRect.bottom;
        nav.style.top = `${headerBottom}px`;
        nav.style.height = `calc(100vh - ${headerBottom}px)`;
        nav.style.marginTop = "0";
      }
    } else {
      // Reset inline styles on desktop
      const nav = document.getElementById("nav");
      if (nav) {
        nav.style.top = "";
        nav.style.height = "";
        nav.style.marginTop = "";
      }
    }
  }

  // Update position on resize
  window.addEventListener("resize", () => {
    updateNavPosition();
    if (window.innerWidth > 1024) {
      closeNav();
    } else {
      checkAutoOpen();
    }

    // Refresh PDF display if switching between mobile/desktop
    const activeItem = document.querySelector("nav li.active");
    if (activeItem) {
      // Small delay to ensure layout has updated
      setTimeout(() => {
        activeItem.click();
      }, 100);
    }
  });

  // Initial position update
  updateNavPosition();
}

// Audio player functionality
function setupAudioPlayer(audio, playBtn, progressFill, timeDisplay, speedBtn) {
  let isPlaying = false;
  const speeds = [0.5, 0.75, 1, 1.25, 1.5, 2];
  let currentSpeedIndex = 2; // Start at 1x

  // Play/Pause functionality
  playBtn.addEventListener("click", () => {
    if (isPlaying) {
      audio.pause();
      playBtn.textContent = "▶️";
      isPlaying = false;
    } else {
      audio.play();
      playBtn.textContent = "⏸️";
      isPlaying = true;
    }
  });

  // Speed control
  speedBtn.addEventListener("click", () => {
    currentSpeedIndex = (currentSpeedIndex + 1) % speeds.length;
    const speed = speeds[currentSpeedIndex];
    audio.playbackRate = speed;
    speedBtn.textContent = `${speed}x`;
  });

  // Progress tracking
  audio.addEventListener("timeupdate", () => {
    const progress = (audio.currentTime / audio.duration) * 100;
    progressFill.style.width = `${progress || 0}%`;

    const current = formatTime(audio.currentTime || 0);
    const duration = formatTime(audio.duration || 0);
    timeDisplay.textContent = `${current} / ${duration}`;
  });

  // Progress bar click
  progressFill.parentElement.addEventListener("click", (e) => {
    const rect = progressFill.parentElement.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    audio.currentTime = pos * audio.duration;
  });

  // Reset when ended
  audio.addEventListener("ended", () => {
    playBtn.textContent = "▶️";
    isPlaying = false;
    progressFill.style.width = "0%";
  });
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function normalizeRoute(pathname) {
  const decodedPath = decodeURIComponent(pathname);
  if (decodedPath === "/") return "/";
  return decodedPath.endsWith("/") ? decodedPath : `${decodedPath}/`;
}

function selectContent(contentPath, baseFilename) {
  const pathParts = contentPath.split("/");

  for (let i = 1; i <= pathParts.length; i++) {
    const branchPath = pathParts.slice(0, i).join("/");
    const header = document.querySelector(
      `nav [data-branch-path="${CSS.escape(branchPath)}"]`
    );

    if (header) {
      header.classList.remove("collapsed");
      const section = header.nextElementSibling;
      if (section) {
        section.classList.remove("collapsed");
      }
    }
  }

  document.querySelectorAll("nav li").forEach((item) => {
    item.classList.toggle("active", item.dataset.contentPath === contentPath);
  });

  showContent(contentPath, baseFilename);
}

function navigateToRoute(pathname, routes) {
  const route = normalizeRoute(pathname);
  if (route === "/") return true;

  const entry = routes.byRoute[route];
  if (!entry) {
    console.warn("Route not found:", route);
    return false;
  }

  selectContent(entry.contentPath, entry.baseFilename);
  return true;
}

function showNotFound(pathname) {
  document.getElementById("title").textContent = "";
  document.getElementById("crumbs").textContent = "";

  const content = document.getElementById("content");
  content.innerHTML = "";

  const video = el("video", {
    class: "not-found-video",
    src: "/404.mp4",
    playsinline: "",
    controls: "",
  });

  content.appendChild(
    el("div", { class: "not-found" },
      video,
      el("h2", {}, "404 Not Found"),
      el("a", { href: "/", class: "home-link" }, "Go Home")
    )
  );

}

// Initialize the application
(async () => {
  try {
    const [manifest, routes] = await Promise.all([loadManifest(), loadRoutes()]);
    renderNav(manifest, routes);
    initMobileNav();

    function loadCurrentRoute() {
      const success = navigateToRoute(window.location.pathname, routes);
      if (!success) {
        console.warn("Failed to navigate to path route:", window.location.pathname);
        showNotFound(window.location.pathname);
      }
    }

    window.addEventListener("popstate", () => {
      loadCurrentRoute();
    });

    loadCurrentRoute();
  } catch (e) {
    console.error(e);
    alert(
      "Failed to load manifest.json. Make sure you are serving over http:// (not file://) and manifest.json exists."
    );
  }
})();
