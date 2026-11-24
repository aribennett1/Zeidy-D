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

function normalizeEmbedIds(value) {
  const ids = Array.isArray(value) ? value : [value];
  return ids
    .filter((id) => typeof id === "string")
    .map((id) => id.trim())
    .filter(Boolean);
}

function createIframeEmbeds(
  ids,
  { getSrc, title, wrapperClass = "embed-wrapper" }
) {
  const embeds = el("div", { class: "videos-container" });

  ids.forEach((id, index) => {
    embeds.appendChild(
      createIframeEmbed(id, index, {
        getSrc,
        title,
        wrapperClass,
      })
    );
  });

  return embeds;
}

function createIframeEmbed(
  id,
  index,
  { getSrc, title, wrapperClass = "embed-wrapper" }
) {
  const wrapper = el("div", { class: wrapperClass });
  const iframe = el("iframe", {
    src: getSrc(id),
    title: `${title} ${index + 1}`,
    allow:
      "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share",
    allowfullscreen: "",
  });

  wrapper.appendChild(iframe);
  return wrapper;
}

const VIDEO_EMBED_PROVIDERS = {
  googleDrive: {
    buttonText: "Play From Google Drive",
    getSrc: (id) => `https://drive.google.com/file/d/${id}/preview`,
    title: "Google Drive preview",
    wrapperClass: "embed-wrapper google-drive-wrapper",
  },
  youtube: {
    buttonText: "Play From YouTube",
    getSrc: (id) => `https://www.youtube.com/embed/${id}`,
    title: "YouTube player",
    wrapperClass: "embed-wrapper youtube-wrapper",
  },
};

function setVideoEmbed(container, id, index, provider) {
  container.innerHTML = "";
  container.appendChild(createIframeEmbed(id, index, provider));
}

function createGoogleDriveDownloadLink(id) {
  return el(
    "a",
    {
      class: "video-download-btn",
      href: `https://drive.google.com/uc?export=download&id=${id}`,
      download: "",
    },
    "⤓"
  );
}

function createDownloadableGoogleDriveEmbeds(ids) {
  const embeds = el("div", { class: "videos-container" });

  ids.forEach((id, index) => {
    const item = el("div", { class: "video-embed-item" });
    item.appendChild(
      createIframeEmbed(id, index, VIDEO_EMBED_PROVIDERS.googleDrive)
    );
    item.appendChild(
      el("div", { class: "video-actions" }, createGoogleDriveDownloadLink(id))
    );
    embeds.appendChild(item);
  });

  return embeds;
}

function createSwitchableVideoEmbeds(
  primaryIds,
  primaryProvider,
  alternateIds,
  alternateProvider
) {
  const embeds = el("div", { class: "videos-container" });

  primaryIds.forEach((primaryId, index) => {
    const alternateId = alternateIds[index];
    const item = el("div", { class: "video-embed-item" });
    const videoSlot = el("div", { class: "video-embed-slot" });
    let showingAlternate = false;

    setVideoEmbed(videoSlot, primaryId, index, primaryProvider);
    item.appendChild(videoSlot);

    if (alternateId) {
      const actions = el("div", { class: "video-actions" });
      const sourceToggle = el(
        "button",
        { class: "video-source-toggle", type: "button" },
        alternateProvider.buttonText
      );

      sourceToggle.addEventListener("click", () => {
        showingAlternate = !showingAlternate;

        if (showingAlternate) {
          setVideoEmbed(videoSlot, alternateId, index, alternateProvider);
          sourceToggle.textContent = primaryProvider.buttonText;
        } else {
          setVideoEmbed(videoSlot, primaryId, index, primaryProvider);
          sourceToggle.textContent = alternateProvider.buttonText;
        }
      });

      actions.appendChild(sourceToggle);
      actions.appendChild(createGoogleDriveDownloadLink(alternateId));
      item.appendChild(actions);
    }

    embeds.appendChild(item);
  });

  return embeds;
}

