import { type NextRequest, NextResponse } from 'next/server'
import createMiddleware from 'next-intl/middleware'

const intlMiddleware = createMiddleware({
  locales: ['en', 'ur', 'ru'],
  defaultLocale: 'en',
  localePrefix: 'always',
})

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Serve Chrome devtools well-known file regardless of locale prefix
  if (pathname.endsWith('/.well-known/appspecific/com.chrome.devtools.json')) {
    return NextResponse.rewrite(
      new URL('/.well-known/appspecific/com.chrome.devtools.json', request.url)
    )
  }

  // Handle i18n routing
  return intlMiddleware(request)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - PWA files (manifest.json, sw.js, swe-worker-*.js, workbox-*.js)
     * - font files (ttf, woff, woff2, etc.)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|sw\\.js|swe-worker|workbox|offline\\.html|robots\\.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ttf|woff|woff2|eot|otf)$).*)',
  ],
}