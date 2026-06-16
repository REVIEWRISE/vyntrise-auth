import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3021';

async function handler(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const pathStr = path.join('/');
  const url = new URL(req.url);
  const backendUrl = `${BACKEND_URL}/api/${pathStr}${url.search}`;

  const headers = new Headers();
  req.headers.forEach((value, key) => {
    if (key.toLowerCase() !== 'host') {
      headers.set(key, value);
    }
  });

  const body =
    req.method !== 'GET' && req.method !== 'HEAD'
      ? await req.arrayBuffer()
      : undefined;

  const backendRes = await fetch(backendUrl, {
    method: req.method,
    headers,
    body: body ? Buffer.from(body) : undefined,
  });

  const resHeaders = new Headers();
  backendRes.headers.forEach((value, key) => {
    if (!['transfer-encoding', 'connection'].includes(key.toLowerCase())) {
      resHeaders.set(key, value);
    }
  });

  const responseBody = await backendRes.arrayBuffer();

  return new NextResponse(responseBody, {
    status: backendRes.status,
    headers: resHeaders,
  });
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
