#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const specPath = process.argv[2] || 'apps/api/openapi.json';
const absolutePath = path.resolve(specPath);

let raw;
try {
  raw = fs.readFileSync(absolutePath, 'utf8');
} catch (err) {
  console.error(`[openapi] failed to read spec at ${absolutePath}:`, err.message);
  process.exit(1);
}

let spec;
try {
  spec = JSON.parse(raw);
} catch (err) {
  console.error(`[openapi] invalid JSON: ${err.message}`);
  process.exit(1);
}

const errors = [];

if (typeof spec.openapi !== 'string') {
  errors.push('missing or invalid "openapi" version field');
}

if (!spec.info || typeof spec.info !== 'object') {
  errors.push('missing top-level "info" section');
} else {
  if (!spec.info.title) errors.push('missing "info.title"');
  if (!spec.info.version) errors.push('missing "info.version"');
}

if (!spec.paths || typeof spec.paths !== 'object' || !Object.keys(spec.paths).length) {
  errors.push('no HTTP paths defined in spec');
} else {
  const requiredPaths = ['/v1/health', '/v1/users/me', '/v1/render/pdf'];
  const missingPaths = requiredPaths.filter((p) => !(p in spec.paths));
  if (missingPaths.length) {
    errors.push(`missing required endpoint definitions: ${missingPaths.join(', ')}`);
  }
}

if (errors.length) {
  console.error('[openapi] validation failed:');
  for (const err of errors) {
    console.error(`  - ${err}`);
  }
  process.exit(1);
}

console.log(`[openapi] ${path.relative(process.cwd(), absolutePath)} looks good (${Object.keys(spec.paths).length} paths).`);
