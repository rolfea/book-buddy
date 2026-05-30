const TEMPLATE = `
<style>
  :host { display: block; }
  .wrap { display: flex; flex-direction: column; gap: 0.75rem; align-items: flex-start; width: 100%; }

  .video-container {
    position: relative;
    border-radius: 4px;
    overflow: hidden;
    width: 100%;
    max-width: 420px;
    aspect-ratio: 3 / 4;
    background: #111;
    border: 1px solid rgba(120, 105, 80, 0.25);
    box-shadow: 0 4px 20px rgba(44, 36, 22, 0.15);
  }

  /* Neutral viewfinder frame — simple 1px white rect, no glows */
  .video-container::before {
    content: '';
    position: absolute;
    top: 25%; left: 12%; right: 12%; bottom: 25%;
    border: 1px solid rgba(255, 255, 255, 0.55);
    border-radius: 2px;
    pointer-events: none;
    z-index: 5;
    box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.45);
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
    font-family: 'Lora', Georgia, serif;
    font-weight: 600;
    font-size: 1rem;
    color: #fff;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.3s ease;
    z-index: 10;
  }

  .overlay.loading {
    opacity: 1;
    background: rgba(20, 20, 15, 0.82);
  }

  .overlay.success {
    opacity: 1;
    background: rgba(40, 70, 40, 0.88);
  }

  .overlay.error {
    opacity: 1;
    background: rgba(90, 30, 30, 0.88);
  }

  .controls {
    display: flex;
    gap: 0.6rem;
    margin-top: 0.1rem;
  }

  button {
    padding: 0.5rem 1.1rem;
    border: 1px solid rgba(120, 105, 80, 0.3);
    border-radius: 3px;
    background: #faf7f2;
    color: #2c2416;
    font-family: 'Lora', Georgia, serif;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  button:hover {
    background: #ede8da;
    border-color: rgba(120, 105, 80, 0.5);
  }

  #toggle-scan {
    background: #3c5a3c;
    color: #faf8f3;
    border-color: #3c5a3c;
  }

  #toggle-scan:hover {
    background: #4a7050;
    border-color: #4a7050;
  }

  p {
    font-family: 'Lora', Georgia, serif;
    font-size: 0.85rem;
    color: #6b5c42;
    font-style: italic;
  }

  .error { color: #7a2828; font-style: normal; font-weight: 600; }

  .overlay-title {
    font-size: 1rem;
    font-weight: 600;
  }
  .overlay-subtitle {
    font-size: 0.9rem;
    font-weight: 400;
    margin-top: 0.5rem;
  }
  .overlay.success .overlay-subtitle {
    font-size: 0.95rem;
    font-style: italic;
  }
</style>
<div class="wrap">
  <div class="video-container">
    <video autoplay playsinline></video>
    <div id="overlay" class="overlay">
      <div class="overlay-title"></div>
      <div class="overlay-subtitle"></div>
    </div>
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
    // eslint-disable-next-line no-unsanitized/property
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
      this._showOverlay("loading", "Adding book...", `ISBN: ${isbn}`);

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
    this._showOverlay("success", "Added to Library!", title);
    
    if (this._resumeTimeoutId) clearTimeout(this._resumeTimeoutId);
    this._resumeTimeoutId = setTimeout(() => {
      this._clearOverlay();
      this._updateScanState(true);
      this._scanLoop();
    }, 2000);
  }

  markFailure(errorMsg) {
    this._showOverlay("error", "Failed to add book", errorMsg);
    
    if (this._resumeTimeoutId) clearTimeout(this._resumeTimeoutId);
    this._resumeTimeoutId = setTimeout(() => {
      this._clearOverlay();
      this._updateScanState(true);
      this._scanLoop();
    }, 3500);
  }

  _showOverlay(type, titleText, subtitleText) {
    const overlay = this.shadowRoot.getElementById("overlay");
    if (!overlay) return;
    overlay.className = `overlay ${type}`;
    
    const titleEl = overlay.querySelector(".overlay-title");
    const subtitleEl = overlay.querySelector(".overlay-subtitle");
    if (titleEl) titleEl.textContent = titleText;
    if (subtitleEl) subtitleEl.textContent = subtitleText || "";
  }

  _clearOverlay() {
    const overlay = this.shadowRoot.getElementById("overlay");
    if (overlay) {
      overlay.className = "overlay";
      const titleEl = overlay.querySelector(".overlay-title");
      const subtitleEl = overlay.querySelector(".overlay-subtitle");
      if (titleEl) titleEl.textContent = "";
      if (subtitleEl) subtitleEl.textContent = "";
    }
    if (this._resumeTimeoutId) {
      clearTimeout(this._resumeTimeoutId);
      this._resumeTimeoutId = null;
    }
  }
}

customElements.define("isbn-scanner", IsbnScanner);
