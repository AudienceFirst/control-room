#!/usr/bin/env node

const path = require('path');
const { execSync } = require('child_process');
require('dotenv').config();

function main() {
  const dbUrl = process.env.DATABASE_URL;

  if (!dbUrl) {
    console.error('DATABASE_URL is not set in .env');
    process.exit(1);
  }

  if (!dbUrl.startsWith('file:')) {
    console.error(
      `Expected a SQLite file URL (starting with "file:"), but got: ${dbUrl}`
    );
    process.exit(1);
  }

  const projectRoot = path.resolve(__dirname, '..');

  try {
    console.log('Using DATABASE_URL =', dbUrl);
    console.log('Pushing Prisma schema to SQLite database...');

    execSync('npx prisma db push', {
      stdio: 'inherit',
      cwd: projectRoot,
      env: {
        ...process.env,
        DATABASE_URL: dbUrl,
      },
    });

    console.log('SQLite database successfully initialized.');
  } catch (error) {
    console.error('Failed to initialize SQLite database.');
    if (error.stderr) {
      console.error(error.stderr.toString());
    }
    process.exit(error.status ?? 1);
  }
}

main();

