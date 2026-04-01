import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf-parse"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        // Matches any Supabase project storage URL (*.supabase.co)
        hostname: "**.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
