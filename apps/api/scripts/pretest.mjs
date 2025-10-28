#!/usr/bin/env node
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { accessSync, chmodSync, constants, lstatSync, mkdirSync, readdirSync, rmSync, symlinkSync } from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const projectDir = join(dirname(__filename), '..');
const modulesDir = join(projectDir, 'node_modules');
const pnpmStoreDir = join(modulesDir, '.pnpm');

const env = { ...process.env };
if (!env.DB_URL) {
  env.DB_URL = 'file:./prisma/dev.db';
}
if (!env.PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING) {
  env.PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING = '1';
}

function runPrismaCommand(args) {
  const binary = process.platform === 'win32'
    ? join(projectDir, 'node_modules', '.bin', 'prisma.cmd')
    : join(projectDir, 'node_modules', '.bin', 'prisma');

  if (process.platform !== 'win32') {
    try {
      accessSync(binary, constants.X_OK);
    } catch {
      try {
        chmodSync(binary, 0o755);
      } catch (error) {
        console.warn(`Warning: unable to set execute permissions on ${binary}:`, error);
      }
    }
  }

  const result = spawnSync(binary, args, {
    cwd: projectDir,
    env,
    stdio: 'pipe',
  });

  if (result.stdout?.length) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr?.length) {
    process.stderr.write(result.stderr);
  }

  if (result.status !== 0) {
    const stderr = result.stderr?.toString('utf8') ?? '';
    const offlineErrorPattern = /(ENOTFOUND|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|403 Forbidden)/i;
    if (offlineErrorPattern.test(stderr)) {
      console.warn(`Skipping Prisma command ${args.join(' ')} because the environment appears to be offline.`);
      return;
    }

    process.exit(result.status ?? 1);
  }
}

function ensurePnpmLinkedNodeModules(packageName) {
  try {
    const entries = readdirSync(pnpmStoreDir, { withFileTypes: true });
    const pattern = packageName.startsWith('@')
      ? `${packageName.replace('/', '+')}@`
      : `${packageName}@`;
    const match = entries.find((entry) => entry.isDirectory() && entry.name.startsWith(pattern));
    if (!match) {
      return;
    }

    const target = join(pnpmStoreDir, match.name, 'node_modules');
    const packageDir = join(modulesDir, ...packageName.split('/'));
    const linkLocation = join(packageDir, 'node_modules');

    try {
      const stat = lstatSync(linkLocation);
      if (stat.isSymbolicLink()) {
        return;
      }
      rmSync(linkLocation, { recursive: true, force: true });
    } catch {
      // ignore missing directories
    }

    mkdirSync(packageDir, { recursive: true });
    try {
      symlinkSync(target, linkLocation, 'dir');
    } catch (error) {
      console.warn(`Warning: unable to ensure node_modules link for ${packageName}:`, error);
    }
  } catch (error) {
    console.warn(`Warning: unable to reconcile pnpm links for ${packageName}:`, error);
  }
}

ensurePnpmLinkedNodeModules('prisma');
ensurePnpmLinkedNodeModules('@prisma/client');
ensurePnpmLinkedNodeModules('express');
ensurePnpmLinkedNodeModules('jsonwebtoken');
runPrismaCommand(['generate', '--schema', 'prisma/schema.prisma']);
runPrismaCommand(['db', 'push', '--schema', 'prisma/schema.prisma', '--skip-generate']);
