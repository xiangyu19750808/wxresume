import { parseResumeFromFile } from './apps/api/src/check/parsers/resume.parser.js';
import { ParseResumeService } from './apps/api/src/resume/services/parse.service.js';

async function testRealPDF() {
  console.log('=== 测试真实简历PDF文件 ===\n');
  
  const parseService = new ParseResumeService();
  const filePath = 'test-ai-resume.pdf';
  
  try {
    // 解析PDF
    console.log('1. 解析PDF文件...');
    const pdfText = await parseResumeFromFile(filePath, 'application/pdf');
    
    if (!pdfText || pdfText.length < 50) {
      console.log('   ✗ PDF解析失败：文本太短或为空');
      return;
    }
    
    console.log(`   ✓ PDF解析成功，文本长度: ${pdfText.length} 字符`);
    console.log(`   文本预览 (前200字符):\n   "${pdfText.substring(0, 200)}..."\n`);
    
    // 结构化解析
    console.log('2. 结构化解析...');
    const result = parseService.parse(pdfText);
    
    // 显示提取结果
    const basic = result.resumeParsed?.basic_info || {};
    console.log('   ✓ 结构化解析完成');
    console.log(`   姓名: ${basic.name || '未提取'}`);
    console.log(`   电话: ${basic.phone || '未提取'}`);
    console.log(`   邮箱: ${basic.email || '未提取'}`);
    console.log(`   地址: ${basic.location || '未提取'}`);
    console.log(`   教育经历: ${result.resumeParsed?.education?.length || 0} 条`);
    console.log(`   工作经历: ${result.resumeParsed?.experience?.length || 0} 条`);
    console.log(`   技能: ${result.resumeParsed?.skills?.length || 0} 项`);
    
    if (result.resumeParsed?.skills?.length > 0) {
      console.log(`   技能列表: ${result.resumeParsed.skills.slice(0, 10).join(', ')}${result.resumeParsed.skills.length > 10 ? '...' : ''}`);
    }
    
    if (result.warnings?.length > 0) {
      console.log(`\n3. 警告信息:`);
      result.warnings.forEach(w => console.log(`   ⚠ ${w.message}`));
    }
    
    // 保存解析结果供查看
    const fs = await import('fs');
    fs.writeFileSync('parsed-result.json', JSON.stringify(result, null, 2), 'utf8');
    console.log(`\n4. 完整结果已保存到: parsed-result.json`);
    
  } catch (error) {
    console.log('   ✗ 测试失败:', error.message);
    console.log(error.stack);
  }
}

testRealPDF().catch(console.error);
