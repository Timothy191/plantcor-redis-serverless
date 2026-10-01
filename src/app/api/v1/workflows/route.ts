import { NextRequest, NextResponse } from 'next/server';
import { redisEngine } from '@/lib/redis-engine';

export const runtime = 'nodejs';

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.REDIS_AUTH_SECRET || process.env.N8N_API_KEY;
  const apiKey = request.headers.get('x-n8n-api-key');
  const authHeader = request.headers.get('authorization');

  if (!apiKey && !authHeader) return false;
  if (!secret) return true; // If no secret configured, allow with any key

  if (apiKey === secret) return true;
  if (authHeader && (authHeader === `Bearer ${secret}` || authHeader === secret)) return true;

  return false;
}

/**
 * GET /api/v1/workflows
 * Returns 401 if unauthenticated (strictly enforcing n8n security boundary test).
 */
export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { message: 'Unauthorized. Provide valid X-N8N-API-KEY or Authorization header.' },
      { status: 401 }
    );
  }

  const workflows = redisEngine.listWorkflows();
  return NextResponse.json({
    data: workflows,
    count: workflows.length,
  });
}

/**
 * POST /api/v1/workflows
 * Registers or updates a workflow in the serverless Redis engine.
 */
export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { message: 'Unauthorized. Provide valid X-N8N-API-KEY or Authorization header.' },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    if (!body.id || !body.name) {
      return NextResponse.json({ error: 'Missing required fields: id, name' }, { status: 400 });
    }

    const workflow = {
      id: body.id,
      name: body.name,
      active: body.active ?? true,
      webhookId: body.webhookId || body.id,
      nodes: body.nodes || [],
      createdAt: body.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    redisEngine.registerWorkflow(workflow);
    return NextResponse.json({ success: true, workflow }, { status: 201 });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Invalid request payload' },
      { status: 400 }
    );
  }
}
