/**
 * Serverless Redis In-Memory Engine & Automation Hub
 * Engineered for Vercel Edge & Serverless Functions
 * Incorporates n8n-compatible workflow execution, streams, and hash structures
 */

export interface RedisEntry {
  value: string;
  expiresAt: number | null;
  tags?: string[];
}

export interface StreamMessage {
  id: string;
  timestamp: number;
  data: Record<string, string>;
}

export interface WorkflowStep {
  id: string;
  name: string;
  type: 'transform' | 'redis_set' | 'redis_get' | 'webhook_forward' | 'condition';
  config: Record<string, any>;
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  active: boolean;
  webhookId?: string;
  nodes: WorkflowStep[];
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  status: 'running' | 'success' | 'failed';
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  inputData: any;
  outputData?: any;
  stepResults: Record<string, any>;
  error?: string;
}

export class ServerlessRedisEngine {
  private static instance: ServerlessRedisEngine;
  private store = new Map<string, RedisEntry>();
  private hashes = new Map<string, Map<string, string>>();
  private sets = new Map<string, Set<string>>();
  private streams = new Map<string, StreamMessage[]>();
  private tagIndex = new Map<string, Set<string>>(); // tag -> Set of keys

  // Workflows & Executions
  private workflows = new Map<string, WorkflowDefinition>();
  private executions = new Map<string, WorkflowExecution>();

  private maxKeys = 10000;

