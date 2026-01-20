import createNextIntlPlugin from 'next-intl/plugin';
import withPWAInit from '@ducanh2912/next-pwa';

const withNextIntl = createNextIntlPlugin(
  './src/request.ts'
);

// const withPWA = withPWAInit({
//   dest: 'public',
//   cacheOnFrontEndNav: true,
//   aggressiveFrontEndNavCaching: true,
//   reloadOnOnline: true,
//   swcMinify: true,
//   disable: process.env.NODE_ENV === 'development',
//   workboxOptions: {
//     disableDevLogs: true,
//     runtimeCaching: [
//       {
//         urlPattern: /^https:\/\/fonts\.(?:gstatic)\.com\/.*/i,
//         handler: 'CacheFirst',
//         options: {
//           cacheName: 'google-fonts-webfonts',
//           expiration: {
//             maxEntries: 4,
//             maxAgeSeconds: 365 * 24 * 60 * 60 // 365 days
//           }
//         }
//       },
//       {
//         urlPattern: /^https:\/\/fonts\.(?:googleapis)\.com\/.*/i,
//         handler: 'StaleWhileRevalidate',
//         options: {
//           cacheName: 'google-fonts-stylesheets',
//           expiration: {
//             maxEntries: 4,
//             maxAgeSeconds: 7 * 24 * 60 * 60 // 7 days
//           }
//         }
//       },
//       {
//         urlPattern: /\.(?:eot|otf|ttc|ttf|woff|woff2|font.css)$/i,
//         handler: 'StaleWhileRevalidate',
//         options: {
//           cacheName: 'static-font-assets',
//           expiration: {
//             maxEntries: 4,
//             maxAgeSeconds: 7 * 24 * 60 * 60 // 7 days
//           }
//         }
//       },
//       {
//         urlPattern: /\.(?:jpg|jpeg|gif|png|svg|ico|webp)$/i,
//         handler: 'StaleWhileRevalidate',
//         options: {
//           cacheName: 'static-image-assets',
//           expiration: {
//             maxEntries: 64,
//             maxAgeSeconds: 24 * 60 * 60 // 24 hours
//           }
//         }
//       },
//       {
//         urlPattern: /\/_next\/image\?url=.+$/i,
//         handler: 'StaleWhileRevalidate',
//         options: {
//           cacheName: 'next-image',
//           expiration: {
//             maxEntries: 64,
//             maxAgeSeconds: 24 * 60 * 60 // 24 hours
//           }
//         }
//       },
//       {
//         urlPattern: /\.(?:mp3|wav|ogg)$/i,
//         handler: 'CacheFirst',
//         options: {
//           rangeRequests: true,
//           cacheName: 'static-audio-assets',
//           expiration: {
//             maxEntries: 32,
//             maxAgeSeconds: 24 * 60 * 60 // 24 hours
//           }
//         }
//       },
//       {
//         urlPattern: /\.(?:mp4)$/i,
//         handler: 'CacheFirst',
//         options: {
//           rangeRequests: true,
//           cacheName: 'static-video-assets',
//           expiration: {
//             maxEntries: 32,
//             maxAgeSeconds: 24 * 60 * 60 // 24 hours
//           }
//         }
//       },
//       {
//         urlPattern: /\.(?:js)$/i,
//         handler: 'StaleWhileRevalidate',
//         options: {
//           cacheName: 'static-js-assets',
//           expiration: {
//             maxEntries: 32,
//             maxAgeSeconds: 24 * 60 * 60 // 24 hours
//           }
//         }
//       },
//       {
//         urlPattern: /\.(?:css|less)$/i,
//         handler: 'StaleWhileRevalidate',
//         options: {
//           cacheName: 'static-style-assets',
//           expiration: {
//             maxEntries: 32,
//             maxAgeSeconds: 24 * 60 * 60 // 24 hours
//           }
//         }
//       },
//       {
//         urlPattern: /\/_next\/data\/.+\/.+\.json$/i,
//         handler: 'StaleWhileRevalidate',
//         options: {
//           cacheName: 'next-data',
//           expiration: {
//             maxEntries: 32,
//             maxAgeSeconds: 24 * 60 * 60 // 24 hours
//           }
//         }
//       },
//       {
//         urlPattern: /\/api\/.*$/i,
//         handler: 'NetworkFirst',
//         method: 'GET',
//         options: {
//           cacheName: 'api-cache',
//           expiration: {
//             maxEntries: 32,
//             maxAgeSeconds: 10 * 60 // 10 minutes
//           },
//           networkTimeoutSeconds: 10
//         }
//       },
//       {
//         urlPattern: ({ url }) => {
//           const isSameOrigin = self.origin === url.origin;
//           if (!isSameOrigin) return false;
//           const pathname = url.pathname;
//           if (pathname.startsWith('/api/')) return false;
//           if (pathname.startsWith('/_next/data/')) return false;
//           return true;
//         },
//         handler: 'NetworkFirst',
//         options: {
//           cacheName: 'pages',
//           expiration: {
//             maxEntries: 32,
//             maxAgeSeconds: 24 * 60 * 60 // 24 hours
//           }
//         }
//       }
//     ]
//   }
// });

