/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@thesysai/genui-sdk"],
  experimental: {
    serverActions: {
      allowedOrigins: ["localhost:3000", "promptshield-cyan.vercel.app"],
    },
  },
};

export default nextConfig;
