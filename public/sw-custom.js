// Custom service worker for DukaanKhata PWA
// This file extends the default next-pwa functionality

// Import workbox libraries
import { precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { NetworkFirst, CacheFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

// Precache all assets
precacheAndRoute(self.__WB_MANIFEST || []);

// Custom event listeners
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((cacheName) => {
            // Delete old caches
            return cacheName.startsWith('dukaankhata-') && !cacheName.includes('v1');
          })
          .map((cacheName) => caches.delete(cacheName))
      );
    })
  );
  return self.clients.claim();
});

// Listen for messages from the client
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CACHE_URLS') {
    event.waitUntil(
      caches.open('dukaankhata-dynamic-v1').then((cache) => {
        return cache.addAll(event.data.payload);
      })
    );
  }
});

// Handle push notifications (if needed in future)
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body,
      // icon: '/icons/icon-192x192.png',
      // badge: '/icons/icon-96x96.png',
      icon: "/DukaanKhataLogo.png",
      badge: "/DukaanKhataLogo.png",
      vibrate: [100, 50, 100],
      data: {
        dateOfArrival: Date.now(),
        primaryKey: data.primaryKey || 1,
      },
      actions: data.actions || [],
    };

    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  }
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a window tab matching the target URL exists, focus it
      for (const client of clientList) {
        if (client.url === event.notification.data.url && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise, open a new tab
      if (clients.openWindow) {
        return clients.openWindow(event.notification.data.url || '/');
      }
    })
  );
});

// Sync event for background sync
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-data') {
    event.waitUntil(
      // Implement your sync logic here
      syncData()
    );
  }
});

async function syncData() {
  // Placeholder for sync functionality
  console.log('Background sync triggered');
  // You can implement data synchronization logic here
  // For example, syncing offline transactions when connection is restored
}

// Offline analytics tracking
self.addEventListener('fetch', (event) => {
  // Track offline usage
  if (!navigator.onLine) {
    // Log offline requests for analytics
    console.log('Offline request:', event.request.url);
  }
});

console.log('DukaanKhata Service Worker loaded');
