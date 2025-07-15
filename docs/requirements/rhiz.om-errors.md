## rhiz.om Logging & Error-Handling Specification

*Revision · 12 Jul 2025*

---

### 1 Goals & Principles

| # | Principle                                                                                                                                                                                                                                            |
| - | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 | **Make bugs loud.** If an exception would leave the system in an indeterminate state, let the boundary crash—never hide it.                                                                                                                          |
| 2 | **Single, structured stream.** Every event—browser, API, worker—terminates in the same JSON-ND Winston log on the server.                                                                                                                               |
| 3 | **Zero-friction DX.** Pretty, colourised dev output; JSON in prod so containers can pipe straight to Loki, Datadog, CloudWatch, etc.                                                                                                                 |
| 4 | **Context everywhere.** Use Winston **child loggers** by module/request/component; tags are automatic, overhead is negligible.                                                                                         |
| 5 | **User clarity.** Surface errors either (a) via `<ErrorBoundary>` fallbacks, or (b) by persisting a **“error intention”** that contains a JSON content-island describing the failure.  |

---

### 2 Library Stack (verified July 2025)

| Runtime            | Package              | Min Version      | Notes                                                             |
| ------------------ | -------------------- | ---------------- | ----------------------------------------------------------------- |
| Node/Deno (server) | `winston`            | `^3.17`          | Current major → maintained & flexible                               |
|                    | `winston-transport`  | `^1.0`           | Base class for custom transports                                    |
| Browser            | `winston-browser`    | `^1.0`           | Browser-compatible Winston logger                                   |

> **Transport threading.** All heavy log processing should be handled asynchronously via Winston transports.

---

### 3 Logging Architecture

#### 3.1 Root Logger

```ts
// logger.ts
import winston from 'winston';

export const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
  format: winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(info => `${info.timestamp} ${info.level}: ${info.message}`)
  ),
  transports: [
    new winston.transports.Console()
  ],
  redact: ['req.headers.authorization', 'password']
});
```

* Prod emits one JSON line per event to **stdout**—the container takes it from there, matching industry best practice. ([overcast blog][7])
* Derive child loggers liberally:

  ```ts
  const log = logger.child({ mod: 'auth', fn: 'login', reqId });
  log.info('user authenticated');
  ```

#### 3.2 HTTP & WebSocket

For HTTP & WebSocket logging, integrate Winston with appropriate middleware (e.g., `express-winston` for Express).

#### 3.3 Browser Logger

```ts
import { createLogger } from 'winston';
import { WinstonBrowserTransport } from 'winston-browser';

export const log = createLogger({
  transports: [
    new WinstonBrowserTransport({
      level: 'error', // ship only errors by default
      endpoint: '/api/log',
      interval: 1000, // Batch logs every 1 second
    }),
  ],
});
```

#### 3.4 `POST /api/log` Contract

| Field     | Type       | Notes                  |
| --------- | ---------- | ---------------------- |
| `ts`      | `number`   | Epoch ms               |
| `level`   | Winston level | `'error'`, `'warn'`, … |
| `msg`     | `string`   | Human message          |
| `browser` | `true`     | Fixed flag             |
| `context` | `object`   | Arbitrary              |

Handler: `logger.child({ browser: true }).log(payload.level, payload.msg, payload.context)`.

---

### 4 Error-Handling Playbook

| Scope                                                                          | Pattern                                                                        | Reason                          |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ | ------------------------------- |
| Library/business code                                                          | **Don’t catch.** Let it bubble.                                                | Preserve stack & `cause`.       |
| Framework boundary (API entry, worker `onmessage`, cron)                       | `try … catch (err) { log.error(err); throw err; }`                             | Log once, still crash boundary. |
| UI components                                                                  | Wrap with `<ErrorBoundary>`; fallback shows red card + `log.error(err)`. | User sees local failure.        |
| Global unhandled (`window.onerror`, `unhandledrejection`, `uncaughtException`) | Log `fatal`; hard-reload client or exit process.                               | Fail fast, restart clean.       |

---

### 5 User-Facing Error Surfacing

| Channel                         | Mechanism                                                                                                                                                                                                                                                             | Persistence                                                                            |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Component rendering             |  `<ErrorBoundary>` fallback (`role="alert"`, red border).                                                                                                                                                                                                        | Volatile (disappears on rerender).                                                     |
| Background / streaming failures | **Error Intention** injected into current space. Content includes a **JSON content-island**:<br/>`jsonc\n{\n  \"kind\": \"error\",\n  \"payload\": {\n    \"message\": \"LLM tool 'fetchLabResults' failed: 504\",\n    \"time\": \"2025-07-12T22:11:45Z\"\n  }\n}\n` | Durable; stored like any other intention; visible to all participants until dismissed. |

If a server stream is already writing to an Intention, switch its status to `"error"` and append the JSON content-island in-place.

Finally, if no better mechanism is available, the user should still be notified of the errro: an error "Toast" or full screen overlay (depending on the severity of the error) can be used.

---

### 6 Operational Guidelines

| Topic                | Guidance                                                                                         |
| -------------------- | ------------------------------------------------------------------------------------------------ |
| Rotation & retention | Leave to container/cluster log driver; harvest stdout/stderr.                                    |
| Sampling             | If R2 egress grows, raise browser transmit level to `'fatal'` or sample `info` at 1 %.           |
| Alerting             | Aggregator rules on `level >= error`; optionally wire OpenTelemetry IDs for cross-trace linking. |
| Security             | Use Winston's `format.json` and custom formatters to redact PHI & secrets.                                                        |

---

### 7 Quick Start

```bash
# Server
npm install winston

# Client
npm install winston winston-browser
```

1. `import { logger }` on the server; derive child loggers per module.
2. `import { log }` in the browser root; use `log.<level>()`.
3. Ship code—logging now “just works” with modern, mainstream libraries and 2025 best practices.



