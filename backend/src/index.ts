import express from 'express';
import { config } from './config.js';
import prisma from './db.js';
import { logger } from './utils/logger.js';
import { applySecurityMiddleware } from './middleware/security.js';
import { errorHandler } from './middleware/errorHandler.js';

// Routes
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import groupRoutes from './routes/groups.js';
import joinRoutes from './routes/join.js';
import meetingRoutes from './routes/meetings.js';
import responseRoutes from './routes/responses.js';
import rsvpRoutes from './routes/rsvp.js';
import assignmentRoutes from './routes/assignment.js';
import publicRoutes from './routes/public.js';
import adminRoutes from './routes/admin.js';
import featureRequestRoutes from './routes/featureRequests.js';

// Jobs
import { startJobs } from './jobs/index.js';

const app = express();

applySecurityMiddleware(app);

app.use(express.json());

// Health check
app.get('/api/health', async (_req, res, next) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', timestamp: new Date().toISOString(), database: 'connected' });
  } catch (err) {
    next(err);
  }
});

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/join', joinRoutes);
app.use('/api/meetings', meetingRoutes);
app.use('/api/meetings', responseRoutes);
app.use('/api/rsvp', rsvpRoutes);
app.use('/api/assignment', assignmentRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/feature-requests', featureRequestRoutes);

// Error handler
app.use(errorHandler);

const server = app.listen(config.port, async () => {
  try {
    await prisma.$connect();
    logger.info('Database connected');
    logger.info(`Server running on port ${config.port}`);
    startJobs();
  } catch (err) {
    logger.error(
      'Failed to connect to database',
      err instanceof Error ? { message: err.message } : undefined
    );
    process.exit(1);
  }
});

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down...');
  server.close();
  await prisma.$disconnect();
  process.exit(0);
});
