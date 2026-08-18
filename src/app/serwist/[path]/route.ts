import { createSerwistRoute } from "@serwist/turbopack";

// @serwist/next's plugin doesn't support Turbopack, which this project builds with
// (Next.js 16 default) — this dynamic route is the Turbopack-compatible replacement:
// it bundles src/app/sw.ts on demand and serves it here instead of writing a static
// public/sw.js at build time. See next.config.ts and src/app/layout.tsx (SerwistProvider)
// for the other two pieces of this setup.
export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } = createSerwistRoute({
  swSrc: "src/app/sw.ts",
  // Defaults to esbuild-wasm on non-Windows; use the already-installed native esbuild
  // package instead (faster, and one fewer dependency to add).
  useNativeEsbuild: true,
});
