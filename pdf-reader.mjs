import * as pdfjs from "./vendor/pdfjs/pdf.mjs";
import {
  EventBus,
  PDFViewer,
  PDFLinkService,
} from "./vendor/pdfjs/pdf_viewer.mjs";
import { normalize, locateAnchor } from "./pdf-position.mjs";
pdfjs.GlobalWorkerOptions.workerSrc = "/vendor/pdfjs/pdf.worker.mjs";
const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const FULL_SEFER = "09 - Misc/Final Sefer";
export const autoUpdatesEnabled = (path) => path === FULL_SEFER;
export class PDFReader {
  constructor(
    host,
    url,
    { autoUpdate = false, manifest = "/pdf-version.json" } = {},
  ) {
    this.host = host;
    this.url = url;
    this.manifest = manifest;
    this.dead = false;
    this.lastInteraction = 0;
    host.className = "pdf-reader";
    this.toolbar = document.createElement("div");
    this.toolbar.className = "pdf-toolbar";
    this.stage = document.createElement("div");
    this.stage.className = "pdf-stage";
    this.status = document.createElement("span");
    this.status.className = "pdf-status";
    this.status.setAttribute("role", "status");
    host.append(this.toolbar, this.stage);
    const button = (label, action) => {
      const b = document.createElement("button");
      b.textContent = label;
      b.type = "button";
      b.onclick = action;
      this.toolbar.append(b);
      return b;
    };
    this.toolbar.setAttribute("role", "toolbar");
    this.toolbar.setAttribute("aria-label", "PDF controls");
    this.expand = button("Fullscreen", () => this.toggleFullscreen());
    this.expand.className = "pdf-fullscreen";
    this.expand.setAttribute("aria-expanded", "false");
    const zoomOut = button("−", () => this.zoom(1 / 1.2));
    zoomOut.setAttribute("aria-label", "Zoom out");
    zoomOut.title = "Zoom out";
    const zoomIn = button("+", () => this.zoom(1.2));
    zoomIn.setAttribute("aria-label", "Zoom in");
    zoomIn.title = "Zoom in";
    const zoomGroup = document.createElement("div");
    zoomGroup.className = "pdf-zoom";
    zoomGroup.setAttribute("role", "group");
    zoomGroup.setAttribute("aria-label", "Zoom");
    zoomGroup.append(zoomOut, zoomIn);
    this.toolbar.append(zoomGroup);
    const download = document.createElement("a");
    download.href = url;
    download.download = "";
    download.textContent = "Download";
    this.toolbar.append(download, this.status);
    this.onVisibility = () => {
      if (!document.hidden) this.checkVersion();
    };
    this.ready = this.start(autoUpdate).catch((e) => {
      if (!this.dead)
        this.status.textContent =
          "PDF could not load. Please retry or download.";
      console.error(e);
    });
    this.observer = new MutationObserver(() => {
      if (!host.isConnected) this.destroy();
    });
    this.observer.observe(document.body, { childList: true, subtree: true });
  }
  async versionInfo() {
    const res = await fetch(`${this.manifest}?check=${Date.now()}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error("Version check failed");
    const info = await res.json();
    if (!/^[a-f0-9]{64}$/.test(info.version) || typeof info.url !== "string")
      throw new Error("Invalid PDF version");
    return info;
  }
  async start(autoUpdate) {
    let info;
    if (autoUpdate) {
      try {
        info = await this.versionInfo();
      } catch {}
    }
    this.active = await this.load(
      info ? `${info.url}?v=${info.version}` : this.url,
    );
    if (this.dead) return this.disposeView(this.active);
    this.active.container.classList.remove("preparing");
    this.version = info?.version;
    if (autoUpdate) {
      this.timer = setInterval(() => this.checkVersion(), 20000);
      document.addEventListener("visibilitychange", this.onVisibility);
    }
  }
  async load(url, scale) {
    const container = document.createElement("div");
    container.className = "pdf-scroll preparing";
    const pages = document.createElement("div");
    pages.className = "pdfViewer";
    container.append(pages);
    this.stage.append(container);
    const abort = new AbortController();
    const bus = new EventBus(),
      links = new PDFLinkService({ eventBus: bus });
    const viewer = new PDFViewer({
      abortSignal: abort.signal,
      container,
      viewer: pages,
      eventBus: bus,
      linkService: links,
      annotationEditorMode: -1,
      maxCanvasPixels: 4096 * 4096,
      imageResourcesPath: "/vendor/pdfjs/images/",
    });
    links.setViewer(viewer);
    const task = pdfjs.getDocument({
      url,
      cMapUrl: "/vendor/pdfjs/cmaps/",
      cMapPacked: true,
      standardFontDataUrl: "/vendor/pdfjs/standard_fonts/",
      isEvalSupported: false,
    });
    const view = { container, pages, bus, viewer, links, task, abort };
    this.loading = view;
    const interact = () => {
      if (view !== this.active) return;
      this.lastInteraction = performance.now();
      this.generation = (this.generation || 0) + 1;
    };
    container.addEventListener("scroll", interact, { passive: true });
    container.addEventListener("wheel", interact, { passive: true });
    container.addEventListener(
      "touchstart",
      () => {
        this.touching = true;
        interact();
      },
      { passive: true },
    );
    for (const event of ["touchend", "touchcancel"])
      container.addEventListener(
        event,
        () => {
          this.touching = false;
          interact();
        },
        { passive: true },
      );
    try {
      view.doc = await task.promise;
      const initialized = new Promise((resolve) =>
        bus.on("pagesinit", resolve),
      );
      links.setDocument(view.doc);
      viewer.setDocument(view.doc);
      await initialized;
      viewer.currentScaleValue = scale || "page-width";
      await this.renderPage(view, 1);
      this.loading = null;
      return view;
    } catch (e) {
      await this.disposeView(view);
      throw e;
    }
  }
  async renderPage(view, page) {
    view.viewer.currentPageNumber = page;
    view.viewer.update();
    const start = performance.now();
    while (
      !view.viewer.getPageView(page - 1)?.textLayer?.div?.querySelector("span")
    ) {
      if (this.dead || performance.now() - start > 20000)
        throw new Error("Text rendering timed out");
      // Scanned pages have no text: canvas completion is sufficient.
      const p = view.viewer.getPageView(page - 1);
      if (
        p?.renderingState === 3 &&
        p.textLayer?.div?.querySelector(".endOfContent")
      )
        break;
      await delay(20);
    }
    await frame();
    await frame();
  }
  spans(view, page) {
    return [
      ...view.viewer
        .getPageView(page - 1)
        .div.querySelectorAll('.textLayer span[role="presentation"]'),
    ].filter((s) => normalize(s.textContent));
  }
  capture(view = this.active) {
    const bounds = view.container.getBoundingClientRect();
    const cx = bounds.left + bounds.width / 2,
      cy = bounds.top + bounds.height / 2;
    let best;
    for (const page of view.pages.querySelectorAll(".page")) {
      const rect = page.getBoundingClientRect();
      if (rect.bottom < bounds.top || rect.top > bounds.bottom) continue;
      const spans = this.spans(view, Number(page.dataset.pageNumber));
      spans.forEach((span, index) => {
        const r = span.getBoundingClientRect();
        if (r.bottom < bounds.top || r.top > bounds.bottom) return;
        const distance = Math.abs(r.top - cy) + Math.abs(r.left - cx) * 0.05;
        if (!best || distance < best.distance)
          best = { span, index, spans, page, rect, distance };
      });
    }
    if (best) {
      const { span, index, spans, page, rect } = best,
        r = span.getBoundingClientRect();
      const neighbors = spans
        .slice(Math.max(0, index - 3), index + 4)
        .filter((s) => s !== span)
        .map((s) => {
          const n = s.getBoundingClientRect();
          return {
            text: s.textContent,
            dx: n.left - r.left,
            dy: n.top - r.top,
          };
        });
      return {
        neighbors,
        text: span.textContent,
        before: spans
          .slice(Math.max(0, index - 3), index)
          .map((s) => s.textContent),
        after: spans.slice(index + 1, index + 4).map((s) => s.textContent),
        page: Number(page.dataset.pageNumber),
        x: r.left,
        y: r.top,
        rx: (r.left - rect.left) / rect.width,
        ry: (r.top - rect.top) / rect.height,
        scale: view.viewer.currentScale,
      };
    }
    const page = view.viewer.getPageView(view.viewer.currentPageNumber - 1).div,
      r = page.getBoundingClientRect();
    return {
      text: "",
      before: [],
      after: [],
      page: view.viewer.currentPageNumber,
      x: cx,
      y: cy,
      rx: (cx - r.left) / r.width,
      ry: (cy - r.top) / r.height,
      scale: view.viewer.currentScale,
    };
  }
  async restore(view, anchor, match) {
    view.viewer.currentScale = anchor.scale;
    const page = Math.min(match?.page || anchor.page, view.doc.numPages);
    await this.renderPage(view, page);
    const spans = this.spans(view, page);
    const span = match
      ? spans[match.index]
      : spans.find((s) => normalize(s.textContent) === normalize(anchor.text));
    const bounds = view.container.getBoundingClientRect(),
      rect = view.viewer.getPageView(page - 1).div.getBoundingClientRect();
    const r = span?.getBoundingClientRect();
    view.container.scrollLeft +=
      (r?.left ?? rect.left + rect.width * anchor.rx) -
      anchor.x -
      (match?.dx || 0);
    view.container.scrollTop +=
      (r?.top ?? rect.top + rect.height * anchor.ry) -
      anchor.y -
      (match?.dy || 0);
    // Wait for every visible canvas, including an adjacent page, before revealing.
    const started = performance.now();
    while (!this.dead) {
      view.viewer.update();
      const b = view.container.getBoundingClientRect();
      const visible = [...view.pages.querySelectorAll(".page")].filter((p) => {
        const r = p.getBoundingClientRect();
        return r.bottom > b.top && r.top < b.bottom;
      });
      if (
        visible.every(
          (p) =>
            view.viewer.getPageView(Number(p.dataset.pageNumber) - 1)
              .renderingState === 3,
        )
      )
        break;
      if (performance.now() - started > 20000)
        throw new Error("Visible pages not ready");
      await delay(20);
    }
    await frame();
  }
  async idle() {
    while (
      !this.dead &&
      (this.touching || performance.now() - this.lastInteraction < 350)
    )
      await delay(50);
  }
  async checkVersion() {
    if (this.busy || this.dead || !this.active) return;
    this.busy = true;
    let replacement;
    try {
      const info = await this.versionInfo();
      if (info.version === this.version) return;
      replacement = await this.load(
        `${info.url}?v=${info.version}`,
        this.active.viewer.currentScale,
      );
      while (!this.dead) {
        await this.idle();
        const generation = this.generation;
        const anchor = this.capture();
        const match = anchor.text
          ? await locateAnchor(replacement.doc, anchor, () => this.dead)
          : null;
        await this.restore(replacement, anchor, match);
        await this.idle();
        if (generation !== this.generation) continue;
        const old = this.active;
        replacement.container.classList.remove("preparing");
        old.container.classList.add("preparing");
        this.active = replacement;
        replacement = null;
        this.version = info.version;
        await this.disposeView(old);
        break;
      }
    } catch (e) {
      if (!this.dead) console.warn("PDF update postponed", e);
    } finally {
      if (replacement) await this.disposeView(replacement);
      this.busy = false;
    }
  }
  async zoom(factor) {
    if (!this.active) return;
    this.generation = (this.generation || 0) + 1;
    const anchor = this.capture();
    anchor.scale *= factor;
    await this.restore(this.active, anchor);
  }
  async toggleFullscreen() {
    if (!this.active) return;
    this.generation = (this.generation || 0) + 1;
    const anchor = this.capture();
    this.host.classList.toggle("expanded");
    this.expand.textContent = this.host.classList.contains("expanded")
      ? "Exit fullscreen"
      : "Fullscreen";
    this.expand.setAttribute(
      "aria-expanded",
      String(this.host.classList.contains("expanded")),
    );
    // A fixed overlay also works on iPhone; the same viewer and scroll element survive.
    await frame();
    await frame();
    await this.restore(this.active, anchor);
  }
  async disposeView(view) {
    if (!view || view.disposed) return;
    view.disposed = true;
    view.abort.abort();
    view.viewer.setDocument(null);
    view.links.setDocument(null);
    view.container.remove();
    await view.task.destroy();
  }
  destroy() {
    if (this.dead) return;
    this.dead = true;
    clearInterval(this.timer);
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.observer.disconnect();
    void this.disposeView(this.active);
    if (this.loading !== this.active) void this.disposeView(this.loading);
  }
}
