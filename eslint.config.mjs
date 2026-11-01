import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  // Vendored animation library in a separate generated video deliverable.
  globalIgnores(["brag-output/composition/assets/gsap.min.js", "dukaanpilot-launch-film/**/assets/gsap.min.js"]),
  globalIgnores([".next/**", ".next-build/**", ".next-s2-tests/**", "node_modules/**", ".cache/**", ".local/**", "src/generated/**", "work/**", "test-results/**", "playwright-report/**", "next-env.d.ts"]),
]);
