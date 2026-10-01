export default function RedisStatusPage() {
  return (
    <main style={{ fontFamily: 'sans-serif', padding: '2rem', background: '#f3f4f6', minHeight: '100vh', color: '#111827' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto', background: '#ffffff', borderRadius: '12px', padding: '2rem', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
        <h1 style={{ color: '#1e3a8a', marginTop: 0 }}>⚡ Plantcor Serverless Redis Engine</h1>
        <p style={{ color: '#4b5563' }}>
          Enterprise Vercel-deployable Serverless Redis HTTP REST Proxy & In-Memory Engine powering Arch-System monorepo.
        </p>

        <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '1rem', margin: '1.5rem 0' }}>
          <h3 style={{ marginTop: 0, color: '#111827' }}>Status & Health</h3>
          <p style={{ margin: '0.25rem 0' }}><strong>Status:</strong> <span style={{ color: '#059669', fontWeight: 'bold' }}>OPERATIONAL</span></p>
          <p style={{ margin: '0.25rem 0' }}><strong>REST Endpoint:</strong> <code>/api/v1/[...command]</code></p>
          <p style={{ margin: '0.25rem 0' }}><strong>Health Check:</strong> <code>/api/v1/health</code></p>
        </div>

        <h3>Supported Redis REST Commands</h3>
        <ul style={{ color: '#374151', lineHeight: '1.6' }}>
          <li><code>GET /api/v1/get/:key</code></li>
          <li><code>POST /api/v1/set/:key/:val</code></li>
          <li><code>POST /api/v1/setex/:key/:ttlSeconds/:val</code></li>
          <li><code>GET /api/v1/del/:key</code></li>
          <li><code>GET /api/v1/incr/:key</code></li>
          <li><code>POST /api/v1/pipeline</code> (Batch command execution)</li>
        </ul>
      </div>
    </main>
  );
}
