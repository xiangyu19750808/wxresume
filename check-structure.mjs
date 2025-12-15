// 快速查看PDF提取的文本结构
import { parseResumeFromFile } from './apps/api/src/check/parsers/resume.parser.js';

async function checkTextStructure() {
  const text = await parseResumeFromFile('test-ai-resume.pdf', 'application/pdf');
  const lines = text.split('\n').slice(0, 20);
  console.log('PDF文本前20行:');
  lines.forEach((line, i) => console.log(`${i}: "${line}"`));
}

checkTextStructure();
