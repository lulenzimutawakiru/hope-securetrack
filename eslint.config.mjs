import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default [
  ...nextVitals,
  ...nextTypescript,
  {
    ignores: [
      ".next/**",
      ".*",
      ".*/**",
      "node_modules/**",
      "coverage/**",
      "dist/**",
      "build/**",
      "data/skills/**",
      "skills/**",
      "print-agent/**",
      "supabase/functions/**",
      "*.config.js",
      "*.config.mjs",
    ],
  },
  {
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/purity": "warn",
    },
  },
];
