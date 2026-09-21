import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://rootstock.basednut.com'
  return [
    { url: base, lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/swap`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.9 },
    { url: `${base}/create`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.9 },
    { url: `${base}/nutusd`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
  ]
}
