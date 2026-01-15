import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client";
import { env } from "./env";

const pool = new Pool({
    connectionString: env.DATABASE_URL,
    max: 50,
    min: 10,
    maxLifetimeSeconds: 3600, // 1 hour
    idleTimeoutMillis: 30000, // 30 seconds
    connectionTimeoutMillis: 60000, // 60 seconds
});
const adapter = new PrismaPg(pool);

export const prisma = new PrismaClient({ adapter });