  private constructor() {
    // Seed standard fallback automation workflow
    this.registerWorkflow({
      id: 'default-telemetry-pipeline',
      name: 'Default Telemetry & Shift Automation Pipeline',
      active: true,
      webhookId: 'shift-closeout-webhook',
      nodes: [
        {
          id: 'step-1-transform',
          name: 'Normalize Payload',
          type: 'transform',
          config: { attachTimestamp: true },
        },
        {
          id: 'step-2-cache',
          name: 'Cache Event in Redis',
          type: 'redis_set',
          config: { keyPrefix: 'telemetry:last_event:' },
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  public static getInstance(): ServerlessRedisEngine {
    if (!ServerlessRedisEngine.instance) {
      ServerlessRedisEngine.instance = new ServerlessRedisEngine();
    }
    return ServerlessRedisEngine.instance;
  }

  private isExpired(entry: RedisEntry): boolean {
    if (entry.expiresAt === null) return false;
    return Date.now() > entry.expiresAt;
  }

  private purgeIfExpired(key: string): boolean {
    const entry = this.store.get(key);
    if (!entry) return true;
    if (this.isExpired(entry)) {
      this.del(key);
      return true;
    }
    return false;
  }

  // --- String / KV Commands ---

  public get(key: string): string | null {
    if (this.purgeIfExpired(key)) return null;
    const entry = this.store.get(key);
    return entry ? entry.value : null;
  }

  public set(key: string, value: string, ttlSeconds?: number, tags?: string[]): 'OK' {
    if (this.store.size >= this.maxKeys && !this.store.has(key)) {
      const firstKey = this.store.keys().next().value;
      if (firstKey !== undefined) {
        this.del(firstKey);
      }
    }

    const expiresAt = ttlSeconds && ttlSeconds > 0 ? Date.now() + ttlSeconds * 1000 : null;
    this.store.set(key, { value, expiresAt, tags });

    if (tags && tags.length > 0) {
      for (const tag of tags) {
        if (!this.tagIndex.has(tag)) {
          this.tagIndex.set(tag, new Set());
        }
        this.tagIndex.get(tag)?.add(key);
      }
    }

    return 'OK';
  }

  public del(...keys: string[]): number {
    let count = 0;
    for (const key of keys) {
      const entry = this.store.get(key);
      if (entry) {
        if (entry.tags) {
          for (const tag of entry.tags) {
            this.tagIndex.get(tag)?.delete(key);
          }
        }
        if (this.store.delete(key)) count++;
      }
      if (this.hashes.delete(key)) count++;
      if (this.sets.delete(key)) count++;
      if (this.streams.delete(key)) count++;
    }
    return count;
  }

  public exists(key: string): number {
    if (this.hashes.has(key) || this.sets.has(key) || this.streams.has(key)) return 1;
    return this.purgeIfExpired(key) ? 0 : 1;
  }

  public keys(pattern: string): string[] {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    const matching = new Set<string>();
    for (const key of this.store.keys()) {
      if (!this.purgeIfExpired(key) && regex.test(key)) {
        matching.add(key);
      }
    }
    for (const key of this.hashes.keys()) {
      if (regex.test(key)) matching.add(key);
    }
    for (const key of this.sets.keys()) {
      if (regex.test(key)) matching.add(key);
    }
    for (const key of this.streams.keys()) {
      if (regex.test(key)) matching.add(key);
    }
    return Array.from(matching);
  }

  public incr(key: string): number {
    const currentStr = this.get(key) || '0';
    const num = parseInt(currentStr, 10);
    const nextVal = isNaN(num) ? 1 : num + 1;
    const entry = this.store.get(key);
    const ttlSeconds = entry?.expiresAt ? Math.ceil((entry.expiresAt - Date.now()) / 1000) : undefined;
    this.set(key, nextVal.toString(), ttlSeconds);
    return nextVal;
  }

  public decr(key: string): number {
    const currentStr = this.get(key) || '0';
    const num = parseInt(currentStr, 10);
    const nextVal = isNaN(num) ? 0 : num - 1;
    const entry = this.store.get(key);
    const ttlSeconds = entry?.expiresAt ? Math.ceil((entry.expiresAt - Date.now()) / 1000) : undefined;
    this.set(key, nextVal.toString(), ttlSeconds);
    return nextVal;
  }

  public expire(key: string, ttlSeconds: number): number {
    const entry = this.store.get(key);
    if (!entry || this.isExpired(entry)) return 0;
    entry.expiresAt = Date.now() + ttlSeconds * 1000;
    return 1;
  }

  public ttl(key: string): number {
    const entry = this.store.get(key);
    if (!entry) return -2;
    if (entry.expiresAt === null) return -1;
    const remainingSeconds = Math.ceil((entry.expiresAt - Date.now()) / 1000);
    return remainingSeconds > 0 ? remainingSeconds : -2;
  }

  public invalidateTags(...tags: string[]): number {
    let evicted = 0;
    for (const tag of tags) {
      const keySet = this.tagIndex.get(tag);
      if (keySet) {
        for (const key of keySet) {
          if (this.store.delete(key)) evicted++;
        }
        this.tagIndex.delete(tag);
      }
    }
    return evicted;
  }

  public flushall(): 'OK' {
    this.store.clear();
    this.hashes.clear();
    this.sets.clear();
    this.streams.clear();
    this.tagIndex.clear();
    this.executions.clear();
    return 'OK';
  }

  // --- Hash Commands (HSET, HGET, HGETALL, HDEL) ---

  public hset(key: string, field: string, value: string): number {
    let hash = this.hashes.get(key);
    if (!hash) {
      hash = new Map<string, string>();
      this.hashes.set(key, hash);
    }
    const isNew = !hash.has(field);
    hash.set(field, value);
    return isNew ? 1 : 0;
  }

  public hget(key: string, field: string): string | null {
    const hash = this.hashes.get(key);
    if (!hash) return null;
    return hash.get(field) ?? null;
  }

  public hgetall(key: string): Record<string, string> {
    const hash = this.hashes.get(key);
    if (!hash) return {};
    const result: Record<string, string> = {};
    for (const [f, v] of hash.entries()) {
      result[f] = v;
    }
    return result;
  }

  public hdel(key: string, ...fields: string[]): number {
    const hash = this.hashes.get(key);
    if (!hash) return 0;
    let count = 0;
    for (const f of fields) {
      if (hash.delete(f)) count++;
    }
    return count;
  }

  // --- Set Commands (SADD, SMEMBERS, SREM) ---

  public sadd(key: string, ...members: string[]): number {
    let set = this.sets.get(key);
    if (!set) {
      set = new Set<string>();
      this.sets.set(key, set);
    }
    let added = 0;
    for (const m of members) {
      if (!set.has(m)) {
        set.add(m);
        added++;
      }
    }
    return added;
  }

  public smembers(key: string): string[] {
    const set = this.sets.get(key);
    return set ? Array.from(set) : [];
  }

  public srem(key: string, ...members: string[]): number {
    const set = this.sets.get(key);
    if (!set) return 0;
    let removed = 0;
    for (const m of members) {
      if (set.delete(m)) removed++;
    }
    return removed;
  }

  // --- Stream Commands (XADD, XRANGE, XLEN) ---

  public xadd(key: string, id: string, data: Record<string, string>): string {
    let stream = this.streams.get(key);
    if (!stream) {
      stream = [];
      this.streams.set(key, stream);
    }
    const msgId = id === '*' ? `${Date.now()}-${stream.length}` : id;
    stream.push({
      id: msgId,
      timestamp: Date.now(),
      data,
    });
    // Cap stream at 1000 items
    if (stream.length > 1000) {
      stream.shift();
    }
    return msgId;
  }

  public xrange(key: string, start = '-', end = '+', count = 100): StreamMessage[] {
    const stream = this.streams.get(key);
    if (!stream) return [];
    return stream.slice(0, count);
  }

  public xlen(key: string): number {
    return this.streams.get(key)?.length ?? 0;
  }

  // --- Workflow Automation Engine (n8n-compatible) ---

  public registerWorkflow(def: WorkflowDefinition): void {
    this.workflows.set(def.id, def);
    if (def.webhookId) {
      this.workflows.set(`webhook:${def.webhookId}`, def);
    }
  }

  public getWorkflow(id: string): WorkflowDefinition | null {
    return this.workflows.get(id) || this.workflows.get(`webhook:${id}`) || null;
  }

  public listWorkflows(): WorkflowDefinition[] {
    const set = new Set(this.workflows.values());
    return Array.from(set);
  }

  public async executeWorkflow(
    workflowIdOrWebhook: string,
    inputPayload: any
  ): Promise<WorkflowExecution> {
    const workflow = this.getWorkflow(workflowIdOrWebhook);
    const executionId = `exec-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const startTime = Date.now();

    const execution: WorkflowExecution = {
      id: executionId,
      workflowId: workflow ? workflow.id : workflowIdOrWebhook,
      status: 'running',
      startedAt: new Date(startTime).toISOString(),
      inputData: inputPayload,
      stepResults: {},
    };

    this.executions.set(executionId, execution);

    if (!workflow || !workflow.active) {
      execution.status = 'success';
      execution.completedAt = new Date().toISOString();
      execution.durationMs = Date.now() - startTime;
      execution.outputData = {
        received: inputPayload,
        processed: true,
        note: 'Default serverless passthrough execution',
      };
      return execution;
    }

    let currentPayload = inputPayload;
    try {
      for (const node of workflow.nodes) {
        const stepStart = Date.now();
        let stepOutput: any;

        switch (node.type) {
          case 'transform':
            stepOutput = {
              ...currentPayload,
              ...(node.config.attachTimestamp ? { _processedAt: new Date().toISOString() } : {}),
            };
            break;
          case 'redis_set': {
            const prefix = node.config.keyPrefix || 'workflow:cache:';
            const cacheKey = `${prefix}${workflow.id}:${Date.now()}`;
            this.set(cacheKey, JSON.stringify(currentPayload), node.config.ttlSeconds || 3600);
            stepOutput = { cachedKey: cacheKey, ok: true };
            break;
          }
          case 'redis_get': {
            const val = this.get(node.config.key);
            stepOutput = { key: node.config.key, value: val ? JSON.parse(val) : null };
            break;
          }
          default:
            stepOutput = { status: 'skipped', node: node.name };
        }

        execution.stepResults[node.id] = {
          name: node.name,
          durationMs: Date.now() - stepStart,
          output: stepOutput,
        };
        currentPayload = stepOutput;
      }

      execution.status = 'success';
      execution.outputData = currentPayload;
    } catch (err: unknown) {
      execution.status = 'failed';
      execution.error = err instanceof Error ? err.message : String(err);
    } finally {
      execution.completedAt = new Date().toISOString();
      execution.durationMs = Date.now() - startTime;
    }

    return execution;
  }

  public getExecution(id: string): WorkflowExecution | null {
    return this.executions.get(id) || null;
  }

  public listExecutions(limit = 50): WorkflowExecution[] {
    const list = Array.from(this.executions.values());
    return list.slice(-limit).reverse();
  }

  // --- Generic Command Dispatcher ---

  public executeCommand(command: string, args: string[]): any {
    const cmd = command.toUpperCase();
    switch (cmd) {
      case 'PING':
        return 'PONG';
      case 'GET':
        return this.get(args[0]);
      case 'SET':
        return this.set(args[0], args[1], args[2] ? parseInt(args[2], 10) : undefined);
      case 'SETEX':
        return this.set(args[0], args[2], parseInt(args[1], 10));
      case 'DEL':
        return this.del(...args);
      case 'EXISTS':
        return this.exists(args[0]);
      case 'KEYS':
        return this.keys(args[0] || '*');
      case 'INCR':
        return this.incr(args[0]);
      case 'DECR':
        return this.decr(args[0]);
      case 'EXPIRE':
        return this.expire(args[0], parseInt(args[1], 10));
      case 'TTL':
        return this.ttl(args[0]);
      case 'HSET':
        return this.hset(args[0], args[1], args[2]);
      case 'HGET':
        return this.hget(args[0], args[1]);
      case 'HGETALL':
        return this.hgetall(args[0]);
      case 'HDEL':
        return this.hdel(args[0], ...args.slice(1));
      case 'SADD':
        return this.sadd(args[0], ...args.slice(1));
      case 'SMEMBERS':
        return this.smembers(args[0]);
      case 'SREM':
        return this.srem(args[0], ...args.slice(1));
      case 'XADD':
        return this.xadd(args[0], args[1], JSON.parse(args[2] || '{}'));
      case 'XRANGE':
        return this.xrange(args[0], args[1], args[2], args[3] ? parseInt(args[3], 10) : undefined);
      case 'XLEN':
        return this.xlen(args[0]);
      case 'INVALIDATE_TAGS':
        return this.invalidateTags(...args);
      case 'FLUSHALL':
        return this.flushall();
      default:
        throw new Error(`Unsupported Redis command: ${command}`);
    }
  }
}

export const redisEngine = ServerlessRedisEngine.getInstance();
