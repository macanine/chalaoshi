import { NextResponse, type NextRequest } from 'next/server';

const VERCEL_HOST = 'chalaoshi.vercel.app';
const CANONICAL_HOST = 'chalaoshi.xhuya.cn';

export function middleware(req: NextRequest) {
  if (req.nextUrl.hostname !== VERCEL_HOST) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.protocol = 'https:';
  url.hostname = CANONICAL_HOST;
  url.port = '';

  return NextResponse.redirect(url, 308);
}

