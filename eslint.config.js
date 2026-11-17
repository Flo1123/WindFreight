import js from "@eslint/js";
import svelte from "eslint-plugin-svelte";
import globals from "globals";

export default [
  js.configs.recommended,
  ...svelte.configs.recommended,
  {
    languageOptions: {
      // CESIUM_BASE_URL is defined by vite.config.js
      globals: { ...globals.browser, CESIUM_BASE_URL: "readonly" },
    },
    rules: {
      "no-var": "error",
      "prefer-const": "error",
      eqeqeq: "error",
    },
  },
  // Svelte writes props as `let { … } = $props()`; svelte/prefer-const ignores that
  {
    files: ["**/*.svelte", "**/*.svelte.js"],
    rules: {
      "prefer-const": "off",
      "svelte/prefer-const": "error",
    },
  },
  // generated route data
  { ignores: ["dist/", "src/routes.js"] },
];
