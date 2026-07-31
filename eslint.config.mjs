import nextConfig from "eslint-config-next";

const eslintConfig = [
  ...nextConfig,
  {
    ignores: [
      ".next/**",
      "node_modules/**",
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
