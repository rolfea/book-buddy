const TEMPLATE = `
<style>
  :host { display: block; }
  .wrap { display: flex; flex-direction: column; gap: 0.75rem; align-items: flex-start; }
  video { max-width: 100%; border-radius: 8px; background: #000; width: 400px; height: 300px; }
  canvas { max-width: 100%; border-radius: 8px; border: 1px solid #555; background: #111; width: 400px; height: 300px; }
  button { padding: 0.5rem 1rem; border: none; border-radius: 6px; background: #1a1a2e; color: #fff; font-size: 0.95rem; cursor: pointer; }
  button:hover { background: #2d2d5e; }
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
  <button id="capture">Capture Frame</button>
  <canvas></canvas>
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
    this._scanned = [];
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
      this._stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      video.srcObject = this._stream;
      this._detector = new BarcodeDetector({ formats: ["ean_13", "ean_8"] });
      statusEl.textContent = "Camera ready. Press Capture Frame to scan.";
    } catch (err) {
      statusEl.textContent = `Camera error: ${err.message}`;
      statusEl.className = "error";
    }

    this.shadowRoot.getElementById("capture").addEventListener("click", () => this._capture());
  }

  disconnectedCallback() {
    if (this._stream) {
      this._stream.getTracks().forEach((t) => t.stop());
      this._stream = null;
    }
  }

  async _capture() {
    const video = this.shadowRoot.querySelector("video");
    const canvas = this.shadowRoot.querySelector("canvas");
    const statusEl = this.shadowRoot.getElementById("status");

    if (!this._stream || !this._detector) {
      statusEl.textContent = "Camera not ready.";
      return;
    }

    // Draw current video frame to canvas
    const ctx = canvas.getContext("2d");
    canvas.width = video.videoWidth || 400;
    canvas.height = video.videoHeight || 300;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    try {
      // Use ImageCapture if available, otherwise fall back to canvas ImageData
      let imageBitmap;
      if ("ImageCapture" in window) {
        const track = this._stream.getVideoTracks()[0];
        const ic = new ImageCapture(track);
        imageBitmap = await ic.grabFrame();
        // Redraw the grabbed frame for visual feedback
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        canvas.width = imageBitmap.width;
        canvas.height = imageBitmap.height;
        ctx.drawImage(imageBitmap, 0, 0);
      } else {
        imageBitmap = await createImageBitmap(canvas);
      }

      const detected = await this._detector.detect(imageBitmap);
      if (detected.length === 0) {
        statusEl.textContent = "No barcode detected — try again.";
        return;
      }

      const isbn = detected[0].rawValue;
      statusEl.textContent = `Detected: ${isbn}`;

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
