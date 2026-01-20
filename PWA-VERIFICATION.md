# 🔍 PWA Verification Guide

## Quick Verification Steps

### 1. **Check Service Worker Registration**
Open browser DevTools (F12) and navigate to:
- **Path:** Application tab → Service Workers
- **Expected:** Should show a registered service worker
- **Status:** "activated and running" (production) or "development mode" (dev)

### 2. **Check Manifest File**
- **Path:** Application tab → Manifest
- **Expected:** Should display:
  ```
  Name: DukaanKhata - Sales & Business Management System
  Short Name: DukaanKhata
  Start URL: /
  Display: standalone
  ```

### 3. **Verify PWA Files Are Accessible**
Open in browser:
- `http://localhost:3000/manifest.json` → Should show JSON
- `http://localhost:3000/offline.html` → Should show offline page
- `http://localhost:3000/robots.txt` → Should show robots.txt

### 4. **Check Icons**
- **Path:** Application tab → Icons
- **Expected:** Should list multiple icon sizes (72x72 to 512x512)
- **All icons should have** ✅ marks indicating they're found

### 5. **Test Offline Mode**
1. Open DevTools → Network tab
2. Check "Offline" checkbox
3. Try navigating to cached pages
4. Should see cached content load

## Development vs Production

### Development Mode
- Service worker is **active** but **caching disabled**
- Allows for easy debugging
- Changes reload automatically
- Good for development testing

### Production Mode
- Service worker **actively caches** assets
- Offline support fully enabled
- Users can install the app
- Optimal performance

## Testing Checklist

- [ ] Server starts without PWA-related 404 errors
- [ ] `/sw.js` is accessible (root level, not `/en/sw.js`)
- [ ] `/manifest.json` is accessible (root level, not `/en/manifest.json`)
- [ ] `/offline.html` is accessible
- [ ] Service worker shows "activated" in DevTools
- [ ] All icon sizes are present in Application tab
- [ ] App can be installed (try "Add to Home Screen")
- [ ] Offline mode shows offline page when network is offline

## Common Issues & Solutions

### Issue: Service Worker Not Found
```
GET /en/sw.js 404
```
**Solution:** Middleware now excludes PWA files. Should be fixed with the latest middleware update.

### Issue: Manifest Not Found
```
GET /en/manifest.json 404
```
**Solution:** Same as above - fixed in middleware matcher pattern.

### Issue: Icons Missing
```
GET /icons/icon-96x96.png 404
```
**Solution:** Run `node scripts/convert-icons-to-png.js` to regenerate all icons.

### Issue: Dev Server Won't Start
**Solution:** 
1. Check console for specific errors
2. Verify all dependencies installed: `npm install`
3. Clear cache: `rm -r .next` (or remove manually)
4. Try again: `npm run dev`

## Production Deployment

### Before Deploying:

1. **Verify Build:**
   ```bash
   npm run build
   ```
   Should complete without errors.

2. **Test Locally:**
   ```bash
   npm start
   ```
   Verify no errors appear.

3. **Verify HTTPS:**
   - PWA requires HTTPS in production
   - localhost works fine for development
   - Enable SSL/TLS on your server

### After Deployment:

1. **Test on Actual Devices:**
   - Android: Chrome → Install button should appear
   - iOS: Safari → "Add to Home Screen" should work

2. **Run Lighthouse Audit:**
   - DevTools → Lighthouse
   - Select "Progressive Web App"
   - Target score: 90+/100

3. **Check Service Worker:**
   - DevTools → Application
   - Verify service worker shows "activated and running"

## Monitoring PWA Health

### In Production, Monitor:
- Service worker update frequency
- Cache hit rates
- Offline usage patterns
- Installation counts

### DevTools Tools to Use:
1. **Application Tab:**
   - Service Workers
   - Manifest
   - Storage (Cache, LocalStorage)
   - Icons

2. **Network Tab:**
   - Check caching behavior
   - Verify offline mode
   - Monitor request sizes

3. **Console Tab:**
   - Check for service worker errors
   - Monitor registration status
   - Check for offline indicators

## Performance Metrics

### Expected Metrics (After PWA Optimization):
- First Contentful Paint: < 2s
- Largest Contentful Paint: < 3.5s
- Cumulative Layout Shift: < 0.1
- Time to Interactive: < 4s

### Why PWA Helps:
- Service worker caches assets
- Reduces network requests
- Enables offline-first experience
- Faster repeat visits

## Files to Monitor

```
public/
├── sw.js                 # Service worker (generated)
├── manifest.json         # App manifest
├── offline.html          # Offline fallback
├── icons/               # App icons
├── robots.txt           # SEO
└── screenshots/         # App screenshots (optional)
```

All these files are now properly served at the **root level** without locale prefix.

## Next Steps

1. ✅ **Development:** Continue building features
2. ⏳ **Testing:** Test on actual mobile devices
3. ⏳ **Customization:** Add brand-specific icons/screenshots
4. 🚀 **Deployment:** Deploy to production with HTTPS

## Support Resources

- [PWA-IMPLEMENTATION.md](./PWA-IMPLEMENTATION.md) - Detailed technical guide
- [PWA-QUICK-START.md](./PWA-QUICK-START.md) - Quick reference
- [PWA-FIX-SUMMARY.md](./PWA-FIX-SUMMARY.md) - Changes made to fix issues

---

**Your PWA is ready to go!** 🎉
