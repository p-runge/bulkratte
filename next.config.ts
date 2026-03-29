import type { NextConfig } from "next";
import "./src/env";

const nextConfig: NextConfig = {
  images: {
    localPatterns: [
      { pathname: "/**" }, // static files from public/
      { pathname: "/api/image", search: "url=**" }, // image proxy route
    ],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.pokemontcg.io",
      },
      {
        protocol: "https",
        hostname: "assets.tcgdex.net",
      },
    ],
    minimumCacheTTL: 60 * 60 * 24 * 365, // 1 year
  },
};

export default nextConfig;
