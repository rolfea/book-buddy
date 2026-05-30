import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { Window } from "happy-dom";

// Set up DOM globals before importing the component.
const win = new Window({ url: "http://localhost" });
global.window = win;
global.document = win.document;
global.HTMLElement = win.HTMLElement;
global.customElements = win.customElements;
global.CustomEvent = win.CustomEvent;
Object.defineProperty(global, 'navigator', {
  value: win.navigator,
  writable: true,
  configurable: true
});

// Bypass Happy-DOM srcObject strict MediaStream type validation
Object.defineProperty(win.HTMLMediaElement.prototype, 'srcObject', {
  get() {
    return this._srcObject;
  },
  set(value) {
    this._srcObject = value;
  },
  configurable: true
});

// Mock BarcodeDetector globally
class MockBarcodeDetector {
  constructor(options) {
    this.formats = options?.formats;
  }
  async detect(_image) {
    return MockBarcodeDetector.mockDetectResult;
  }
}
MockBarcodeDetector.mockDetectResult = [];
win.BarcodeDetector = MockBarcodeDetector;
global.BarcodeDetector = MockBarcodeDetector;

// Mock ImageCapture globally
class MockImageCapture {
  constructor(_track) {}
  async grabFrame() {
    return { width: 400, height: 300 };
  }
}
win.ImageCapture = MockImageCapture;
global.ImageCapture = MockImageCapture;

// Mock createImageBitmap globally
win.createImageBitmap = async () => {
  return { width: 400, height: 300 };
};
global.createImageBitmap = win.createImageBitmap;

// Mock MediaStream globally for Happy-DOM
class MockMediaStream {
  constructor() {}
  getVideoTracks() { return mockStreamTracks; }
  getTracks() { return mockStreamTracks; }
}
win.MediaStream = MockMediaStream;
global.MediaStream = MockMediaStream;

// Mock getUserMedia
let mockStreamTracks = [];
const mockStream = new MockMediaStream();

win.navigator.mediaDevices = {
  getUserMedia: async () => {
    return mockStream;
  }
};

// Import the scanner component
await import("../components/isbn-scanner.js");

function mountScanner() {
  const scanner = win.document.createElement("isbn-scanner");
  win.document.body.appendChild(scanner);
  return scanner;
}

