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
  // Two directories are read from disk at request time through paths Next
  // cannot see: the PDF renderer loads the Tinos TTFs via fs.readFile, and
  // loadPrompt (lib/ai/prompt.ts) reads prompts/*.md by name. Neither is
  // reachable from the module graph, so a traced or standalone deploy ships
  // without them and every PDF export — or every agent call — fails at
  // runtime with ENOENT. Naming them here is what puts them in the bundle.
  outputFileTracingIncludes: {
    "/api/**": ["./assets/fonts/**", "./prompts/**"],
    // Server Actions run under the page that renders them, not /api, and the
    // panel's drafting and revision actions call loadPrompt too.
    "/panel/**": ["./prompts/**"],
    "/basvuru/**": ["./prompts/**"],
  },
};

export default nextConfig;
