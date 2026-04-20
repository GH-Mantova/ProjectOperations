// Flat ESLint config for @project-ops/web (React + Vite + TypeScript).
// Intentionally conservative: parses TypeScript/JSX, catches real bugs,
// and defers style rules to Prettier / team convention.
const tsParser = require("@typescript-eslint/parser");
const tsPlugin = require("@typescript-eslint/eslint-plugin");
const reactHooksPlugin = require("eslint-plugin-react-hooks");

module.exports = [
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      ".tmp-smoke/**",
      "src/**/*.js",
      "vite.config.js",
      "*.config.js"
    ]
  },
  {
    files: ["src/**/*.ts", "src/**/*.tsx"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
        ecmaFeatures: { jsx: true }
      },
      globals: {
        window: "readonly",
        document: "readonly",
        navigator: "readonly",
        fetch: "readonly",
        console: "readonly",
        localStorage: "readonly",
        sessionStorage: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        URL: "readonly",
        URLSearchParams: "readonly",
        HTMLElement: "readonly",
        HTMLDivElement: "readonly",
        HTMLButtonElement: "readonly",
        HTMLInputElement: "readonly",
        HTMLCanvasElement: "readonly",
        Element: "readonly",
        Node: "readonly",
        Event: "readonly",
        KeyboardEvent: "readonly",
        MouseEvent: "readonly",
        CustomEvent: "readonly",
        FormData: "readonly",
        File: "readonly",
        Blob: "readonly",
        AbortController: "readonly",
        BodyInit: "readonly",
        RequestInit: "readonly",
        Response: "readonly",
        Request: "readonly",
        process: "readonly",
        __APP_VERSION__: "readonly"
      }
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      "react-hooks": reactHooksPlugin
    },
    rules: {
      "no-unused-vars": "off",
      "no-undef": "off",
      "react-hooks/rules-of-hooks": "error"
    }
  }
];
