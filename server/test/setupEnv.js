process.env.NODE_ENV = 'test';
process.env.DEV_AUTH_BYPASS = 'true';
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL || 'postgresql://lam:lam@localhost:5432/lam_test';
// Point at a dead port so AI/weather calls fail fast and exercise fallbacks
process.env.AI_SERVICE_URL = 'http://127.0.0.1:59999';
