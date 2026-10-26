// Seed script: creates one account per admin role plus test customer and captain accounts.
// Run once after initial setup: node apps/api/src/modules/auth/seed.js
// Safe to re-run: existing seeded accounts are skipped.
import { existsSync } from 'node:fs';
import mongoose from 'mongoose';

if (existsSync('.env')) process.loadEnvFile('.env');

import { loadEnv, EnvValidationError } from '../../config/env.js';
import { createLogger } from '../../config/logger.js';
import { connectMongo } from '../../db/connection.js';
import { User } from '../rbac/schemas/user.schema.js';
import { ROLES } from '../rbac/permissions.js';
import bcrypt from 'bcrypt';

const SEED_USERS = [
  { email: 'superadmin@vrumm.dev', role: ROLES.SUPER_ADMIN, displayName: 'Super Admin' },
  { email: 'ops@vrumm.dev', role: ROLES.OPERATIONS, displayName: 'Ops Agent' },
  { email: 'support@vrumm.dev', role: ROLES.SUPPORT, displayName: 'Support Agent' },
  { email: 'finance@vrumm.dev', role: ROLES.FINANCE, displayName: 'Finance Agent' },
  { email: 'marketing@vrumm.dev', role: ROLES.MARKETING, displayName: 'Marketing Agent' },
  { email: 'compliance@vrumm.dev', role: ROLES.COMPLIANCE, displayName: 'Compliance Agent' },
  {
    email: 'customer1@vrumm.dev',
    role: ROLES.CUSTOMER,
    displayName: 'Test Customer',
    phone: '+919876543210',
  },
  {
    email: 'captain1@vrumm.dev',
    role: ROLES.CAPTAIN,
    displayName: 'Test Captain',
    phone: '+919876543211',
  },
];

// Default seed password. Change immediately in any non-throwaway env.
const SEED_PASSWORD = 'Vrumm@Dev2026!';

async function seed() {
  let config;
  try {
    config = loadEnv();
  } catch (err) {
    if (err instanceof EnvValidationError) {
      // eslint-disable-next-line no-console
      console.error(err.message);
      process.exit(1);
    }
    throw err;
  }

  const logger = createLogger({ level: 'info' });
  await connectMongo({ uri: config.mongo.uri, dbName: config.mongo.dbName, logger });

  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 12);
  let created = 0,
    skipped = 0;

  for (const u of SEED_USERS) {
    const exists = await User.findOne({ email: u.email });
    if (exists) {
      skipped++;
      continue;
    }
    await User.create({ ...u, passwordHash, isSeeded: true });
    created++;
    logger.info({ email: u.email, role: u.role }, 'seed user created');
  }

  logger.info({ created, skipped }, 'seed complete');
  await mongoose.disconnect();
}

seed().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
