import { NextResponse } from 'next/server';
import { redisEngine } from '@/lib/redis-engine';

export async function GET() {
  const ping = redisEngine.executeCommand('PING', []);
  const keys = redisEngine.executeCommand('KEYS', ['*']);

  return NextResponse.json({
    status: 'healthy',
    mode: 'serverless-http-redis',
    ping,
    activeKeysCount: (keys as string[]).length,
    timestamp: new Date().toISOString(),
  });
}
