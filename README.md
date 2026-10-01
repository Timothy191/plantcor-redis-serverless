# Plantcor Serverless Redis Engine

Enterprise Vercel-deployable Serverless Redis HTTP REST Proxy & In-Memory Engine.

Designed to fulfill the serverless Redis requirements of **Arch-System** when deployed to Vercel.

---

## Features

- **Vercel Serverless Native**: Executes in Edge & Node.js Serverless Functions without persistent TCP connection hangs.
- **REST API Compatible**: Full REST command set (`GET`, `POST /set`, `POST /setex`, `POST /pipeline`).
- **Tag Invalidation**: Built-in `INVALIDATE_TAGS` support for tag-based cache eviction.
- **Auto-Eviction**: In-memory LRU eviction and active TTL management.

---

## Deployment to Vercel

```bash
cd /home/tim/Fork/redis
vercel --prod
```

After deployment, copy your Vercel deployment URL (e.g. `https://plantcor-redis.vercel.app`) and set it in your **Arch-System** Vercel environment variables:

```env
SERVERLESS_REDIS_URL=https://plantcor-redis.vercel.app/api/v1
REDIS_AUTH_SECRET=plantcor-redis-secret
```

---

## Architecture Integration with Arch-System

`@repo/redis` in `Arch-System` connects directly to this serverless Redis REST API on Vercel deployments, providing zero-waterfall caching, tag invalidation, and rate limiting without requiring external paid Redis clusters or failing on `localhost`.
