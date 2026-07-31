import nextConfig from "eslint-config-next";

const eslintConfig = [
  ...nextConfig,
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      /*
       * Playwright's output directories. They are gitignored, but eslint has no
       * knowledge of that, and when a test fails Playwright copies its bundled
       * trace-viewer assets into `playwright-report/trace/` — minified JavaScript
       * that produces ~180 rules-of-hooks errors. `pnpm lint` therefore passed on a
       * clean tree and failed on any tree where an E2E test had failed, which is
       * exactly when nobody wants a second, unrelated failure to read through.
       */
      "playwright-report/**",
      "test-results/**",
      "blob-report/**",
      "playwright/.cache/**",
      /*
       * Supabase Edge Functions are Deno, not Node: they use URL and `.ts`
       * import specifiers, the `Deno` global, and `npm:`/`jsr:` module
       * resolution. None of that is valid input to a Next.js lint config.
       * Deno owns them end to end — `supabase/functions/deno.json` defines
       * `deno task verify` (fmt, lint, type check, tests), which is what runs
       * over that directory. See docs/edge-functions.md.
       */
      "supabase/functions/**",
    ],
  },
];

export default eslintConfig;
