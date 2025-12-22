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

const multerPromise = import('multer')
  .then((m) => m.default || m)
  .then((multer) => multer({ dest: UPLOAD_DIR }))
  .catch((err) => {
    console.warn('[resume.parse] multer unavailable, fallback to JSON only', err?.message || err);
    return null;
  });

let uploadResumeMiddleware = (req, res, next) => next();
multerPromise.then((instance) => {
  if (instance) uploadResumeMiddleware = instance.single('resumeFile');
});

const parseResumeService = new ParseResumeService();
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
]);

export class ParseController {
    async handleParse(req, res) {
    const contentType = req.headers['content-type'] || '';

    // ========== 新增：Base64 JSON格式支持 ==========
    if (contentType.includes('application/json')) {
      try {
        const body = req.body;

        // 支持两种JSON格式：1. resumeText 2. file_content (Base64)
        if (body.resumeText || body.text) {
          // 直接处理文本简历
          const resumeText = fromPlainText(body.resumeText || body.text);
          
          if (!resumeText || resumeText.length < 50) {
            return res.status(400).json({
              code: 1,
              msg: 'resume_too_short',
              data: { reason: '简历内容过短或无法解析' }
            });
          }

          const result = parseResumeService.parse(resumeText);
          return res.json({ code: 0, data: result });

        } else if (body.file_content) {
          // Base64解码
          let fileBuffer;
          try {
            // 处理 data:application/pdf;base64,JVBERi0xLjQK... 格式
            let base64Content = body.file_content;
            if (base64Content.includes('base64,')) {
              base64Content = base64Content.split('base64,')[1];
            }
            fileBuffer = Buffer.from(base64Content, 'base64');
          } catch (decodeError) {
            return res.status(400).json({
              code: 1,
              msg: 'invalid_base64',
              data: { reason: `Base64格式错误` }
            });
          }

          // 文件大小限制 (10MB)
          if (fileBuffer.length > 10 * 1024 * 1024) {
            return res.status(400).json({
              code: 1,
              msg: 'file_too_large',
              data: { reason: '文件大小超过10MB限制' }
            });
          }

          // 确定MIME类型
          let mimeType = body.file_type || 'application/octet-stream';
          if (!ALLOWED_MIME_TYPES.has(mimeType) && body.file_name) {
            const ext = path.extname(body.file_name).toLowerCase();
            if (ext === '.pdf') mimeType = 'application/pdf';
            else if (ext === '.docx') mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
            else if (ext === '.doc') mimeType = 'application/msword';
          }

          if (!ALLOWED_MIME_TYPES.has(mimeType)) {
            return res.status(400).json({
              code: 1,
              msg: 'unsupported_file_type',
              data: { reason: `不支持的文件类型: ${mimeType}` }
            });
          }

          // 临时保存并解析
          const fileId = Date.now() + Math.random().toString(36).substr(2, 9);
          const tempFilePath = path.join(UPLOAD_DIR, `${fileId}.tmp`);
          fs.writeFileSync(tempFilePath, fileBuffer);

          try {
            const resumeText = await parseResumeFromFile(tempFilePath, mimeType);

            if (!resumeText || resumeText.length < 50) {
              fs.unlinkSync(tempFilePath);
              return res.status(400).json({
                code: 1,
                msg: 'resume_too_short',
                data: { reason: '简历内容过短或无法解析' }
              });
            }

            const result = parseResumeService.parse(resumeText);
            fs.unlinkSync(tempFilePath);
            return res.json({ code: 0, data: result });

          } catch (parseError) {
            if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
            console.error('[resume.parse] Base64解析失败', parseError);
            return res.status(500).json({
              code: 1,
              msg: 'parse_failed',
              data: { reason: '文件解析失败' }
            });
          }
        } else {
          // 两种格式都没有提供
          return res.status(400).json({
            code: 1,
            msg: 'missing_content',
            data: { reason: '请提供 resumeText 或 file_content 字段' }
          });
        }

      } catch (error) {
        console.error('[resume.parse] Base64处理异常', error);
        return res.status(500).json({
          code: 1,
          msg: 'server_error',
          data: { reason: '服务器处理异常' }
        });
      }
    }
    // ========== Base64支持结束 ==========

    // 原有的multipart/form-data支持逻辑（保持不变）
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
        } else if (req.body?.resumeText || req.body?.text) {
          resumeText = fromPlainText(req.body.resumeText || req.body.text);
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
