import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'TimeBud',
    short_name: 'TimeBud',
    description: 'Your intelligent time management companion',
    start_url: '/',
    display: 'standalone', // CRITICAL: This hides the browser UI and makes it look like a native app
    background_color: '#ffffff',
    theme_color: '#000000',
    icons: [
      {
        src: '/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}
