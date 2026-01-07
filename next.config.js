/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb'
    }
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.strava.com'
      }
    ]
  },
  headers: async () => [
    {
      source: '/api/tiles/:path*',
      headers: [
        { key: 'Cache-Control', value: 'public, max-age=300, s-maxage=600, stale-while-revalidate=1800' }
      ]
    }
  ]
};

module.exports = nextConfig;
