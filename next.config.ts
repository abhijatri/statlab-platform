import type { NextConfig } from 'next'

const config: NextConfig = {
  // ── Security & metadata ──────────────────────────────────────────────────
  poweredByHeader: false,         // Don't advertise Next.js version
  reactStrictMode: true,          // Catch side-effects in development

  // ── Compression ──────────────────────────────────────────────────────────
  compress: true,                 // Brotli/gzip for all responses (Vercel does this too)

  // ── Bundle optimisation ───────────────────────────────────────────────────
  // Tree-shake large packages that support it. Prevents entire library
  // being included when only a subset of exports is used.
  experimental: {
    optimizePackageImports: [
      'lucide-react',             // Only import used icons
      'next-mdx-remote',          // Modular MDX remote
    ],
  },

  // ── Image domains (extend as needed) ─────────────────────────────────────
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [],           // Add CDN/S3 domains here when uploading assets
  },

  // ── Headers ───────────────────────────────────────────────────────────────
  async headers() {
    return [
      {
        // Apply to all routes
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options',    value: 'nosniff'      },
          { key: 'X-Frame-Options',           value: 'DENY'         },
          { key: 'X-XSS-Protection',          value: '1; mode=block'},
          { key: 'Referrer-Policy',           value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy',        value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
      {
        // Long-lived cache for Next.js static assets (immutable hashed filenames)
        source: '/_next/static/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ]
  },
}

export default config
