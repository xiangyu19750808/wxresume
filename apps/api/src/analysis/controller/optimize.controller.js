import { SemanticExtractor } from '../deep-engine/semantic-extractor.js';
import { DeepDiagnoseService } from '../services/deep-diagnose.service.js';
import { ResumeOptimizerEngine } from '../services/resume-optimizer.service.js';

export const handleOptimize = async (req, res) => {
  const { resumeText, jdText } = req.body;

  if (!resumeText || !jdText) {
    return res.status(400).json({ code: 1, error: "简历文本或JD文本不能为空" });
  }

  try {
    console.log("🚀 [API] 开始全链路优化任务...");
    
    // 初始化三个核心引擎
    const extractor = new SemanticExtractor();
    const auditor = new DeepDiagnoseService();
    const optimizer = new ResumeOptimizerEngine();

    // 1. 抽取画像 (Portrait)
    console.log("1️⃣ 正在抽取画像...");
    const portrait = await extractor.extract(resumeText, jdText);
    
    // 2. 生成九维审计 (Audit)
    console.log("2️⃣ 正在生成九维深度审计报告...");
    const report = await auditor.run(resumeText, jdText, portrait);
    
    // 3. 执行重构优化 (Optimize)
    console.log("3️⃣ 正在执行整容级重写...");
    const optimizedData = await optimizer.optimize(resumeText, jdText, report);

    console.log("✅ 优化任务全部完成");

    res.json({
      code: 0,
      data: {
        audit_report: report,
        optimized_result: optimizedData
      }
    });
  } catch (error) {
    console.error("❌ 优化接口报错:", error);
    res.status(500).json({ code: 500, error: "服务器内部错误，优化失败" });
  }
};
