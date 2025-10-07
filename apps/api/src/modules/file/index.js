import { prisma } from '../../db.js';
import { CosFakeAdapter } from '@wxresume/adapters-cos';

const DOWNLOAD_EXPIRES_IN_SECONDS = 180;
const storageAdapter = new CosFakeAdapter();
export const fileStorageAdapter = storageAdapter;

class FileNotFoundError extends Error {
  constructor(message = 'file not found') {
    super(message);
    this.name = 'FileNotFoundError';
  }
}

export async function resolveFileRecord(fileId) {
  if (typeof fileId !== 'string' || fileId.trim() === '') {
    throw new TypeError('fileId must be a non-empty string');
  }

  const trimmedId = fileId.trim();

  let record = await prisma.fileObject.findFirst({
    where: { cos_key: trimmedId }
  });

  if (!record) {
    record = await prisma.fileObject.findUnique({ where: { id: trimmedId } });
  }

  if (!record) {
    throw new FileNotFoundError(`FileObject not found for ${trimmedId}`);
  }

  return record;
}

export async function getDownloadUrl(fileId) {
  const record = await resolveFileRecord(fileId);
  const key = record.cos_key || record.id;
  try {
    const { url } = await storageAdapter.getSignedUrl(key, {
      expiresIn: DOWNLOAD_EXPIRES_IN_SECONDS
    });

    return { url, key, expiresInSec: DOWNLOAD_EXPIRES_IN_SECONDS, record };
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      throw new FileNotFoundError(`FileObject not found on disk for ${key}`);
    }
    throw error;
  }
}

function extractClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim() !== '') {
    return forwarded.split(',')[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0];
  }
  return req.ip || req.connection?.remoteAddress || '';
}

export function logFileDownload({ fileId, key, req }) {
  const uaHeader = req.headers['user-agent'];
  const logEntry = {
    file_id: fileId,
    key,
    ip: extractClientIp(req),
    ua: Array.isArray(uaHeader) ? uaHeader.join(' ') : uaHeader || '',
    ts: new Date().toISOString()
  };
  console.info('[file.download]', JSON.stringify(logEntry));
}

export { FileNotFoundError };
export const FILE_DOWNLOAD_EXPIRES_IN_SECONDS = DOWNLOAD_EXPIRES_IN_SECONDS;
