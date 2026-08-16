import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Product photos ride Server Actions to Cloudinary (never a REST
      // layer). Phone cameras produce 3–8 MB files; the per-file ceiling the
      // schema enforces is 10 MB, and this leaves headroom for the rest of
      // the FormData.
      bodySizeLimit: "15mb",
    },
  },
};

export default nextConfig;
