import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Codespaces serves the dev server through a proxied *.app.github.dev origin.
  allowedDevOrigins: ["*.app.github.dev"],
};

export default nextConfig;
