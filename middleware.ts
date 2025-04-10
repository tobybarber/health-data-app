import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// This function runs on every request
export function middleware(request: NextRequest) {
  const url = request.nextUrl.clone();
  
  // Only redirect if the path is exactly the root
  if (url.pathname === '/') {
    url.pathname = '/test-home';
    return NextResponse.redirect(url);
  }
  
  return NextResponse.next();
}

// Configure the paths this middleware will run on
export const config = {
  matcher: ['/'],
}; 