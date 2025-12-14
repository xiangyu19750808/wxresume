import { fromPlainText } from '../../check/parsers/resume.parser.js';
import { ResumeStructParser } from '../parsers/resume-struct.parser.js';

const structParser = new ResumeStructParser();

export class ParseResumeService {
  parse(resumeText) {
    const normalized = fromPlainText(resumeText || '');
    const { resumeParsed, warnings } = structParser.parse(normalized);

    return {
      resumeText: normalized,
      resumeParsed,
      warnings,
    };
  }
}