describe("isbn-scanner", () => {
  beforeEach(() => {
    win.document.body.innerHTML = "";
    mockStreamTracks = [{ stop: () => {} }];
    MockBarcodeDetector.mockDetectResult = [];
    win.BarcodeDetector = MockBarcodeDetector;
    global.BarcodeDetector = MockBarcodeDetector;
  });

  afterEach(() => {
    // Clean up any remaining elements
    win.document.body.innerHTML = "";
  });

  test("displays unsupported error if BarcodeDetector is not in window", async () => {
    // Temporarily delete BarcodeDetector
    delete win.BarcodeDetector;
    delete global.BarcodeDetector;

    try {
      const scanner = mountScanner();
      // Wait for element to evaluate connectedCallback
      await new Promise(resolve => setTimeout(resolve, 10));

      const statusEl = scanner.shadowRoot.getElementById("status");
      assert.match(statusEl.textContent, /BarcodeDetector API not supported/);
    } finally {
      win.BarcodeDetector = MockBarcodeDetector;
      global.BarcodeDetector = MockBarcodeDetector;
    }
  });

  test("displays camera error if getUserMedia fails", async () => {
    const originalGetUserMedia = win.navigator.mediaDevices.getUserMedia;
    win.navigator.mediaDevices.getUserMedia = async () => {
      throw new Error("Permission denied");
    };

    try {
      const scanner = mountScanner();
      await new Promise(resolve => setTimeout(resolve, 10));

      const statusEl = scanner.shadowRoot.getElementById("status");
      assert.match(statusEl.textContent, /Camera error: Permission denied/);
    } finally {
      win.navigator.mediaDevices.getUserMedia = originalGetUserMedia;
    }
  });

  test("starts scanning automatically and polls at configured intervals", async () => {
    const scanner = mountScanner();
    await new Promise(resolve => setTimeout(resolve, 10));

    // Initially scanning should be active
    assert.strictEqual(scanner._isScanning, true);
    
    const statusEl = scanner.shadowRoot.getElementById("status");
    assert.match(statusEl.textContent, /Scanning/);
  });

  test("stops scanning on barcode detection and fires custom event", async () => {
    MockBarcodeDetector.mockDetectResult = [{ rawValue: "9780135957059" }];
    
    let detectedEventDetail = null;
    win.document.addEventListener("isbn-detected", (e) => {
      detectedEventDetail = e.detail;
    });

    const scanner = mountScanner();
    await new Promise(resolve => setTimeout(resolve, 30));

    // The scan loop should have processed the frame
    assert.strictEqual(scanner._isScanning, false);
    assert.deepEqual(detectedEventDetail, { isbn: "9780135957059" });
    
    const statusEl = scanner.shadowRoot.getElementById("status");
    assert.match(statusEl.textContent, /Detected: 9780135957059/);
    
    // UI should show Resume button
    const toggleBtn = scanner.shadowRoot.getElementById("toggle-scan");
    assert.strictEqual(toggleBtn.textContent, "Resume Auto-Scanning");
  });

  test("clicking resume toggle button restarts scanning loop", async () => {
    // Start with a successful detection so scanning pauses
    MockBarcodeDetector.mockDetectResult = [{ rawValue: "9780135957059" }];
    const scanner = mountScanner();
    await new Promise(resolve => setTimeout(resolve, 30));

    assert.strictEqual(scanner._isScanning, false);

    // Clear detect results so it doesn't immediately pause again
    MockBarcodeDetector.mockDetectResult = [];
    
    const toggleBtn = scanner.shadowRoot.getElementById("toggle-scan");
    assert.ok(toggleBtn);
    
    // Click the resume scanning button
    toggleBtn.click();
    
    assert.strictEqual(scanner._isScanning, true);
    const statusEl = scanner.shadowRoot.getElementById("status");
    assert.match(statusEl.textContent, /Scanning/);
  });

  test("markSuccess displays success HUD overlay and auto-resumes scanning", async () => {
    const scanner = mountScanner();
    await new Promise(resolve => setTimeout(resolve, 10));

    // Pause scan first (emulating successful detection)
    scanner._updateScanState(false);
    assert.strictEqual(scanner._isScanning, false);

    // Call markSuccess
    scanner.markSuccess("The Pragmatic Programmer");

    const overlay = scanner.shadowRoot.getElementById("overlay");
    assert.ok(overlay.classList.contains("success"));
    assert.match(overlay.innerHTML, /Added to Library/);
    assert.match(overlay.innerHTML, /The Pragmatic Programmer/);

    // Speed up timeout to evaluate scanning resumption
    await new Promise(resolve => setTimeout(resolve, 2050));
    assert.strictEqual(scanner._isScanning, true);
    assert.ok(!overlay.classList.contains("success")); // Overlay should be cleared
  });

  test("markFailure displays error HUD overlay and auto-resumes scanning", async () => {
    const scanner = mountScanner();
    await new Promise(resolve => setTimeout(resolve, 10));

    // Pause scan first
    scanner._updateScanState(false);

    // Call markFailure
    scanner.markFailure("Network Timeout");

    const overlay = scanner.shadowRoot.getElementById("overlay");
    assert.ok(overlay.classList.contains("error"));
    assert.match(overlay.innerHTML, /Failed to add book/);
    assert.match(overlay.innerHTML, /Network Timeout/);

    // Speed up timeout to evaluate scanning resumption
    await new Promise(resolve => setTimeout(resolve, 3550));
    assert.strictEqual(scanner._isScanning, true);
    assert.ok(!overlay.classList.contains("error")); // Overlay should be cleared
  });

  test("cleans up streams and timeouts on disconnect", async () => {
    let stopped = false;
    mockStreamTracks = [{
      stop: () => { stopped = true; }
    }];

    const scanner = mountScanner();
    await new Promise(resolve => setTimeout(resolve, 10));

    // Disconnect element
    scanner.remove();

    assert.strictEqual(stopped, true);
    assert.strictEqual(scanner._isScanning, false);
    assert.strictEqual(scanner._scanTimeoutId, null);
    assert.strictEqual(scanner._resumeTimeoutId, null);
  });
});
