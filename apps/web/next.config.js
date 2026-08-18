/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['mongoose'],
  images: {
    remotePatterns: [{ hostname: 'avatars.githubusercontent.com' }],
  },
};

export default nextConfig;