function renderNav(manifest, routes) {
  const nav = document.getElementById("nav-tree");
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

async function fileExists(path) {
  try {
    const response = await fetch(path, { method: "HEAD" });
    return response.ok;
  } catch {
    return false;
  }
}

async function showContent(relativePath, baseFilename) {
  const pathParts = relativePath.split("/");
  const displayName = pathParts[pathParts.length - 1];
  const actualBaseFilename = baseFilename || relativePath.split("/").pop();

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

  // Check for PDF file
  const pdfFilename = `${actualBaseFilename}.pdf`;
  const pdfPath = `/Files/${relativePath}/${pdfFilename}`;

  // Check for MP3 file
  const mp3Filename = `${actualBaseFilename}.mp3`;
  const mp3Path = `/Files/${relativePath}/${mp3Filename}`;

  console.log("Checking for files:", { pdfPath, mp3Path, actualBaseFilename });

  const [hasPdf, hasAudio] = await Promise.all([
    fileExists(pdfPath),
    fileExists(mp3Path),
  ]);

  if (!hasPdf) {
    const pdfError = el("div", { class: "media-error" }, "📄 No PDF found");
    statusContainer.appendChild(pdfError);
  }

  if (!hasAudio) {
    const audioError = el(
      "div",
      { class: "media-error" },
      "🎵 No audio found"
    );
    statusContainer.appendChild(audioError);
  }

  // Create embeds container for YouTube + Audio
  const embedsContainer = el("div", { class: "embeds-container" });

  // Meta (YouTube, optionally switchable to Google Drive)
  try {
    const meta = await loadMeta(relativePath);
    let hasEmbeds = false;

      const googleDriveIds = normalizeEmbedIds(meta["google-drive"]);
      const youtubeIds = normalizeEmbedIds(meta.youtube);

      if (youtubeIds.length > 0) {
        const youtubeEmbeds =
          googleDriveIds.length > 0
            ? createSwitchableVideoEmbeds(
                youtubeIds,
                VIDEO_EMBED_PROVIDERS.youtube,
                googleDriveIds,
                VIDEO_EMBED_PROVIDERS.googleDrive
              )
            : createIframeEmbeds(youtubeIds, VIDEO_EMBED_PROVIDERS.youtube);

        embedsContainer.appendChild(youtubeEmbeds);
        hasEmbeds = true;
      } else if (googleDriveIds.length > 0) {
        embedsContainer.appendChild(
          createDownloadableGoogleDriveEmbeds(googleDriveIds)
        );
        hasEmbeds = true;
      } else {
        const videoError = el(
          "div",
          { class: "media-error" },
          "📺 No video found"
        );
        statusContainer.appendChild(videoError);
      }

      // Try to show audio player using base filename
      if (baseFilename && baseFilename !== null && hasAudio) {
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

    if (hasPdf) {
      console.log("PDF found, creating viewer");
      createPdfViewer();
    } else {
      console.log("PDF not found, skipping viewer creation");
    }

    function createPdfViewer() {
      const pdfWrap = el("div");
      content.appendChild(pdfWrap);
      import('/pdf-reader.mjs').then(({ PDFReader, autoUpdatesEnabled }) => {
        if (pdfWrap.isConnected) new PDFReader(pdfWrap, pdfPath, {
          autoUpdate: autoUpdatesEnabled(relativePath),
        });
      }).catch(error => {
        console.error(error);
        pdfWrap.appendChild(el("a", { href: pdfPath }, "Open PDF"));
      });
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

  let wasMobileLayout = window.innerWidth <= 1024;

  // Update position on resize
  window.addEventListener("resize", () => {
    const isMobileLayout = window.innerWidth <= 1024;
    const crossedLayoutBreakpoint = isMobileLayout !== wasMobileLayout;
    wasMobileLayout = isMobileLayout;

    if (!isMobileLayout) {
      closeNav();
    } else {
      checkAutoOpen();
    }

    // Refresh PDF display only when switching between mobile/desktop layouts.
    // Mobile browser chrome changes can fire resize while scrolling.
    if (!crossedLayoutBreakpoint) {
      return;
    }

    const activeItem = document.querySelector("nav li.active");
    if (activeItem) {
      // Small delay to ensure layout has updated
      setTimeout(() => {
        activeItem.click();
      }, 100);
    }
  });
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
