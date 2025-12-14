import { fromPlainText } from '../../check/parsers/resume.parser.js';
import { ResumeStructParser } from '../parsers/resume-struct.parser.js';

type ParseResult = {
  resumeText: string;
  resumeParsed: ReturnType<ResumeStructParser['parse']>['resumeParsed'];
  warnings: ReturnType<ResumeStructParser['parse']>['warnings'];
};

export class ParseResumeService {
  private structParser = new ResumeStructParser();

  parse(resumeText: string): ParseResult {
    const normalized = fromPlainText(resumeText || '');
    const { resumeParsed, warnings } = this.structParser.parse(normalized);

    return {
      resumeText: normalized,
      resumeParsed,
      warnings,
    };
  }
}
