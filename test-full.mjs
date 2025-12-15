import { parseResumeFromFile } from './apps/api/src/check/parsers/resume.parser.js';
import { ParseResumeService } from './apps/api/src/resume/services/parse.service.js';

async function testFullPipeline() {
  console.log('=== 测试简历解析完整流程 ===\n');
  
  const parseService = new ParseResumeService();
  
  // 测试1: 文本文件解析
  console.log('1. 测试文本文件解析:');
  try {
    const textBuffer = await import('fs').then(fs => fs.readFileSync('test-resume.txt', 'utf8'));
    const textResult = parseService.parse(textBuffer);
    console.log('   ✓ 文本解析成功');
    console.log('   提取到电话:', textResult.resumeParsed?.basic_info?.phone || '无');
    console.log('   提取到邮箱:', textResult.resumeParsed?.basic_info?.email || '无');
    console.log('   技能数量:', textResult.resumeParsed?.skills?.length || 0);
  } catch (err) {
    console.log('   ✗ 文本解析失败:', err.message);
  }
  
  // 测试2: PDF文件解析
  console.log('\n2. 测试PDF文件解析:');
  try {
    const pdfText = await parseResumeFromFile('resume.pdf', 'application/pdf');
    if (pdfText && pdfText.length > 10) {
      const pdfResult = parseService.parse(pdfText);
      console.log('   ✓ PDF解析成功');
      console.log('   提取文本长度:', pdfText.length);
      console.log('   提取到电话:', pdfResult.resumeParsed?.basic_info?.phone || '无');
      console.log('   技能数量:', pdfResult.resumeParsed?.skills?.length || 0);
    } else {
      console.log('   ✗ PDF解析返回空文本');
    }
  } catch (err) {
    console.log('   ✗ PDF解析失败:', err.message);
  }
  
  console.log('\n=== 测试完成 ===');
}

testFullPipeline().catch(console.error);