const withPWA = withPWAInit({
  dest: "public",
  disable: false,
  reloadOnOnline: true,
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  fallbacks: {
    document: '/offline.html',
  },
  publicExcludes: ['!manifest.json', '!sw.js'],
  workboxOptions: {
    disableDevLogs: true,
    skipWaiting: true,
    clientsClaim: true,
    runtimeCaching: [
      {
        urlPattern: /^https:\/\/fonts\.(?:gstatic)\.com\/.*/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'google-fonts-webfonts',
          expiration: {
            maxEntries: 4,
            maxAgeSeconds: 365 * 24 * 60 * 60
          }
        }
      },
      {
        urlPattern: /^https:\/\/fonts\.(?:googleapis)\.com\/.*/i,
        handler: 'StaleWhileRevalidate',
        options: {
          cacheName: 'google-fonts-stylesheets',
          expiration: {
            maxEntries: 4,
            maxAgeSeconds: 7 * 24 * 60 * 60
          }
        }
      },
      {
        urlPattern: /\.(?:eot|otf|ttc|ttf|woff|woff2|font.css)$/i,
        handler: 'StaleWhileRevalidate',
        options: {
          cacheName: 'static-font-assets',
          expiration: {
            maxEntries: 4,
            maxAgeSeconds: 7 * 24 * 60 * 60
          }
        }
      },
      {
        urlPattern: /\.(?:jpg|jpeg|gif|png|svg|ico|webp)$/i,
        handler: 'StaleWhileRevalidate',
        options: {
          cacheName: 'static-image-assets',
          expiration: {
            maxEntries: 64,
            maxAgeSeconds: 24 * 60 * 60
          }
        }
      },
      {
        urlPattern: /\/_next\/image\?url=.+$/i,
        handler: 'StaleWhileRevalidate',
        options: {
          cacheName: 'next-image',
          expiration: {
            maxEntries: 64,
            maxAgeSeconds: 24 * 60 * 60
          }
        }
      },
      {
        urlPattern: /\.(?:mp3|wav|ogg)$/i,
        handler: 'CacheFirst',
        options: {
          rangeRequests: true,
          cacheName: 'static-audio-assets',
          expiration: {
            maxEntries: 32,
            maxAgeSeconds: 24 * 60 * 60
          }
        }
      },
      {
        urlPattern: /\.(?:mp4)$/i,
        handler: 'CacheFirst',
        options: {
          rangeRequests: true,
          cacheName: 'static-video-assets',
          expiration: {
            maxEntries: 32,
            maxAgeSeconds: 24 * 60 * 60
          }
        }
      },
      {
        urlPattern: /\.(?:js)$/i,
        handler: 'StaleWhileRevalidate',
        options: {
          cacheName: 'static-js-assets',
          expiration: {
            maxEntries: 32,
            maxAgeSeconds: 24 * 60 * 60
          }
        }
      },
      {
        urlPattern: /\.(?:css|less)$/i,
        handler: 'StaleWhileRevalidate',
        options: {
          cacheName: 'static-style-assets',
          expiration: {
            maxEntries: 32,
            maxAgeSeconds: 24 * 60 * 60
          }
        }
      },
      {
        urlPattern: /\/_next\/data\/.+\/.+\.json$/i,
        handler: 'StaleWhileRevalidate',
        options: {
          cacheName: 'next-data',
          expiration: {
            maxEntries: 32,
            maxAgeSeconds: 24 * 60 * 60
          }
        }
      },
      {
        urlPattern: /\/api\/.*$/i,
        handler: 'NetworkFirst',
        method: 'GET',
        options: {
          cacheName: 'api-cache',
          expiration: {
            maxEntries: 32,
            maxAgeSeconds: 10 * 60
          },
          networkTimeoutSeconds: 10
        }
      }
    ]
  }
});


/** @type {import('next').NextConfig} */
const nextConfig = {};

export default withNextIntl(withPWA(nextConfig));
