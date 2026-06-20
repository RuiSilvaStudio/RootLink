/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
        port: "8000",
        pathname: "/media/**",
      },
      {
        protocol: "https",
        hostname: "rootlink.ruisilvastudio.com",
        pathname: "/media/**",
      },
      {
        protocol: "https",
        hostname: "api.inaturalist.org",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "jb.utad.pt",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "inaturalist-open-data.s3.amazonaws.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "*.cloudfront.net",
        pathname: "/**",
      },
    ],
  },
  distDir: process.env.NODE_ENV === 'production' ? '.next-build' : '.next',
};

module.exports = nextConfig;
