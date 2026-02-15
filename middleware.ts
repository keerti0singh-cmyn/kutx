import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
    try {
        // Basic response to ensure middleware is working
        return NextResponse.next()
    } catch (error) {
        console.error('Middleware execution failed:', error)
        return NextResponse.next()
    }
}

// Simplified matcher to avoid potential regex issues in Edge Runtime
export const config = {
    matcher: [
        '/((?!api|_next/static|_next/image|favicon.ico).*)',
    ],
}
