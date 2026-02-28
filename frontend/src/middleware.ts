import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Public routes that don't require an authentication token
const PUBLIC_ROUTES = ['/login'];

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Check if the route is public
    const isPublicRoute = PUBLIC_ROUTES.some(route => pathname.startsWith(route));

    // Get the JWT token from cookies
    const token = request.cookies.get('token')?.value;

    // If there's no token and it's not a public route, redirect to /login
    if (!token && !isPublicRoute) {
        // Exclude Next.js internal files and standard static assets from auth checks
        if (!pathname.startsWith('/_next') && !pathname.includes('.')) {
            const loginUrl = new URL('/login', request.url);
            return NextResponse.redirect(loginUrl);
        }
    }

    // If there is a token and they are trying to reach /login, redirect to dashboard
    if (token && pathname === '/login') {
        const dashboardUrl = new URL('/dashboard', request.url);
        return NextResponse.redirect(dashboardUrl);
    }

    // Allow the request to proceed
    return NextResponse.next();
}

// Config to specify which paths the middleware should run on
export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - api (API routes)
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         */
        '/((?!api|_next/static|_next/image|favicon.ico).*)',
    ],
};
