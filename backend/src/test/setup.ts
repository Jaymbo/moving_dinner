// Set test environment variables
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://movingdinner:movingdinner@localhost:5432/movingdinner_test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-min-32-characters-long-for-testing';
process.env.NODE_ENV = 'test';
