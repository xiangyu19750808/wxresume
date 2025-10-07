import { mkdir, rm, stat, writeFile } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { StorageAdapter } from './storage-adapter.js';

const DEFAULT_PUBLIC_BASE_URL = 'http://localhost:8080/mock/';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_BASE_DIR = path.resolve(__dirname, '../../../../apps/api/paid');

function ensureTrailingSlash(url) {
  return url.endsWith('/') ? url : `${url}/`;
}

function encodeKey(key) {
  return key
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

function assertKey(key) {
  if (typeof key !== 'string' || key.trim() === '') {
    throw new TypeError('Key must be a non-empty string.');
  }
}

function toBuffer(body) {
  if (Buffer.isBuffer(body)) {
    return body;
  }

  if (body instanceof Uint8Array) {
    return Buffer.from(body);
  }

  if (typeof body === 'string') {
    return Buffer.from(body);
  }

  return null;
}

export class CosFakeAdapter extends StorageAdapter {
  constructor(options = {}) {
    super();
    const { baseDir = DEFAULT_BASE_DIR, publicBaseUrl = DEFAULT_PUBLIC_BASE_URL } = options;
    this.baseDir = path.resolve(baseDir);
    this.publicBaseUrl = ensureTrailingSlash(publicBaseUrl);
  }

  #resolveKey(key) {
    assertKey(key);
    const filePath = path.resolve(this.baseDir, key);
    const relative = path.relative(this.baseDir, filePath);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error(`Invalid key: ${key}`);
    }
    return filePath;
  }

  async putObject(key, body) {
    const filePath = this.#resolveKey(key);
    await mkdir(path.dirname(filePath), { recursive: true });

    const maybeBuffer = toBuffer(body);
    if (maybeBuffer) {
      await writeFile(filePath, maybeBuffer);
      return;
    }

    if (body instanceof Readable) {
      const writeStream = createWriteStream(filePath);
      await pipeline(body, writeStream);
      return;
    }

    throw new TypeError('Unsupported body type for putObject.');
  }

  async getSignedUrl(key, options = {}) {
    const filePath = this.#resolveKey(key);
    await stat(filePath);
    const { expiresIn = 180 } = options;
    if (!Number.isFinite(expiresIn) || expiresIn <= 0) {
      throw new TypeError('expiresIn must be a positive number of seconds.');
    }

    const url = `${this.publicBaseUrl}${encodeKey(key)}`;
    const expiresAt = new Date(Date.now() + expiresIn * 1000);
    return { url, expiresIn, expiresAt };
  }

  async headObject(key) {
    const filePath = this.#resolveKey(key);
    try {
      const fileStats = await stat(filePath);
      return {
        key,
        size: fileStats.size,
        lastModified: fileStats.mtime,
      };
    } catch (error) {
      if (error && error.code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  async deleteObject(key) {
    const filePath = this.#resolveKey(key);
    await rm(filePath, { force: true });
  }
}
