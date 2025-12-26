import { renderResumeHTML } from '../../render.template.js';
import puppeteer from 'puppeteer';

export async function handleGeneratePdf(req, res) {
  try {
    const { optimizedData, templateId = 'classic' } = req.body;

    // 1. 数据适配：将 AI 的 JSON 转换为模板需要的结构
    // 注意：这里需要根据你 packages/templates/src/classic/index.js 要求的格式来调整
    const resumeData = {
      name: optimizedData.name || "姓名",
      summary: optimizedData.optimized_result.summary,
      coreSkills: optimizedData.optimized_result.core_highlights,
      workExperience: [
        {
          description: optimizedData.optimized_result.experience_rewrite
        }
      ],
      // 这里可以根据实际模板需求继续补充字段
    };

    // 2. 调用你现有的模板引擎渲染 HTML
    const { html } = await renderResumeHTML(resumeData, templateId);

    // 3. 使用 Puppeteer 转换为 PDF
    const browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      headless: 'new'
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' }
    });

    await browser.close();

    // 4. 直接返回 PDF 文件流
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=resume_${templateId}.pdf`);
    res.send(pdfBuffer);

  } catch (error) {
    console.error("PDF生成失败:", error);
    res.status(500).json({ code: 500, error: error.message });
  }
}