import { parseResumeFromFile } from './apps/api/src/check/parsers/resume.parser.js';

async function testParser() {
  console.log('Testing resume parser...');
  
  // 测试文本文件
  const testText = "张三\n电话: 13800138000\n邮箱: test@example.com\n工作经历: 测试公司";
  
  // 测试PDF（如果有样本文件）
  // const pdfResult = await parseResumeFromFile('./resume.pdf', 'application/pdf');
  
  console.log('Parser loaded successfully');
}

testParser().catch(console.error);
