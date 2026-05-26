const TEMPLATE = `
<style>
  :host { display: block; }
  .wrap { display: flex; flex-direction: column; gap: 0.75rem; align-items: flex-start; }
  video { max-width: 100%; border-radius: 8px; background: #000; width: 400px; height: 300px; }
  .controls { display: flex; gap: 0.5rem; }
  button { padding: 0.5rem 1rem; border: none; border-radius: 6px; background: #1a1a2e; color: #fff; font-size: 0.95rem; cursor: pointer; }
  button:hover { background: #2d2d5e; }
  #toggle-scan { background: #27ae60; }
  #toggle-scan:hover { background: #1e8449; }
  p { font-family: system-ui, sans-serif; font-size: 0.9rem; }
  .error { color: #c0392b; }
  ul { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 0.4rem; }
  li { background: #fff; border: 1px solid #ddd; border-radius: 6px; padding: 0.4rem 0.75rem; font-family: monospace; display: flex; gap: 0.5rem; align-items: center; }
  li button { font-size: 0.8rem; padding: 0.25rem 0.5rem; background: #27ae60; }
  li button:hover { background: #1e8449; }
</style>
<div class="wrap">
  <h2>Scan a Barcode</h2>
  <video autoplay playsinline></video>
  <div class="controls">
    <button id="toggle-scan">Pause Auto-Scanning</button>
    <button id="capture">Capture Frame</button>
  </div>
  <p id="status">Waiting for camera…</p>
  <p>Detected ISBNs:</p>
  <ul id="isbn-list"></ul>
</div>
`;

class IsbnScanner extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = TEMPLATE;
    this._stream = null;
    this._detector = null;
    this._imageCapture = null;
    this._scanned = [];
    this._isScanning = false;
    this._scanTimeoutId = null;
    this._wasScanningBeforeHide = false;
    this.scanIntervalMs = 500; // Configurable polling interval
  }

  async connectedCallback() {
    const statusEl = this.shadowRoot.getElementById("status");
    const video = this.shadowRoot.querySelector("video");

    // Check BarcodeDetector support
    if (!("BarcodeDetector" in window)) {
      statusEl.textContent = "BarcodeDetector API not supported in this browser.";
      statusEl.className = "error";
      return;
    }

    try {
      // 1. Optimize Resolution Constraint (1280x720 is ideal for fast mobile detection)
      this._stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } 
      });
      video.srcObject = this._stream;
      this._detector = new BarcodeDetector({ formats: ["ean_13", "ean_8"] });
      
      // 2. Cache ImageCapture instance once (reused on every frame to avoid garbage collection stutters)
      const track = this._stream.getVideoTracks()[0];
      if (track && "ImageCapture" in window) {
        this._imageCapture = new ImageCapture(track);
      }

      // Start auto-scanning automatically
      this._updateScanState(true);
      this._scanLoop();
    } catch (err) {
      statusEl.textContent = `Camera error: ${err.message}`;
      statusEl.className = "error";
    }

    this.shadowRoot.getElementById("capture").addEventListener("click", () => this._capture(true));
    this.shadowRoot.getElementById("toggle-scan").addEventListener("click", () => {
      if (this._isScanning) {
        this._updateScanState(false);
        const statusEl = this.shadowRoot.getElementById("status");
        if (statusEl) {
          statusEl.textContent = "Scanning paused.";
        }
      } else {
        this._updateScanState(true);
        this._scanLoop();
      }
    });

    // 4. Tab Visibility optimization: Pause scanning when tab is in background to save battery
    this._onVisibilityChange = () => {
      if (document.hidden && this._isScanning) {
        this._updateScanState(false);
        this._wasScanningBeforeHide = true;
      } else if (!document.hidden && this._wasScanningBeforeHide) {
        this._wasScanningBeforeHide = false;
        this._updateScanState(true);
        this._scanLoop();
      }
    };
    document.addEventListener("visibilitychange", this._onVisibilityChange);
  }

  disconnectedCallback() {
    this._isScanning = false;
    if (this._scanTimeoutId) {
      clearTimeout(this._scanTimeoutId);
      this._scanTimeoutId = null;
    }
    if (this._stream) {
      this._stream.getTracks().forEach((t) => t.stop());
      this._stream = null;
    }
    this._imageCapture = null;
    document.removeEventListener("visibilitychange", this._onVisibilityChange);
  }

  _updateScanState(isScanning) {
    this._isScanning = isScanning;
    const toggleBtn = this.shadowRoot.getElementById("toggle-scan");
    const statusEl = this.shadowRoot.getElementById("status");
    if (toggleBtn) {
      toggleBtn.textContent = isScanning ? "Pause Auto-Scanning" : "Resume Auto-Scanning";
    }
    if (statusEl && isScanning) {
      statusEl.textContent = "Scanning for barcodes...";
      statusEl.className = "";
    }
  }

  async _scanLoop() {
    if (!this._isScanning) return;

    try {
      await this._capture(false);
    } catch (err) {
      console.error("Frame capture failed during auto-scan", err);
    }

    if (this._isScanning) {
      this._scanTimeoutId = setTimeout(() => this._scanLoop(), this.scanIntervalMs);
    }
  }

  async _capture(isManual = false) {
    const video = this.shadowRoot.querySelector("video");
    const statusEl = this.shadowRoot.getElementById("status");

    if (!this._stream || !this._detector) {
      statusEl.textContent = "Camera not ready.";
      return;
    }

    let imageBitmap = null;
    try {
      // 3. Canvas-free extraction: Grab direct from ImageCapture or video element
      if (this._imageCapture) {
        imageBitmap = await this._imageCapture.grabFrame();
      } else {
        imageBitmap = await createImageBitmap(video);
      }

      const detected = await this._detector.detect(imageBitmap);
      if (detected.length === 0) {
        if (isManual) {
          statusEl.textContent = "No barcode detected — try again.";
        }
        return;
      }

      const isbn = detected[0].rawValue;
      statusEl.textContent = `Detected: ${isbn}`;
      statusEl.className = "";

      // Stop scanning on detection
      this._updateScanState(false);

      if (!this._scanned.includes(isbn)) {
        this._scanned.push(isbn);
        this._renderList();
        this.dispatchEvent(new CustomEvent("isbn-detected", {
          bubbles: true,
          composed: true,
          detail: { isbn },
        }));
      }
    } catch (err) {
      statusEl.textContent = `Detection error: ${err.message}`;
      statusEl.className = "error";
    } finally {
      // Explicitly release graphics memory for ImageBitmap
      if (imageBitmap && typeof imageBitmap.close === "function") {
        imageBitmap.close();
      }
    }
  }

  _renderList() {
    const ul = this.shadowRoot.getElementById("isbn-list");
    ul.innerHTML = this._scanned
      .map(
        (isbn) => `<li>${isbn} <button data-isbn="${isbn}">Add to Library</button></li>`
      )
      .join("");

    ul.querySelectorAll("button").forEach((btn) => {
      btn.addEventListener("click", () => {
        this.dispatchEvent(new CustomEvent("isbn-detected", {
          bubbles: true,
          composed: true,
          detail: { isbn: btn.dataset.isbn },
        }));
      });
    });
  }
}

customElements.define("isbn-scanner", IsbnScanner);
