/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: [],
  },
  distDir: process.env.NODE_ENV === 'production' ? '.next-build' : '.next',
};

module.exports = nextConfig;
