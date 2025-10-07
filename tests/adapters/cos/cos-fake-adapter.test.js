import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { CosFakeAdapter } from '@wxresume/adapters-cos';

async function createAdapter(t) {
  const baseDir = await mkdtemp(path.join(tmpdir(), 'cos-fake-'));
  t.after(async () => {
    await rm(baseDir, { recursive: true, force: true });
  });
  return new CosFakeAdapter({ baseDir });
}

test('putObject writes file to the configured directory', async (t) => {
  const adapter = await createAdapter(t);
  const key = 'renders/简历 空格.md';
  const payload = '# wxresume';

  await adapter.putObject(key, payload);

  const stored = await readFile(path.join(adapter.baseDir, 'renders/简历 空格.md'), 'utf8');
  assert.equal(stored, payload);
});

test('getSignedUrl encodes the key and defaults to 180 seconds', async (t) => {
  const adapter = await createAdapter(t);
  const key = 'renders/简历 空格.md';
  await adapter.putObject(key, 'payload');

  const { url, expiresIn, expiresAt } = await adapter.getSignedUrl(key);

  assert.equal(url, 'http://localhost:8080/mock/renders/%E7%AE%80%E5%8E%86%20%E7%A9%BA%E6%A0%BC.md');
  assert.equal(expiresIn, 180);

  const diffSeconds = Math.round((expiresAt.getTime() - Date.now()) / 1000);
  assert.ok(Math.abs(diffSeconds - 180) <= 1, 'expiresAt should be ~180 seconds later');
});

test('headObject returns metadata and deleteObject removes the file', async (t) => {
  const adapter = await createAdapter(t);
  const key = 'renders/简历 空格.md';
  await adapter.putObject(key, 'payload');

  const meta = await adapter.headObject(key);
  assert(meta);
  assert.equal(meta.key, key);
  assert(meta.size > 0);
  assert(meta.lastModified instanceof Date);

  await adapter.deleteObject(key);
  const afterDelete = await adapter.headObject(key);
  assert.equal(afterDelete, null);
});
