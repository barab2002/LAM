const { execSync } = require('child_process');

module.exports = async function globalSetup() {
  const url =
    process.env.TEST_DATABASE_URL || 'postgresql://lam:lam@localhost:5432/lam_test';
  // Reset the test database schema before the suite runs
  execSync('npx prisma db push --force-reset --skip-generate', {
    cwd: __dirname + '/..',
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'inherit',
  });
};
