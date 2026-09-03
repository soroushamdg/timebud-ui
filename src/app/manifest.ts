import type { MetadataRoute } from 'next'

// PWA manifests are static (evaluated at build/request time), so these can't read
// src/app/globals.css's CSS custom properties directly — kept in sync manually with
// --color-bg-primary / the splash background there instead. background_color is the
// pre-hydration splash flash color (browser install/launch chrome), theme_color tints
// the Android status bar/task-switcher.
const MANIFEST_BACKGROUND_COLOR = '#ffffff'
const MANIFEST_THEME_COLOR = '#000000'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'TimeBud',
    short_name: 'TimeBud',
    description: 'Your intelligent time management companion',
    start_url: '/',
    display: 'standalone', // CRITICAL: This hides the browser UI and makes it look like a native app
    background_color: MANIFEST_BACKGROUND_COLOR,
    theme_color: MANIFEST_THEME_COLOR,
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
    shortcuts: [
      {
        name: 'Quick capture',
        short_name: 'Capture',
        description: 'Jot down a task before you forget it',
        url: '/?capture=1',
      },
    ],
  }
}
