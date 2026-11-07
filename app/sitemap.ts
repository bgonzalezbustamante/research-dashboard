import type { MetadataRoute } from 'next'

// The public Academic API docs are the only page meant for search results.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: 'https://dashboard.bgonzalezbustamante.com/api',
      changeFrequency: 'monthly',
      priority: 1,
    },
  ]
}
