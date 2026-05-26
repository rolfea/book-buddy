const TEMPLATE = `
<style>
  :host { display: block; }
  .wrap { display: flex; flex-direction: column; gap: 0.75rem; align-items: flex-start; width: 100%; }
  
  .video-container {
    position: relative;
    border-radius: 8px;
    overflow: hidden;
    width: 100%;
    max-width: 480px;
    aspect-ratio: 4 / 3;
    background: #000;
  }
  
  video {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  
  .overlay {
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 1rem;
    font-family: system-ui, sans-serif;
    font-weight: 600;
    font-size: 1.15rem;
    color: #fff;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.3s ease;
    background: rgba(0, 0, 0, 0.6);
    z-index: 10;
  }
  
  .overlay.loading {
    opacity: 1;
    background: rgba(26, 26, 46, 0.8);
  }
  
  .overlay.success {
    opacity: 1;
    background: rgba(39, 174, 96, 0.85);
  }
  
  .overlay.error {
    opacity: 1;
    background: rgba(192, 57, 43, 0.85);
  }
  
  .controls { display: flex; gap: 0.5rem; }
  button { padding: 0.5rem 1rem; border: none; border-radius: 6px; background: #1a1a2e; color: #fff; font-size: 0.95rem; cursor: pointer; }
  button:hover { background: #2d2d5e; }
  #toggle-scan { background: #27ae60; }
  #toggle-scan:hover { background: #1e8449; }
  p { font-family: system-ui, sans-serif; font-size: 0.9rem; }
  .error { color: #c0392b; }
</style>
<div class="wrap">
  <div class="video-container">
    <video autoplay playsinline></video>
    <div id="overlay" class="overlay"></div>
  </div>
  <div class="controls">
    <button id="toggle-scan">Pause Auto-Scanning</button>
    <button id="capture">Capture Frame</button>
  </div>
  <p id="status">Waiting for camera…</p>
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
    this._isScanning = false;
    this._scanTimeoutId = null;
    this._resumeTimeoutId = null;
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
      this._stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } 
      });
      video.srcObject = this._stream;
      this._detector = new BarcodeDetector({ formats: ["ean_13", "ean_8"] });
      
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
      this._clearOverlay();
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
    if (this._resumeTimeoutId) {
      clearTimeout(this._resumeTimeoutId);
      this._resumeTimeoutId = null;
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

      // Pause scanning on detection
      this._updateScanState(false);
      this._showOverlay("loading", `Adding book...<br><span style="font-size: 0.9rem; font-weight: normal; margin-top: 0.5rem;">ISBN: ${isbn}</span>`);

      this.dispatchEvent(new CustomEvent("isbn-detected", {
        bubbles: true,
        composed: true,
        detail: { isbn },
      }));
    } catch (err) {
      statusEl.textContent = `Detection error: ${err.message}`;
      statusEl.className = "error";
    } finally {
      if (imageBitmap && typeof imageBitmap.close === "function") {
        imageBitmap.close();
      }
    }
  }

  // Public HUD controls
  markSuccess(title) {
    this._showOverlay("success", `Added to Library!<br><span style="font-size: 0.95rem; font-weight: 400; margin-top: 0.5rem; font-style: italic;">${title}</span>`);
    
    if (this._resumeTimeoutId) clearTimeout(this._resumeTimeoutId);
    this._resumeTimeoutId = setTimeout(() => {
      this._clearOverlay();
      this._updateScanState(true);
      this._scanLoop();
    }, 2000);
  }

  markFailure(errorMsg) {
    this._showOverlay("error", `Failed to add book<br><span style="font-size: 0.9rem; font-weight: 400; margin-top: 0.5rem;">${errorMsg}</span>`);
    
    if (this._resumeTimeoutId) clearTimeout(this._resumeTimeoutId);
    this._resumeTimeoutId = setTimeout(() => {
      this._clearOverlay();
      this._updateScanState(true);
      this._scanLoop();
    }, 3500);
  }

  _showOverlay(type, html) {
    const overlay = this.shadowRoot.getElementById("overlay");
    if (!overlay) return;
    overlay.className = `overlay ${type}`;
    overlay.innerHTML = html;
  }

  _clearOverlay() {
    const overlay = this.shadowRoot.getElementById("overlay");
    if (overlay) {
      overlay.className = "overlay";
      overlay.innerHTML = "";
    }
    if (this._resumeTimeoutId) {
      clearTimeout(this._resumeTimeoutId);
      this._resumeTimeoutId = null;
    }
  }
}

customElements.define("isbn-scanner", IsbnScanner);
