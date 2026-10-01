import { NextRequest, NextResponse } from 'next/server';
import { redisEngine } from '@/lib/redis-engine';
import { start } from 'workflow/api';
import { handleWebhookExecution } from '@/workflows/webhook';

export const runtime = 'nodejs';

/**
 * n8n-compatible Webhook Ingress Endpoint
 * POST /webhook/:id or POST /webhook/:id?action=...
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const secret = process.env.REDIS_AUTH_SECRET || process.env.N8N_API_KEY;
  const apiKey = request.headers.get('x-n8n-api-key');

  // Verify auth key if configured
  if (secret && apiKey && apiKey !== secret) {
    return NextResponse.json({ error: 'Forbidden: invalid API key' }, { status: 403 });
  }

  try {
    let payload: any = {};
    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      payload = await request.json();
    } else {
      payload = { rawText: await request.text() };
    }

    // Execute the workflow asynchronously via Vercel Workflows for durable execution
    const run: any = await start(handleWebhookExecution, [id, payload]);

    return NextResponse.json(
      {
        message: 'Workflow was started',
        executionId: run.workflowRunId || run.id || `wf-${Date.now()}`,
        status: 'running',
        data: { received: true, id: run.workflowRunId || run.id },
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Execution failed' },
      { status: 500 }
    );
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return NextResponse.json(
    {
      webhookId: id,
      status: 'active',
      method: 'POST',
      url: `/webhook/${id}`,
    },
    { status: 200 }
  );
}
