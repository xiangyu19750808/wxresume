import { renderResumeHTML } from '../../render.template.js';
import puppeteer from 'puppeteer';

/**
 * 将 AI 处理后的数据映射到模板所需的 JSON 结构
 */
function adaptAiResultToTemplate(aiResult, rawInfo = {}) {
  const optimized = aiResult.optimized_result || {};
  
  // 处理教育背景
  const education = (rawInfo.education || []).map(edu => ({
    institution: edu.school || "学校未填",
    area: edu.major || edu.degree || "专业未填",
    studyType: edu.degree || "",
    startDate: edu.startDate || "",
    endDate: edu.endDate || "至今"
  }));

  // 处理工作经历描述
  const workHighlights = (optimized.experience_rewrite || '')
    .split('\n')
    .map(line => line.replace(/^\d+[\.、]\s*/, '').trim())
    .filter(line => line.length > 0);

  return {
    basics: {
      name: rawInfo.name || "姓名未填",
      label: rawInfo.targetJob || "资深职位",
      email: rawInfo.email || "",
      phone: rawInfo.phone || "",
      summary: optimized.summary || "",
      location: { city: rawInfo.city || "", region: "" }
    },
    // 映射到现代模板的技能模块
    skills: (optimized.core_highlights || []).map(h => ({
      name: "核心优势",
      keywords: [h]
    })),
    work: [
      {
        name: "项目/工作经历",
        position: rawInfo.targetJob || "相关职位",
        startDate: "",
        endDate: "至今",
        highlights: workHighlights
      }
    ],
    education: education.length > 0 ? education : [{ institution: "教育经历", area: "待完善" }]
  };
}

/**
 * PDF 导出核心处理器
 */
export async function handleExportPdf(req, res) {
  console.log('\x1b[41m%s\x1b[0m', '>>>>>>>>> [CRITICAL DEBUG] PDF 导出触发（Modern 版） <<<<<<<<<');
  
  let browser = null;
  try {
    const { aiResult, rawInfo, options = {} } = req.body;
    
    // 🎯 强制指定为 modern 模板，确保使用我们刚刚改好的 packages 里的代码
    const templateId = options.templateId || req.body.templateId || 'modern';

    if (!aiResult) {
      return res.status(400).json({ error: "缺少 AI 分析结果" });
    }

    const resumeData = adaptAiResultToTemplate(aiResult, rawInfo);

    // 🎯 获取渲染后的完整 HTML (包含 CSS 和 Webfont)
    // 这里的 html 已经是渲染引擎根据 packages/templates 组装好的完整文档
    const { html } = await renderResumeHTML(resumeData, templateId);

    // 启动无头浏览器
    browser = await puppeteer.launch({
      executablePath: '/usr/bin/google-chrome',
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox',
        '--font-render-hinting=none',
        '--disable-font-subpixel-positioning'
      ]
    });

    const page = await browser.newPage();
    
    // 🎯 核心修正：直接设置 HTML 内容，不再二次包装 finalHtml 字符串
    await page.setContent(html, { waitUntil: 'networkidle0' });
    
    // 等待字体加载完成，防止乱码
    await page.evaluateHandle('document.fonts.ready');
    
    // 生成 A4 纸张 PDF
    const pdfBuffer = await page.pdf({ 
      format: 'A4', 
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 } // 边距由模板 CSS 控制
    });

    await browser.close();

    // 发送 PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.send(pdfBuffer);
    console.log("✅ [Modern] PDF 导出成功");

  } catch (error) {
    console.error("❌ 导出崩溃:", error);
    if (browser) await browser.close();
    res.status(500).json({ error: error.message });
  }
}