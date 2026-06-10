import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  serverExternalPackages: [
    'unpdf', 
    'groq-sdk',
    'pdfjs-dist', 
    'canvas',    
  ],
};

export default nextConfig;
