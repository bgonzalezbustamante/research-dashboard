import type { MetadataRoute } from 'next'

// Crawling stays allowed so search engines can read each page's noindex tag;
// only /api (index, follow) may be listed. A Disallow rule would let a bare
// URL be listed without its noindex being seen.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
    },
    sitemap:
      'https://dashboard.bgonzalezbustamante.com/sitemap.xml',
  }
}
