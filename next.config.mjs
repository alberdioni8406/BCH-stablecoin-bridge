/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["wagmi", "viem", "@wagmi/core", "@wagmi/connectors"],
  webpack: (config) => {
    // Safety net if anything still resolves Coinbase/x402 optional deps
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      "@x402/evm": false,
      "@x402/evm/upto/client": false,
      "@x402/evm/exact/client": false,
      "@x402/core": false,
      "@x402/core/client": false,
      "@x402/svm": false,
      "@x402/svm/exact/client": false,
    };
    return config;
  },
};

export default nextConfig;
