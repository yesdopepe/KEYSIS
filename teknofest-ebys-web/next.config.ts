import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "15mb",
    },
  },
  // @react-pdf/renderer drives React's reconciler, which does not exist in
  // the react-server build the RSC layer uses. Loading it externally makes
  // Node resolve the normal React build instead of crashing on a missing
  // internal. `docx` is external for the same class of reason (it expects a
  // plain Node module graph).
  serverExternalPackages: ["@react-pdf/renderer", "docx"],
  // The PDF renderer reads the Tinos TTFs from disk at request time. Next
  // cannot see that through fs.readFile, so the files must be named
  // explicitly or a traced/standalone deploy ships without them and every
  // PDF export fails at runtime.
  outputFileTracingIncludes: {
    "/api/**": ["./assets/fonts/**"],
  },
};

export default nextConfig;
