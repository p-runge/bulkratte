import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Cache dynamic RSC segments client-side so navigating back within 30s
    // is instant (no server roundtrip for the layout/page RSC).
    staleTimes: {
      dynamic: 30,
    },
  },
  images: {
    localPatterns: [
      { pathname: "/**" }, // static files from public/
      { pathname: "/api/image", search: "url=**" }, // hotlink proxy
      { pathname: "/images/**" }, // core card/set images via R2 proxy
    ],
    minimumCacheTTL: 60 * 60 * 24 * 365, // 1 year
  },
};

export default nextConfig;
