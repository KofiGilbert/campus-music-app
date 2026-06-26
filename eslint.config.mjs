// Flat ESLint config for the monorepo (ESLint 9).
//
// Philosophy for Phase 0: errors-only baseline, green today. The four plugins
// the roadmap calls for (typescript-eslint, react, react-native, drizzle) are
// all wired in so the infrastructure exists. Severity tiers:
//   error — genuine bugs (unused vars/styles, rules-of-hooks, drizzle missing
//           where-clause, unused expressions). Currently zero violations.
//   warn  — known-debt signals that shouldn't block (explicit-any: 0 today;
//           exhaustive-deps: 15 today). Visible but non-blocking.
//   off   — opinionated/stylistic (inline-styles, color-literals, prop-sorting)
//           deferred so this lands green over a rapid-prototype codebase with no
//           mass-refactor. Tightening is a follow-up once the gate is in place.
//
// Formatting is owned entirely by Prettier; eslint-config-prettier (last in the
// chain) disables every ESLint rule that would fight it.
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import reactNative from "eslint-plugin-react-native";
import drizzle from "eslint-plugin-drizzle";
import prettier from "eslint-config-prettier";
import globals from "globals";

export default tseslint.config(
  // ---- Global ignores (build output, deps, generated code, sandbox) --------
  {
    ignores: [
      "**/dist/**",
      "**/build/**",
      "**/node_modules/**",
      "**/.expo/**",
      "**/coverage/**",
      "**/generated/**", // orval-generated client + zod (lib/api-*)
      "artifacts/mockup-sandbox/**", // throwaway prototype sandbox
      "**/.migration-backup/**", // archived pre-migration Replit source
      "**/*.d.ts",
    ],
  },

  // ---- Base: JS + TS recommended (non-type-checked: fast, no project graph) -
  js.configs.recommended,
  ...tseslint.configs.recommended,

  // ---- Shared rule tuning across all TS/JS ---------------------------------
  {
    files: ["**/*.{js,mjs,cjs,ts,tsx}"],
    rules: {
      // TS already resolves identifiers; the core rule false-positives on types.
      "no-undef": "off",
      // Prototype carries intentional `any`; surfaced as warnings (non-blocking).
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-empty-object-type": "off",
      // Unused vars are real cruft — keep as an error, but allow _-prefixed
      // intentional throwaways (e.g. unused route `next`, destructured rest).
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
      // Intentional fire-and-forget cleanup (e.g. `catch {}` around best-effort
      // teardown) is allowed; other empty blocks still error.
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },

  // ---- CommonJS files (tooling/config/scripts): require() is correct here ---
  {
    files: ["**/*.{js,cjs}", "**/*.config.{ts,js,mjs,cjs}", "**/tailwind.config.*"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },

  // ---- Node packages: api-server, libs, scripts, tooling configs -----------
  {
    files: [
      "artifacts/api-server/**/*.{ts,mjs,js}",
      "lib/**/*.{ts,mjs,js}",
      "scripts/**/*.{ts,mjs,js}",
      "**/*.config.{ts,mjs,js}",
    ],
    languageOptions: { globals: { ...globals.node } },
  },

  // ---- Drizzle: guard against full-table deletes/updates -------------------
  // Only meaningful where the `db` client is used (api-server + lib/db).
  {
    files: ["artifacts/api-server/**/*.ts", "lib/db/**/*.ts"],
    plugins: { drizzle },
    rules: {
      "drizzle/enforce-delete-with-where": ["error", { drizzleObjectName: ["db"] }],
      "drizzle/enforce-update-with-where": ["error", { drizzleObjectName: ["db"] }],
    },
  },

  // ---- React (web + mobile): hooks correctness + real JSX bugs --------------
  {
    files: ["artifacts/campus-music/**/*.{ts,tsx}", "artifacts/campus-music-mobile/**/*.{ts,tsx}"],
    plugins: { react, "react-hooks": reactHooks },
    languageOptions: {
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    settings: { react: { version: "detect" } },
    rules: {
      // The genuine bug-catcher — keep as an error.
      "react-hooks/rules-of-hooks": "error",
      // Real but behaviour-risky to auto-fix on a prototype: surfaced as
      // non-blocking warnings (known debt) rather than blocking errors.
      "react-hooks/exhaustive-deps": "warn",
      // The new JSX transform doesn't need React in scope.
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off", // TS owns prop typing
    },
  },

  // ---- Web-only globals -----------------------------------------------------
  {
    files: ["artifacts/campus-music/**/*.{ts,tsx}"],
    languageOptions: { globals: { ...globals.browser } },
  },

  // ---- React Native (mobile): plugin wired, bug rules only ------------------
  {
    files: ["artifacts/campus-music-mobile/**/*.{ts,tsx}"],
    plugins: { "react-native": reactNative },
    languageOptions: { globals: { ...globals.node } },
    rules: {
      // Catches references to styles that no longer exist — a real bug.
      "react-native/no-unused-styles": "error",
      // RN bundles static assets via `require("./img.png")` — idiomatic and
      // unavoidable, even in TS/TSX. Allow it here.
      "@typescript-eslint/no-require-imports": "off",
      // Stylistic RN rules (inline-styles, color-literals, raw-text,
      // split-platform-components) stay off for now — see header note.
    },
  },

  // ---- Disable rules that conflict with Prettier (must stay last) ----------
  prettier,
);
