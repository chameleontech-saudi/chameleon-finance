const requiredEnvVars = ['DATABASE_URL', 'JWT_SECRET'];
const missing = requiredEnvVars.filter((name) => !process.env[name]);

if (missing.length > 0) {
  console.error(`Missing required environment variable${missing.length === 1 ? '' : 's'}: ${missing.join(', ')}`);
  console.error('Create .env from .env.example before running the dashboard locally.');
  process.exit(1);
}
