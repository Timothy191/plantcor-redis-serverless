# AGENTS.md — `redis/`

> **SSoT & Operational Context:** Next.js 15 Serverless Redis HTTP REST Proxy & In-Memory Engine. Deployed to Vercel project `plantcor-redis-serverless`.

---

## 1. Role & Wiring Invariants

- **Role**: Serverless HTTP REST Redis engine (consumed over HTTP by `Arch-System/packages/redis/src/serverless-client.ts` using `SERVERLESS_REDIS_URL` and `REDIS_AUTH_SECRET`). It is NOT a raw TCP Redis port.
- **Port**: Local dev server binds port **3005** (`pnpm dev`).
- **Never Run From Root**: Always run pnpm commands from inside `redis/`.
- **Contracts**: Path audits in `Arch-System/tools/zero-drift-watchdog/` cross-check client routes against `redis/src`.

---

## 2. Anti-Bloat Skill & Memory Protocol (`skills-mcp` & `memory-gateway-mcp`)

To prevent token bloat and memory degradation:
- **Skills**: Discover via `list_available_skills`, lease via `acquire_skill(skillName, agentId)`, and ALWAYS call `return_skill` upon task completion to release memory and log execution telemetry.
- **Context Slices**: Pull architectural invariants via `acquire_context("federated-invariants", agentId)` and release with `release_context`.
- **Memory Gateway**: Query past failures and retrospectives via `search_unified_memory(query)` before modifying REST endpoints or auth secrets.
- **Self-Maintenance Mandate**: Agents working in this directory are REQUIRED to keep this `AGENTS.md` and related documentation updated with any new contract changes, port wiring, or dependencies.

---

## 3. Essential Commands

```bash
pnpm dev              # Dev server on port 3005
pnpm build            # Next.js 15 build
pnpm lint             # Biome check
pnpm type-check       # TypeScript check
pnpm test             # Jest unit test suite
```
