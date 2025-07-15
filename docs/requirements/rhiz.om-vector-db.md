# Rhiz.om Persistence-Layer Requirements

## Vector Store Component (v 1.0 – 12 Jul 2025)

---

### 1 – Purpose & Scope

Rhiz.om needs a fast, low-latency semantic search layer that sits alongside existing storage (Cloudflare R2 for blobs, Deno KV for low-latency key/value). This document locks in the requirements for that vector database and codifies how it integrates with the rest of the stack.

---

### 2 – Selection Summary

| Criterion                           | Requirement                                                                | Chosen Solution                                    |
| ----------------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------- |
| Edge-local to Workers / Deno Deploy | Must execute in the same PoP as Worker code to avoid cross-region RTT      | **Cloudflare Vectorize**                           |
| Network egress fees                 | Zero when accessed from Workers or public Internet                         | Vectorize inherits R2’s \$0/GB egress model        |
| API surface                         | Simple HTTPS+JSON (no client lib lock-in)                                  | Vectorize REST v2                                  |
| Pricing                             | Starts at \$0 beyond Workers Paid plan; scales linearly; no cluster sizing | Workers Paid base (\$5/mo) + per-dimension overage |
| Capacity needs                      | Launch: ≤ 2 M vectors × 1 536 dims; Year-1: ≤ 50 M vectors                 | Vectorize per-index limits = 1 B vectors           |
| Query types                         | k-NN (top-k), metadata filters, cosine/dot/L2                              | All supported natively                             |

---

### 3 – Functional Requirements

1. **Upsert**

   * Accept single or batched vectors (`≤512` per call).
   * Each vector **must** carry a stable `id` (`string`), `values` (`float[]`), and `metadata` JSON with at minimum:

     ```jsonc
     {
       "r2Key": "blobs/<uuid>",
       "type": "doc|image|audio|embed-cache",
       "createdAt": "<ISO-8601>"
     }
     ```
2. **Query**

   * `topK` (default = 10, max = 100).
   * Filter syntax must support equality and range operations on numeric / string metadata fields (e.g., `type = 'doc' AND createdAt > '2025-01-01'`).
   * Returned payload **must** include vector `id`, `score`, and original `metadata`.
3. **Delete**

   * Hard delete by `id`.
   * Bulk delete by metadata filter (for GDPR/“right to be forgotten”).
4. **Index Configuration**

   * Default metric: **cosine**.
   * HNSW parameters: `M=16`, `efConstruction=200` (vectorize defaults); override only if benchmark shows win ≥ 10 % recall at same latency.
   * Replicas: 1 (edge replication is handled by Cloudflare automatically).
5. **Namespaces / Multitenancy**

   * One Vectorize index per logical Rhiz.om **space** (tenant) to isolate RBAC, billing, and potential export/deletion.
6. **Atomicity**

   * Upsert returns 2xx only after index write is replicated; caller retries on 5xx (idempotent via `id`).

---

### 4 – Non-Functional Requirements

| Category          | Requirement                                                                                                                   |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **Latency**       | P95 ≤ 25 ms wall-clock for `query` (text embedding + Vectorize round-trip) under 1 K QPS, measured from any North-America PoP |
| **Throughput**    | Sustain ≥ 500 upserts/sec and ≥ 1 000 queries/sec per space without manual scaling                                            |
| **Durability**    | Vector index replicas >3, managed by Cloudflare; SLA = 99.999 % availability                                                  |
| **Consistency**   | Upsert → Query visibility ≤ 5 s (eventual, edge replicated)                                                                   |
| **Security**      | Access controlled by Account-scoped API tokens; one Wrangler binding per index; no public API keys embedded in client JS      |
| **Observability** | Emit per-request logs to Logpush; hit counts and dim totals exported daily to Deno KV “usage” bucket for budgeting scripts    |

---

### 5 – Cost Management & Safeguards

1. **Free-tier Protection**

   * Since a payment method is mandatory, attach a **pre-paid card** with \$25 limit to the dev account.
   * Dashboard usage alerts at 50 % & 90 % of the free caps (5 M writes, 30 M queried dims).
2. **Runaway Guard**

   * Cron Worker checks `/accounts/<id>/vectorize/usage` daily; if `queried_dims_this_month > 25 M`, flip `kv.limitExceeded = true`; gateway Worker returns 429 for further search requests.
3. **Budget Logging**

   * Append monthly totals (storage dims, queried dims) to Deno KV → piped to Supabase analytics for dashboards.

---

### 6 – Integration Pattern

```mermaid
graph TD
  subgraph Edge Worker
    A(Receive request) --> B{Need embedding?}
    B -- No --> C[Query Vectorize]
    B -- Yes --> D[Workers AI embed(text)]
    D --> C
    C --> E{Need full file?}
    E -- Yes --> F[R2 GET blob]
    E -- No --> G[Return result]
    F --> G
  end
```

* **Edge only**: all hops stay inside Cloudflare’s network – no egress fees.
* **Deno KV** caches last-used embeddings & query results under a 10-minute TTL.

---

### 7 – Dev → Prod Promotion

| Stage         | Action                                                                                                                 |
| ------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **Local dev** | Hono/Deno test harness hits Vectorize dev index; seeded with 1 K vectors.                                              |
| **Preview**   | Wrangler publish to `*.workers.dev`; index limits 100 K vectors; enable daily cleanup Worker.                          |
| **Prod**      | Dedicated account & billing profile; index per space created lazily on first write. Terraform manages binding secrets. |

---

### 8 – Open Questions / TODO

| # | Topic                                                            | Owner     | Due        |
| - | ---------------------------------------------------------------- | --------- | ---------- |
| 1 | Benchmark HNSW tuning for 768-dim vs 1 536-dim embeddings        | @backend  | 2025-07-19 |
| 2 | Decide on vector schema versioning strategy (for model upgrades) | @ai-team  | 2025-07-22 |
| 3 | Implement GDPR bulk-delete endpoint plumbing                     | @platform | 2025-07-31 |

---

### 9 – Acceptance Criteria

1. End-to-end search demo returns <= 10 ms Vectorize latency at P95 for 1 536-dim queries (10 K-vector index).
2. Exceeding free-tier caps in staging triggers automated 429 within 60 s.
3. Data model and index lifecycle (create / drop with tenant) covered by Terraform CI pipeline.

---

**Signed-off:**
*Product / Platform Joint Tech Council – 12 Jul 2025*
