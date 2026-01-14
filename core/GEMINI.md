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
- **Logging**: Pino

## Project Structure
The project follows a **Service Layer Architecture** to separate concerns and ensure testability.

```text
core/
├── prisma/             # Database schema and migrations
├── src/
│   ├── controllers/    # HTTP Layer: Request validation, response formatting
│   ├── services/       # Business Logic Layer: Data processing, DB calls
│   ├── routes/         # Router definitions
│   ├── types/          # Shared interfaces and DTOs
│   ├── utils/          # Shared utilities (Logger, etc.)
│   ├── generated/      # Generated Prisma Client
│   ├── env.ts          # Environment variable validation (Zod)
│   ├── server.ts       # Application entry point & setup
│   └── logger.ts       # Logger configuration
└── ...
```

## Architectural Conventions

### 1. Service Layer Pattern
- **Controllers**: strictly handle HTTP concerns (status codes, headers, parsing `req.body`). They **must not** contain business logic or direct DB calls. They delegate work to Services.
- **Services**: contain the business logic. They interact with Prisma or Redis. They return plain objects or throw Errors. They **do not** know about `req` or `res`.
- **Routes**: map URLs to Controller methods.

### 2. Database Access
- Use `prisma` instance injected into Services or imported from a shared module if singleton is preferred (currently passed via constructor in `HealthService`).
- **Schema**: Defined in `prisma/schema.prisma`. Run `bun run generate` after changes.

### 3. Environment Variables
- Managed in `src/env.ts` using `zod`.
- Access via `import { env } from './env'`.

### 4. Logging
- Use `import { logger } from './utils/logger'` (or relative path).
- Structured logging with `pino`.

## Key Workflows
- **Health Check**: `GET /health` (Implemented via `HealthService`).

## Development
- **Start**: `bun run dev`
- **Lint**: `bun run lint`
- **DB Push**: `bun run db:push`
