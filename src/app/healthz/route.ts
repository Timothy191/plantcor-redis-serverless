import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * n8n-compatible Health Check Endpoint
 * Serves GET /healthz
 * Returns HTTP 200 OK with operational metadata
 */
export async function GET() {
  return NextResponse.json(
    {
      status: 'ok',
      version: '1.0.0-serverless-hub',
      services: {
        redis: 'healthy',
        workflowEngine: 'healthy',
      },
      timestamp: new Date().toISOString(),
    },
    { status: 200 }
  );
}
