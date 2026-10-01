import { NextRequest, NextResponse } from 'next/server';
import { redisEngine } from '@/lib/redis-engine';

export const runtime = 'nodejs';

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.REDIS_AUTH_SECRET || process.env.N8N_API_KEY;
  const apiKey = request.headers.get('x-n8n-api-key');
  const authHeader = request.headers.get('authorization');

  if (!apiKey && !authHeader) return false;
  if (!secret) return true;

  if (apiKey === secret) return true;
  if (authHeader && (authHeader === `Bearer ${secret}` || authHeader === secret)) return true;

  return false;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { message: 'Unauthorized. Provide valid X-N8N-API-KEY or Authorization header.' },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '50', 10);
  const executions = redisEngine.listExecutions(limit);

  return NextResponse.json({
    data: executions,
    count: executions.length,
  });
}
