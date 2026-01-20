'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { pwaUtils } from '@/lib/pwa-utils';

export function PWAStatus() {
  const [isPWA, setIsPWA] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [cacheSize, setCacheSize] = useState<string>('0 Bytes');
  const [hasUpdate, setHasUpdate] = useState(false);
  const [swRegistration, setSwRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    // Check if running as PWA
    setIsPWA(pwaUtils.isPWA());
    setIsOnline(pwaUtils.isOnline());

    // Get cache size
    pwaUtils.getCacheSize().then((size) => {
      setCacheSize(pwaUtils.formatBytes(size));
    });

    // Check for service worker
    if (pwaUtils.isServiceWorkerSupported()) {
      navigator.serviceWorker.ready.then((registration) => {
        setSwRegistration(registration);
      });
    }

    // Check for updates periodically
    const checkUpdates = async () => {
      const needsUpdate = await pwaUtils.checkForUpdates();
      setHasUpdate(needsUpdate);
    };
    
    checkUpdates();
    const interval = setInterval(checkUpdates, 60000); // Check every minute

    // Listen to online/offline events
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleClearCache = async () => {
    if (confirm('Are you sure you want to clear all cached data? This may slow down the app temporarily.')) {
      await pwaUtils.clearAllCaches();
      setCacheSize('0 Bytes');
      window.location.reload();
    }
  };

  const handleUpdate = async () => {
    await pwaUtils.applyUpdate();
  };

  const handleUpdateSW = async () => {
    await pwaUtils.updateServiceWorker();
    const needsUpdate = await pwaUtils.checkForUpdates();
    setHasUpdate(needsUpdate);
  };

  return (
    <Card className="p-6">
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold mb-4">PWA Status</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Installation Status */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Installation Status</span>
              <Badge variant={isPWA ? 'default' : 'secondary'}>
                {isPWA ? 'Installed' : 'Browser'}
              </Badge>
            </div>
            <p className="text-xs text-gray-500">
              {isPWA 
                ? 'Running as installed PWA' 
                : 'Running in browser mode'}
            </p>
          </div>

          {/* Network Status */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Network Status</span>
              <Badge variant={isOnline ? 'default' : 'destructive'}>
                {isOnline ? 'Online' : 'Offline'}
              </Badge>
            </div>
            <p className="text-xs text-gray-500">
              {isOnline 
                ? 'Connected to internet' 
                : 'Working offline'}
            </p>
          </div>

          {/* Service Worker Status */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Service Worker</span>
              <Badge variant={swRegistration ? 'default' : 'secondary'}>
                {swRegistration ? 'Active' : 'Inactive'}
              </Badge>
            </div>
            <p className="text-xs text-gray-500">
              {swRegistration 
                ? 'Background sync enabled' 
                : 'No service worker registered'}
            </p>
          </div>

          {/* Cache Size */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Cache Size</span>
              <Badge variant="outline">{cacheSize}</Badge>
            </div>
            <p className="text-xs text-gray-500">
              Cached data for offline access
            </p>
          </div>
        </div>

        {/* Update Notification */}
        {hasUpdate && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-900">
                  Update Available
                </p>
                <p className="text-xs text-blue-700">
                  A new version of the app is available
                </p>
              </div>
              <Button onClick={handleUpdate} size="sm">
                Update Now
              </Button>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-3 pt-4 border-t">
          <Button 
            onClick={handleUpdateSW} 
            variant="outline"
            size="sm"
          >
            Check for Updates
          </Button>
          <Button 
            onClick={handleClearCache} 
            variant="outline"
            size="sm"
          >
            Clear Cache
          </Button>
          {pwaUtils.canShare() && (
            <Button
              onClick={() => {
                pwaUtils.shareContent({
                  title: 'DukaanKhata',
                  text: 'Check out this amazing business management app!',
                  url: window.location.origin,
                });
              }}
              variant="outline"
              size="sm"
            >
              Share App
            </Button>
          )}
        </div>

        {/* Info */}
        <div className="bg-gray-50 rounded-lg p-4 space-y-2">
          <h4 className="text-sm font-medium text-gray-900">PWA Features</h4>
          <ul className="text-xs text-gray-600 space-y-1">
            <li>✓ Offline support with cached resources</li>
            <li>✓ Install on home screen for app-like experience</li>
            <li>✓ Fast loading with intelligent caching</li>
            <li>✓ Automatic updates when online</li>
            <li>✓ Works on mobile, tablet, and desktop</li>
          </ul>
        </div>
      </div>
    </Card>
  );
}
