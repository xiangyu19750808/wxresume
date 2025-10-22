#!/usr/bin/env node
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const projectDir = join(dirname(__filename), '..');

const env = { ...process.env };
if (!env.DB_URL) {
  env.DB_URL = 'file:./prisma/dev.db';
}

function runPrismaCommand(args) {
  const binary = process.platform === 'win32'
    ? join(projectDir, 'node_modules', '.bin', 'prisma.cmd')
    : join(projectDir, 'node_modules', '.bin', 'prisma');

  const result = spawnSync(binary, args, {
    cwd: projectDir,
    env,
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

runPrismaCommand(['generate', '--schema', 'prisma/schema.prisma']);
runPrismaCommand(['db', 'push', '--schema', 'prisma/schema.prisma', '--skip-generate']);
