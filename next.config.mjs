/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["wagmi", "viem", "@wagmi/core", "@wagmi/connectors"],
};
export default nextConfig;
