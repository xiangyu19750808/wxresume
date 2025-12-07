import fs from 'fs';

export async function parseResumeFromFile(filePath: string, mimeType: string): Promise<string> {
  const buffer = fs.readFileSync(filePath);

  if (mimeType === 'application/pdf') {
    try {
      const pdfModule = await import('pdf-parse');
      const pdf = pdfModule.default || pdfModule;
      const result = await pdf(buffer);
      return normalizeResumeText(result.text || '');
    } catch (err) {
      console.warn('[resume.parser] pdf parsing failed, fallback to raw buffer', err);
    }
  }

  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    try {
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ buffer });
      return normalizeResumeText(result.value || '');
    } catch (err) {
      console.warn('[resume.parser] docx parsing failed, fallback to raw buffer', err);
    }
  }

  return normalizeResumeText(buffer.toString('utf8'));
}

export function normalizeResumeText(raw: string): string {
  return (raw || '')
    .replace(/\r\n/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/[ ]{2,}/g, ' ')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .trim();
}

export function fromPlainText(raw: string): string {
  return normalizeResumeText(raw || '');
}

export class ResumeParser {
  parse(resumeText: string): any {
    return { sections: [], raw: normalizeResumeText(resumeText) };
  }
}
