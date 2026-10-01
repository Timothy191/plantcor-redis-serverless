import { ServerlessRedisEngine } from './redis-engine';

describe('ServerlessRedisEngine', () => {
  let engine: ServerlessRedisEngine;

  beforeEach(() => {
    engine = ServerlessRedisEngine.getInstance();
    engine.flushall();
  });

  test('set and get value', () => {
    engine.set('test:key', 'hello-world');
    expect(engine.get('test:key')).toBe('hello-world');
  });

  test('expiration handling', async () => {
    engine.set('test:ttl', 'expiring-val', 1);
    expect(engine.get('test:ttl')).toBe('expiring-val');

    // Simulate TTL expiration
    await new Promise((r) => setTimeout(r, 1100));
    expect(engine.get('test:ttl')).toBeNull();
  });

  test('incr and decr', () => {
    expect(engine.incr('counter')).toBe(1);
    expect(engine.incr('counter')).toBe(2);
    expect(engine.decr('counter')).toBe(1);
  });

  test('tag invalidation', () => {
    engine.set('item:1', 'val1', 30, ['dept:engineering']);
    engine.set('item:2', 'val2', 30, ['dept:engineering']);
    engine.set('item:3', 'val3', 30, ['dept:control-room']);

    expect(engine.get('item:1')).toBe('val1');
    engine.invalidateTags('dept:engineering');

    expect(engine.get('item:1')).toBeNull();
    expect(engine.get('item:2')).toBeNull();
    expect(engine.get('item:3')).toBe('val3');
  });

  test('hash commands (hset, hget, hgetall, hdel)', () => {
    expect(engine.hset('user:100', 'name', 'Alice')).toBe(1);
    expect(engine.hset('user:100', 'role', 'Operator')).toBe(1);
    expect(engine.hset('user:100', 'name', 'Alicia')).toBe(0); // overwrite existing

    expect(engine.hget('user:100', 'name')).toBe('Alicia');
    expect(engine.hget('user:100', 'role')).toBe('Operator');
    expect(engine.hget('user:100', 'missing')).toBeNull();

    const all = engine.hgetall('user:100');
    expect(all).toEqual({ name: 'Alicia', role: 'Operator' });

    expect(engine.hdel('user:100', 'role')).toBe(1);
    expect(engine.hget('user:100', 'role')).toBeNull();
  });

  test('set commands (sadd, smembers, srem)', () => {
    expect(engine.sadd('active_trucks', 'DT01', 'DT02', 'DT03')).toBe(3);
    expect(engine.sadd('active_trucks', 'DT01')).toBe(0); // already exists

    const members = engine.smembers('active_trucks');
    expect(members).toContain('DT01');
    expect(members).toContain('DT02');
    expect(members).toContain('DT03');

    expect(engine.srem('active_trucks', 'DT02')).toBe(1);
    expect(engine.smembers('active_trucks')).not.toContain('DT02');
  });

  test('stream commands (xadd, xrange, xlen)', () => {
    const id1 = engine.xadd('telemetry_stream', '*', { temp: '75', rpm: '1200' });
    const id2 = engine.xadd('telemetry_stream', '*', { temp: '78', rpm: '1250' });

    expect(id1).toBeDefined();
    expect(id2).toBeDefined();
    expect(engine.xlen('telemetry_stream')).toBe(2);

    const range = engine.xrange('telemetry_stream');
    expect(range.length).toBe(2);
    expect(range[0].data.temp).toBe('75');
    expect(range[1].data.rpm).toBe('1250');
  });

  test('workflow execution engine', async () => {
    engine.registerWorkflow({
      id: 'test-wf',
      name: 'Shift Alert Pipeline',
      active: true,
      webhookId: 'test-shift-hook',
      nodes: [
        {
          id: 'step-1',
          name: 'Transform Event',
          type: 'transform',
          config: { attachTimestamp: true },
        },
        {
          id: 'step-2',
          name: 'Save Cache',
          type: 'redis_set',
          config: { keyPrefix: 'test:cache:' },
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const execution = await engine.executeWorkflow('test-shift-hook', {
      shiftId: 'shift-99',
      site: 'Brakfontein',
    });

    expect(execution.status).toBe('success');
    expect(execution.outputData).toHaveProperty('cachedKey');
    expect(execution.stepResults['step-1']).toBeDefined();

    const logged = engine.getExecution(execution.id);
    expect(logged).not.toBeNull();
    expect(logged?.id).toBe(execution.id);
  });
});
