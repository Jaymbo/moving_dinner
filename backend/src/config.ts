import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  databaseUrl: process.env.DATABASE_URL || 'postgresql://movingdinner:movingdinner@localhost:5432/movingdinner?schema=public',
  jwtSecret: process.env.JWT_SECRET || 'change-me-in-production',
  smtp: {
    host: process.env.SMTP_HOST || 'smtp.example.com',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || 'Moving Dinner <noreply@example.com>',
  },
  baseUrl: process.env.BASE_URL || 'http://localhost:3000',
};