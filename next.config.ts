import type { NextConfig } from 'next'

// Same baseline as the academic website: no framing, no plugins, no base-URL
// rewriting, and no device features. This CSP sets no script or style sources,
// so it does not restrict Next.js or Supabase.
const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value:
      "base-uri 'self'; frame-ancestors 'none'; object-src 'none'",
  },
  {
    key: 'Permissions-Policy',
    value:
      'camera=(), geolocation=(), microphone=(), payment=(), usb=()',
  },
  {
    key: 'Referrer-Policy',
    value:
      'strict-origin-when-cross-origin',
  },
  {
    key: 'X-Content-Type-Options',
    value:
      'nosniff',
  },
  {
    key: 'X-Frame-Options',
    value:
      'DENY',
  },
]

const nextConfig: NextConfig = {
  reactCompiler: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers:
          securityHeaders,
      },
    ]
  },
}

export default nextConfig
