#!/usr/bin/env npx tsx

import * as jwt from 'jsonwebtoken';

// Your JWT secret
const JWT_SECRET = 'dLmgH/rZWIkdAWXuv62Tqvh9rF8PDAHvteaK/rMJKi4G1jbbcsaaHC9oBMZoAE0MsRJv5v5XalkDrOXP8acjtw==';

// Generate service role key
const payload = {
  iss: 'supabase',
  ref: 'eqpfvmwmdtsgddpsodsr',
  role: 'service_role',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60) // 1 year
};

const serviceRoleKey = jwt.sign(payload, JWT_SECRET, {
  algorithm: 'HS256',
  header: {
    typ: 'JWT',
    alg: 'HS256'
  }
});

console.log('Generated service_role key:');
console.log(serviceRoleKey);
console.log('\nAdding to .env.local...');

import * as fs from 'fs';
import * as path from 'path';

// Add to .env.local
const envPath = path.join(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');

if (!envContent.includes('SUPABASE_SERVICE_ROLE_KEY=')) {
  fs.appendFileSync(envPath, `\n# Service role key for database operations\nSUPABASE_SERVICE_ROLE_KEY=${serviceRoleKey}\n`);
  console.log('✅ Added to .env.local');
} else {
  // Update existing
  const updated = envContent.replace(
    /SUPABASE_SERVICE_ROLE_KEY=.*/,
    `SUPABASE_SERVICE_ROLE_KEY=${serviceRoleKey}`
  );
  fs.writeFileSync(envPath, updated);
  console.log('✅ Updated in .env.local');
}

console.log('\nNow you can run: npx tsx scripts/complete-migration.ts');