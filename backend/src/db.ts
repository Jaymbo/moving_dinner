import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const { Pool } = pg;

// Optimized PostgreSQL pool configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10, // Maximum pool size
  idleTimeoutMillis: 30000, // Close idle connections after 30s
  connectionTimeoutMillis: 5000, // Fail fast if no connection available
});

// Create Prisma adapter
const adapter = new PrismaPg(pool);

// Create PrismaClient with adapter
const prisma = new PrismaClient({ 
  adapter,
  log: process.env.NODE_ENV === 'production' ? ['error', 'warn'] : ['error', 'warn', 'query'],
});

export default prisma;
