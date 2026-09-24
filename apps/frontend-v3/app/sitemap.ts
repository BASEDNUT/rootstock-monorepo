import { MetadataRoute } from 'next'

// Rootstock S100 (IPFS export): metadata routes must be force-static for output:export
export const dynamic = 'force-static'

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://rootstock.basednut.com'
  return [
    { url: base, lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/swap`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.9 },
    { url: `${base}/create`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.9 },
    { url: `${base}/nutusd`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
  ]
}
