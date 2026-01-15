# Quest Rider - Core Service

## Project Overview

Quest Rider is an educational platform designed for interactive coding challenges and course management. It allows Educators to create Courses composed of Modules and Stages, where Students can submit code to pass Tests.

## Tech Stack

- **Runtime**: [Bun](https://bun.sh/)
- **Language**: TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL
- **ORM**: Prisma (with `@prisma/adapter-pg`)
- **Caching/State**: Redis (via `ioredis`)
- **Validation**: Zod (Env vars & Input)
- **Logging**: Pino & Pino-HTTP
- **Auth**: Paseto (V4 Local), Argon2

## Project Structure

The project follows a **Service Layer Architecture** to separate concerns and ensure testability.

```text
core/
├── prisma/             # Database schema and migrations
├── scripts/            # Maintenance and utility scripts
├── src/
│   ├── controllers/    # HTTP Layer: Request validation, response formatting
│   ├── services/       # Business Logic Layer: Data processing, DB calls
│   ├── routes/         # Router definitions
│   ├── middlewares/    # Express middlewares (Auth, Error, etc.)
│   ├── schemas/        # Zod validation schemas
│   ├── types/          # Shared interfaces and DTOs
│   ├── utils/          # Shared utilities (Auth, Errors, Validation)
│   ├── generated/      # Generated Prisma Client
│   ├── db.ts           # Prisma client initialization
│   ├── redis.ts        # Redis client initialization
│   ├── env.ts          # Environment variable validation (Zod)
│   ├── server.ts       # Application entry point & setup
│   └── logger.ts       # Logger & HTTP Logger configuration
└── ...
```

## Architectural Conventions

### 1. Service Layer Pattern

- **Controllers**: Strictly handle HTTP concerns (status codes, headers, calling validation). They **must not** contain business logic or direct DB calls. They delegate work to Services.
- **Services**: Contain the business logic. They interact with Prisma or Redis. They return plain objects or throw specialized Errors. They **do not** know about `req` or `res`.
- **Routes**: Map URLs to Controller methods.

### 2. Error Handling & Logging

- **Unified Errors**: Use specialized error classes from `src/utils/errors.ts` (e.g., `NotFoundError`, `ValidationError`, `UnauthorizedError`).
- **Log-Once Policy**: Business logic only throws errors. The `errorHandler` middleware catches them, attaches metadata, and `httpLogger` logs the final result.
- **Automated Logging**: `httpLogger` (Pino-HTTP) automatically logs all requests. Manual `logger.info` is discouraged in Services/Controllers.
- **Debug Logs**: Use `logger.debug` for tracing complex logic during development.
- **Sanitization**: In development mode, request bodies and cookies are logged but sensitive fields (passwords, tokens) are redacted in the serializer.

### 3. Validation

- Use `handleValidation(schema, data)` utility in Controllers. It automatically throws a `ValidationError` if parsing fails, which is then handled by the global error middleware.

### 4. Database & Redis

- **Prisma**: Accessed via the singleton `prisma` instance from `src/db.ts`.
- **Redis**: Accessed via the singleton `redis` instance from `src/redis.ts`.

### 5. Environment Variables

- Managed in `src/env.ts` using `zod`. Access via `import { env } from './env'`.

## Key Workflows

- **Health Check**: `GET /health` (Checks DB and Redis status).
- **Authentication**: JWT-like flow using Paseto tokens stored in HttpOnly cookies.

## Development

- **Start**: `bun run dev`
- **Lint**: `bun run lint` (TypeScript type check)
- **Generate Client**: `bun run generate` (Prisma)
- **DB Push**: `bun run db:push`