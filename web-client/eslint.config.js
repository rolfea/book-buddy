import js from "@eslint/js";

// Globals available in all browser source files
const browserGlobals = {
  // Core
  window: "readonly",
  document: "readonly",
  location: "readonly",
  history: "readonly",
  navigator: "readonly",
  console: "readonly",
  alert: "readonly",
  // Fetch / network
  fetch: "readonly",
  URL: "readonly",
  // Timers
  setTimeout: "readonly",
  clearTimeout: "readonly",
  setInterval: "readonly",
  clearInterval: "readonly",
  // Web Components / DOM
  customElements: "readonly",
  HTMLElement: "readonly",
  CustomEvent: "readonly",
  Event: "readonly",
  MutationObserver: "readonly",
  // Media / Canvas APIs
  MediaStream: "readonly",
  ImageCapture: "readonly",
  BarcodeDetector: "readonly",
  createImageBitmap: "readonly",
};

// Globals available in Node.js scripts and test files
const nodeGlobals = {
  process: "readonly",
  global: "writable",
  setTimeout: "readonly",
  clearTimeout: "readonly",
  setInterval: "readonly",
  clearInterval: "readonly",
  console: "readonly",
  URL: "readonly",
};

export default [
  js.configs.recommended,

  // ── Browser source files ──────────────────────────────────────────────
  {
    files: ["**/*.js"],
    ignores: ["node_modules/**", "test/**"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: browserGlobals,
    },
    rules: {
      "no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          caughtErrors: "all",
        },
      ],
      "no-undef": "error",
      "no-unreachable": "error",
      "no-duplicate-case": "error",
      "no-self-assign": "error",
      "no-var": "error",
      "prefer-const": "error",
      "eqeqeq": ["error", "always"],
    },
  },

  // ── Node.js scripts (generate-config, etc.) ───────────────────────────
  {
    files: ["**/*.mjs"],
    ignores: ["node_modules/**"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: nodeGlobals,
    },
    rules: {
      "no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "no-undef": "error",
      "no-var": "error",
      "prefer-const": "error",
    },
  },

  // ── Test files ────────────────────────────────────────────────────────
  {
    files: ["test/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...nodeGlobals,
        // happy-dom injects these onto global.* in test setup files
        CustomEvent: "readonly",
        Event: "readonly",
        HTMLElement: "readonly",
      },
    },
    rules: {
      "no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "no-undef": "error",
      "no-var": "error",
      "prefer-const": "error",
    },
  },
];
