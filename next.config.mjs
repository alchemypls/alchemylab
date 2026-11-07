/** @type {import('next').NextConfig} */
const nextConfig = {
  // NEXT_DIST_DIR: build somewhere else (a check build while `npm run dev` is using .next)
  distDir: process.env.NEXT_DIST_DIR || '.next',
};

export default nextConfig;
