import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'F1 Bortobet',
    short_name: 'Bortobet',
    description: 'Apostas de Fórmula 1',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#15151e',
    theme_color: '#15151e',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}
