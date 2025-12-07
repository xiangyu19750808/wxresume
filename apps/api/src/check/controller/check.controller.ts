import { parseResumeFromFile, fromPlainText } from '../parsers/resume.parser.js';
import { parseJD } from '../parsers/jd.parser.js';
import { ScreeningService } from '../services/screening.service.js';

const screeningService = new ScreeningService();

export class CheckController {
  async handleCheck(req, res) {
    try {
      let resumeText = '';
      const jdText = req.body?.jdText || req.body?.jobDesc || '';

      if (req.file) {
        resumeText = await parseResumeFromFile(req.file.path, req.file.mimetype);
      } else if (req.body?.resumeText) {
        resumeText = fromPlainText(req.body.resumeText);
      }

      if (!resumeText || resumeText.length < 10) {
        return res.status(400).json({
          code: 1,
          msg: '简历内容过短或解析失败',
          data: {
            status: 'error',
            screening_passed: false,
            reason: 'resume_too_short',
            required_action: '请检查文件是否为空或重新上传清晰版本',
          },
        });
      }

      if (!jdText || jdText.length < 10) {
        return res.status(400).json({
          code: 1,
          msg: 'JD 内容过短或缺失',
          data: {
            status: 'error',
            screening_passed: false,
            reason: 'jd_too_short',
            required_action: '请提供完整岗位描述',
          },
        });
      }

      const parsedJD = parseJD(jdText);
      const result = await screeningService.runScreening({ resumeText, jdText, parsedJD });

      return res.json({ code: 0, msg: 'ok', data: result });
    } catch (err) {
      return res.status(500).json({ code: 1, msg: 'internal_error', data: { error: err.message } });
    }
  }
}
