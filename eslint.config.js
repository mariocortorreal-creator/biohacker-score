const js = require("@eslint/js");
const html = require("eslint-plugin-html");
const globals = require("globals");
const tsParser = require("@typescript-eslint/parser");

module.exports = [
  {
    ignores: ["node_modules/**", "www/**", "native-bridge.js", "android/**", "ios/**", "supabase/.temp/**"],
  },
  js.configs.recommended,

  // This config file itself runs under plain Node/CommonJS.
  {
    files: ["eslint.config.js"],
    languageOptions: {
      sourceType: "commonjs",
      globals: { ...globals.node },
    },
  },

  // Node-side tooling: build scripts and tests (CommonJS, matches package.json "type").
  {
    files: ["scripts/**/*.js", "test/**/*.js"],
    languageOptions: {
      sourceType: "commonjs",
      globals: { ...globals.node },
    },
  },
  // Node-side ESM tests (the *.test.mjs files added alongside the shared Edge Function modules).
  {
    files: ["test/**/*.mjs"],
    languageOptions: {
      sourceType: "module",
      globals: { ...globals.node },
    },
  },

  // Deno Edge Functions (supabase/functions/**) — Deno globals instead of Node's, and
  // the TS parser so type annotations / `!` non-null assertions don't fail to parse
  // (no separate type-check step in this repo — see CLAUDE.md — so this only catches
  // plain-JS mistakes, not type errors).
  {
    files: ["supabase/functions/**/*.ts"],
    languageOptions: {
      parser: tsParser,
      sourceType: "module",
      globals: { ...globals.browser, Deno: "readonly" },
    },
  },
  {
    files: ["supabase/functions/**/*.mjs"],
    languageOptions: {
      sourceType: "module",
      globals: { ...globals.browser, Deno: "readonly" },
    },
  },

  // src/native-bridge.js — bundled with esbuild, runs in the Capacitor WebView (browser + Capacitor globals).
  {
    files: ["src/**/*.js"],
    languageOptions: {
      sourceType: "module",
      globals: { ...globals.browser },
    },
  },

  // index.html — no build step, no module system (see CLAUDE.md): everything is one
  // inline <script> block using React.createElement, addressed via browser/CDN globals
  // (React, ReactDOM) plus window.Capacitor/window.CapacitorHealth injected by the
  // native shell.
  {
    files: ["index.html"],
    plugins: { html },
    languageOptions: {
      sourceType: "script",
      globals: {
        ...globals.browser,
        React: "readonly",
        ReactDOM: "readonly",
        dataLayer: "writable", // GA4 gtag.js snippet
      },
    },
    rules: {
      "no-unused-vars": "warn",
    },
  },

  {
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "no-undef": "error",
    },
  },
];
