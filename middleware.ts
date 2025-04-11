import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// This function runs on every request
export function middleware(request: NextRequest) {
  const url = request.nextUrl.clone();
  
  // Only redirect if the path is exactly the root and not coming from a chat link
  if (url.pathname === '/' && !url.searchParams.get('chat')) {
    url.pathname = '/test-home';
    return NextResponse.redirect(url);
  }
  
  return NextResponse.next();
}

// Configure the paths this middleware will run on
export const config = {
  matcher: ['/'],
}; 