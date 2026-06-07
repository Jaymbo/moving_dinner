import express from 'express';
import cors from 'cors';
import { config } from './config';
import prisma from './db';

// Routes
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import groupRoutes from './routes/groups';
import joinRoutes from './routes/join';
import meetingRoutes from './routes/meetings';
import responseRoutes from './routes/responses';
import rsvpRoutes from './routes/rsvp';
import assignmentRoutes from './routes/assignment';
import publicRoutes from './routes/public';
import adminRoutes from './routes/admin';

// Jobs
import { startJobs } from './jobs';

const app = express();

app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/join', joinRoutes);
app.use('/api/meetings', meetingRoutes);
app.use('/api/responses', responseRoutes);
app.use('/api/rsvp', rsvpRoutes);
app.use('/api/assignment', assignmentRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/admin', adminRoutes);

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

const server = app.listen(config.port, async () => {
  try {
    await prisma.$connect();
    console.log(`Database connected`);
    console.log(`Server running on port ${config.port}`);
    startJobs();
  } catch (err) {
    console.error('Failed to connect to database:', err);
    process.exit(1);
  }
});

process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down...');
  server.close();
  await prisma.$disconnect();
  process.exit(0);
});