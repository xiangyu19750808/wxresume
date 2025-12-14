import fs from 'node:fs';
import path from 'node:path';
import { parseResumeFromFile, fromPlainText } from '../../check/parsers/resume.parser.js';
import { ParseResumeService } from '../services/parse.service.js';

const APP_CWD = process.cwd();
const REPO_ROOT = (() => {
  const candidate = path.resolve(APP_CWD, '../../');
  if (fs.existsSync(path.join(candidate, 'data'))) return candidate;
  return APP_CWD;
})();
const UPLOAD_DIR = path.join(REPO_ROOT, 'tmp', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const multerPromise: Promise<null | ((...args: any[]) => any)> = import('multer')
  .then((m) => m.default || m)
  .then((multer) => multer({ dest: UPLOAD_DIR }))
  .catch((err) => {
    console.warn('[resume.parse] multer unavailable, fallback to JSON only', err?.message || err);
    return null;
  });

let uploadResumeMiddleware: any = (req, res, next) => next();
multerPromise.then((instance: any) => {
  if (instance) uploadResumeMiddleware = instance.single('resumeFile');
});

const parseResumeService = new ParseResumeService();
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
]);

export class ParseController {
  async handleParse(req, res): Promise<void> {
    await multerPromise;
    uploadResumeMiddleware(req, res, async (err) => {
      if (err) {
        return res.status(400).json({ code: 1, msg: 'upload_failed', data: { reason: 'upload_failed', error: err.message } });
      }

      try {
        let resumeText = '';

        if (req.file) {
          if (!ALLOWED_MIME_TYPES.has(req.file.mimetype)) {
            return res
              .status(400)
              .json({ code: 1, msg: 'unsupported_file_type', data: { reason: 'unsupported_file_type' } });
          }
          resumeText = await parseResumeFromFile(req.file.path, req.file.mimetype);
        } else if (req.body?.resumeText) {
          resumeText = fromPlainText(req.body.resumeText);
        }

        if (!resumeText) {
          return res.status(400).json({ code: 1, msg: 'resume_missing', data: { reason: 'resume_missing' } });
        }

        if (resumeText.length < 50) {
          return res.status(400).json({ code: 1, msg: 'resume_too_short', data: { reason: 'resume_too_short' } });
        }

        const result = parseResumeService.parse(resumeText);
        return res.json({ code: 0, data: result });
      } catch (error) {
        console.error('[resume.parse] failed', error);
        return res.status(500).json({ code: 1, msg: 'parse_failed', data: { reason: 'parse_failed', error: error?.message } });
      }
    });
  }
}
