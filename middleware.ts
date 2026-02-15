import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Minimal middleware to bypass any complex dependency resolution issues on Vercel Edge Runtime
export function middleware(request: NextRequest) {
    return NextResponse.next()
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}
