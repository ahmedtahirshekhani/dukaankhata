import { type NextRequest, NextResponse } from 'next/server'
import createMiddleware from 'next-intl/middleware'
import { updateSession } from '@/lib/supabase/middleware'

const intlMiddleware = createMiddleware({
  locales: ['en', 'ur', 'ru'],
  defaultLocale: 'en',
  localePrefix: 'always',
})

export async function middleware(request: NextRequest) {
  // Handle i18n routing
  const intlResponse = intlMiddleware(request)
  
  if (intlResponse) {
    // Update session while preserving the i18n response
    const sessionResponse = await updateSession(request)
    return sessionResponse || intlResponse
  }
  
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}