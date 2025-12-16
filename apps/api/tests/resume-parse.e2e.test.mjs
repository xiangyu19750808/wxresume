import assert from 'node:assert';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { test } from 'node:test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const apiRoot = path.resolve(__dirname, '..');
const PORT = 18080;

async function startServer() {
  const server = spawn('node', ['src/server.js'], {
    cwd: apiRoot,
    env: {
      ...process.env,
      PORT: String(PORT),
      HOST: '127.0.0.1',
      E2E_LIGHT: '1',
      JWT_SECRET: process.env.JWT_SECRET || 'test-secret',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  server.stdout.setEncoding('utf8');
  server.stderr.setEncoding('utf8');

  const ready = waitForReady(server);
  await ready;
  await delay(200);
  return server;
}

function waitForReady(proc) {
  return new Promise((resolve, reject) => {
    let resolved = false;
    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        reject(new Error('server start timeout'));
      }
    }, 10000);

    const onData = (data) => {
      if (resolved) return;
      if (String(data).includes('API listening')) {
        resolved = true;
        clearTimeout(timer);
        resolve();
      }
    };

    proc.stdout.on('data', onData);
    proc.stderr.on('data', onData);
    proc.on('exit', (code) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        reject(new Error(`server exited with code ${code}`));
      }
    });
  });
}

async function callResumeParse() {
  // 两种格式都支持：直接resumeText或Base64
  const response = await fetch(`http://127.0.0.1:${PORT}/v1/resume/parse`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      resumeText: '张三\n教育背景: 2015-2019 北京大学 本科 计算机科学\n工作经历: 2020-2023 腾讯 前端开发\n技能: Node.js, MongoDB, React',
    }),
  });
  const payload = await response.json();
  return payload;
}

test('POST /v1/resume/parse returns structured resume', async () => {
  const server = await startServer();
  try {
    const payload = await callResumeParse();

    assert.strictEqual(payload.code, 0);
    assert.ok(payload.data?.resumeText.length > 0, 'resumeText should not be empty');
    assert.ok(Array.isArray(payload.data?.resumeParsed?.skills), 'skills should be an array');
  } finally {
    server.kill();
  }
});
