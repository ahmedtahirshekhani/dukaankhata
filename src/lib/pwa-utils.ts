/**
 * PWA Utility Functions
 * Helper functions for PWA functionality
 */

/**
 * Check if the app is running as a PWA (installed)
 */
export function isPWA(): boolean {
  if (typeof window === 'undefined') return false;
  
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true ||
    document.referrer.includes('android-app://')
  );
}

/**
 * Check if PWA installation is available
 */
export function canInstallPWA(): boolean {
  if (typeof window === 'undefined') return false;
  return 'BeforeInstallPromptEvent' in window;
}

/**
 * Check if service worker is supported
 */
export function isServiceWorkerSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return 'serviceWorker' in navigator;
}

/**
 * Check if the browser is online
 */
export function isOnline(): boolean {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine;
}

/**
 * Register for push notifications
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }
  
  if (Notification.permission === 'granted') {
    return 'granted';
  }
  
  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission;
  }
  
  return Notification.permission;
}

/**
 * Show a notification
 */
export async function showNotification(
  title: string,
  options?: NotificationOptions
): Promise<void> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return;
  }

  if (Notification.permission === 'granted') {
    const registration = await navigator.serviceWorker.ready;
    await registration.showNotification(title, {
      // icon: '/icons/icon-192x192.png',
      // badge: '/icons/icon-96x96.png',
      icon: "/DukaanKhataLogo.png",
      badge: "/DukaanKhataLogo.png",
      ...options,
    });
  }
}

/**
 * Update service worker
 */
export async function updateServiceWorker(): Promise<void> {
  if (!isServiceWorkerSupported()) return;

  try {
    const registration = await navigator.serviceWorker.ready;
    await registration.update();
  } catch (error) {
    console.error('Failed to update service worker:', error);
  }
}

/**
 * Unregister service worker
 */
export async function unregisterServiceWorker(): Promise<boolean> {
  if (!isServiceWorkerSupported()) return false;

  try {
    const registration = await navigator.serviceWorker.ready;
    return await registration.unregister();
  } catch (error) {
    console.error('Failed to unregister service worker:', error);
    return false;
  }
}

/**
 * Clear all caches
 */
export async function clearAllCaches(): Promise<void> {
  if (typeof caches === 'undefined') return;

  try {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map((name) => caches.delete(name)));
  } catch (error) {
    console.error('Failed to clear caches:', error);
  }
}

/**
 * Get cache size
 */
export async function getCacheSize(): Promise<number> {
  if (typeof caches === 'undefined') return 0;

  try {
    const cacheNames = await caches.keys();
    let totalSize = 0;

    for (const name of cacheNames) {
      const cache = await caches.open(name);
      const requests = await cache.keys();
      
      for (const request of requests) {
        const response = await cache.match(request);
        if (response) {
          const blob = await response.blob();
          totalSize += blob.size;
        }
      }
    }

    return totalSize;
  } catch (error) {
    console.error('Failed to get cache size:', error);
    return 0;
  }
}

/**
 * Format bytes to human-readable size
 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Share content using Web Share API
 */
export async function shareContent(data: ShareData): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.share) {
    return false;
  }

  try {
    await navigator.share(data);
    return true;
  } catch (error) {
    if ((error as Error).name !== 'AbortError') {
      console.error('Share failed:', error);
    }
    return false;
  }
}

/**
 * Check if Web Share API is supported
 */
export function canShare(): boolean {
  if (typeof navigator === 'undefined') return false;
  return 'share' in navigator;
}

/**
 * Add to home screen (install PWA)
 */
export async function installPWA(promptEvent: any): Promise<boolean> {
  if (!promptEvent) return false;

  try {
    promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    return outcome === 'accepted';
  } catch (error) {
    console.error('Installation failed:', error);
    return false;
  }
}

/**
 * Check if app needs update
 */
export async function checkForUpdates(): Promise<boolean> {
  if (!isServiceWorkerSupported()) return false;

  try {
    const registration = await navigator.serviceWorker.ready;
    await registration.update();
    return !!registration.waiting;
  } catch (error) {
    console.error('Update check failed:', error);
    return false;
  }
}

/**
 * Apply pending update
 */
export async function applyUpdate(): Promise<void> {
  if (!isServiceWorkerSupported()) return;

  try {
    const registration = await navigator.serviceWorker.ready;
    if (registration.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      window.location.reload();
    }
  } catch (error) {
    console.error('Failed to apply update:', error);
  }
}

export const pwaUtils = {
  isPWA,
  canInstallPWA,
  isServiceWorkerSupported,
  isOnline,
  requestNotificationPermission,
  showNotification,
  updateServiceWorker,
  unregisterServiceWorker,
  clearAllCaches,
  getCacheSize,
  formatBytes,
  shareContent,
  canShare,
  installPWA,
  checkForUpdates,
  applyUpdate,
};
