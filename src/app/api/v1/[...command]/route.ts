import { NextRequest, NextResponse } from 'next/server';
import { redisEngine } from '@/lib/redis-engine';

function verifyToken(req: NextRequest): boolean {
  const secret = process.env.REDIS_AUTH_SECRET || 'plantcor-redis-secret';
  const authHeader = req.headers.get('authorization') || req.headers.get('x-redis-token');
  if (!authHeader) return false;
  const token = authHeader.replace(/^Bearer\s+/i, '');
  return token === secret;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ command: string[] }> }
) {
  if (!verifyToken(req)) {
    return NextResponse.json({ error: 'Unauthorized: Invalid Redis token' }, { status: 401 });
  }

  try {
    const { command: segments } = await params;
    if (!segments || segments.length === 0) {
      return NextResponse.json({ result: 'PONG' });
    }

    const command = segments[0];
    const args = segments.slice(1).map(decodeURIComponent);
    const result = redisEngine.executeCommand(command, args);

    return NextResponse.json({ result });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Execution error' }, { status: 400 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ command: string[] }> }
) {
  if (!verifyToken(req)) {
    return NextResponse.json({ error: 'Unauthorized: Invalid Redis token' }, { status: 401 });
  }

  try {
    const { command: segments } = await params;
    const body = await req.json().catch(() => ({}));

    if (segments && segments[0] === 'pipeline') {
      const commands: Array<{ command: string; args: string[] }> = body.commands || [];
      const results = commands.map((c) => redisEngine.executeCommand(c.command, c.args || []));
      return NextResponse.json({ results });
    }

    const command = (segments && segments[0]) || body.command || 'PING';
    const args = (segments && segments.slice(1).map(decodeURIComponent)) || body.args || [];
    const result = redisEngine.executeCommand(command, args);

    return NextResponse.json({ result });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Execution error' }, { status: 400 });
  }
}
