function normalizeBullets(text) {
  return text.replace(/[•·●]/g, "-");
}

function calculateNonAsciiRatio(text) {
  const meaningfulText = text.replace(/\s+/g, "");
  if (!meaningfulText.length) {
    return 0;
  }
  
  // 检测问号比例（可能表示编码问题）
  const questionMarkCount = (meaningfulText.match(/\?/g) || []).length;
  const questionMarkRatio = questionMarkCount / meaningfulText.length;
  
  // 如果问号比例超过25%，认为有严重的编码问题
  if (questionMarkRatio > 0.25) {
    return 0.7;
  }
  
  // 正常检测非ASCII字符
  const nonAsciiCount = (meaningfulText.match(/[^\x00-\x7F]/g) || []).length;
  return nonAsciiCount / meaningfulText.length;
}

function containsTable(text) {
  const htmlTablePattern = /<table[\s\S]*?>[\s\S]*?<\/table>/i;
  const markdownTablePattern = /\|\s*[-:]{2,}[-|\s:]*\|/;
  const boxDrawingPattern = /[┌┬┐└┴┘┼─│]/;
  return (
    htmlTablePattern.test(text) ||
    markdownTablePattern.test(text) ||
    boxDrawingPattern.test(text)
  );
}

function containsExecutableMarkup(text) {
  const scriptPattern = /<script[\s\S]*?>[\s\S]*?<\/script>/i;
  const stylePattern = /<style[\s\S]*?>[\s\S]*?<\/style>/i;
  const iframePattern = /<iframe[\s\S]*?>[\s\S]*?<\/iframe>/i;
  return scriptPattern.test(text) || stylePattern.test(text) || iframePattern.test(text);
}

function mapScoreToGrade(score) {
  if (score >= 95) return "S";
  if (score >= 85) return "A";
  if (score >= 70) return "B";
  if (score >= 50) return "C";
  return "D";
}

function getGradeColor(grade) {
  const colors = {
    "S": "#52c41a",
    "A": "#1890ff", 
    "B": "#faad14",
    "C": "#fa8c16",
    "D": "#ff4d4f"
  };
  return colors[grade] || "#8c8c8c";
}

function getGradeIcon(grade) {
  const icons = {
    "S": "🌟",
    "A": "✅",
    "B": "📋",
    "C": "⚠️",
    "D": "🚨"
  };
  return icons[grade] || "📄";
}

function getGradeStatement(grade, dimension) {
  const dimensionNames = {
    "ats_compatibility": "ATS兼容性"
  };
  const name = dimensionNames[dimension] || dimension;
  
  const statements = {
    "D": `简历因格式或编码问题可能无法被任何ATS系统正确解析，HR无法看到您的内容。`,
    "C": `存在潜在的解析兼容性问题，在某些ATS系统中可能导致关键信息丢失。`,
    "B": `简历可被正常读取，但尚未利用格式优化来提升专业的视觉第一印象。`,
    "A": `${name}表现优秀，保持当前的描述深度和案例。`,
    "S": `${name}表现优秀，保持当前的描述深度和案例。`
  };
  return statements[grade] || "";
}

function calculateOptimizedScore(currentScore, issues) {
  // 基础优化：假设修复所有问题
  let optimizedScore = currentScore;
  
  issues.forEach(issue => {
    if (issue.penalty) {
      optimizedScore += issue.penalty; // 修复问题，加回被扣的分数
    }
  });
  
  // 额外优化加分：格式美化等
  optimizedScore = Math.min(100, optimizedScore + 5);
  
  return Math.round(optimizedScore);
}

function buildDirectiveAbstract(issues) {
  if (!issues.length) {
    return "简历格式优秀，无需额外优化。";
  }
  
  const directives = issues.map(issue => {
    switch(issue.description) {
      case "检测到表格或分栏结构，可能导致 ATS 解析失败":
        return "移除表格结构";
      case "存在 script/style/iframe 等特殊标签":
        return "清理HTML标签";
      case "检测到乱码或控制字符":
        return "修复编码格式";
      case "含有制表符或全角空格，可能影响 ATS 读取":
        return "标准化空格使用";
      case "检测到编码问题或非 ASCII 字符占比过高":
        return "优化字符编码";
      default:
        return "优化格式问题";
    }
  });
  
  return `修复了${directives.length}项格式问题：${directives.join("、")}。`;
}

function deriveConfidence(score, issueCount) {
  const baseConfidence = score / 100;
  const deduction = Math.min(0.6, issueCount * 0.08 + (100 - score) / 250);
  const confidence = Math.max(0.3, Math.min(1, baseConfidence - deduction + 0.2));
  return Number(confidence.toFixed(2));
}

function scoreCompatibility(resumeText) {
  const normalized = resumeText ?? "";
  const issues = [];

  if (containsTable(normalized)) {
    issues.push({
      penalty: 35,
      description: "检测到表格或分栏结构，可能导致 ATS 解析失败",
      suggestion: "移除表格/分栏，改用标题和项目符号重新排版",
    });
  }

  if (containsExecutableMarkup(normalized)) {
    issues.push({
      penalty: 30,
      description: "存在 script/style/iframe 等特殊标签",
      suggestion: "删除嵌入的脚本或样式标签，仅保留纯文本内容",
    });
  }

  if (/[�]|[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(normalized)) {
    issues.push({
      penalty: 30,
      description: "检测到乱码或控制字符",
      suggestion: "检查文件编码并移除控制字符，导出为 UTF-8 文本或 PDF",
    });
  }

  if (/\t|\u00A0|\u3000/.test(normalized)) {
    issues.push({
      penalty: 10,
      description: "含有制表符或全角空格，可能影响 ATS 读取",
      suggestion: "用普通空格替换制表符/全角空格，保持单栏文本",
    });
  }

  const nonAsciiRatio = calculateNonAsciiRatio(normalized);
  if (nonAsciiRatio > 0.6) {
    issues.push({
      penalty: 25,
      description: "检测到编码问题或非 ASCII 字符占比过高",
      suggestion: "检查文件编码，确保使用 UTF-8 格式，减少特殊字符",
    });
  }

  const totalPenalty = issues.reduce((sum, issue) => sum + issue.penalty, 0);
  const currentScore = Math.max(0, Math.min(100, Math.round(100 - totalPenalty)));
  const currentGrade = mapScoreToGrade(currentScore);
  
  // 计算优化后分数
  const optimizedScore = calculateOptimizedScore(currentScore, issues);
  const optimizedGrade = mapScoreToGrade(optimizedScore);
  
  // 确定状态
  let status = "⏳ 待优化";
  if (currentGrade === "D" || currentGrade === "C") {
    status = "🔓 可解决";
  } else if (currentScore < optimizedScore) {
    status = "🔄 可提升";
  } else if (currentGrade === "S" || currentGrade === "A") {
    status = "✨ 已优秀";
  }
  
  // 构建陈述
  const preStatement = getGradeStatement(currentGrade, "ats_compatibility");
  const postStatement = currentScore < optimizedScore 
    ? `通过${buildDirectiveAbstract(issues).replace("修复了", "").replace("项格式问题", "项优化")}，已将ATS兼容性提升至${optimizedGrade}级水平。`
    : "简历格式已达到优秀标准。";
  
  const confidence = deriveConfidence(currentScore, issues.length);
  const improvementScore = Math.max(0, optimizedScore - currentScore);

  return {
    // 基础信息
    dimension: "ats_compatibility",
    display_name: "ATS兼容性",
    icon: getGradeIcon(currentGrade),
    color: getGradeColor(currentGrade),
    
    // 当前状态
    current_score: currentScore,
    current_grade: currentGrade,
    
    // 优化潜力
    optimized_score: optimizedScore,
    optimized_grade: optimizedGrade,
    status: status,
    improvement_score: improvementScore,
    
    // 陈述与建议
    statement: {
      pre_optimization: preStatement,
      post_optimization: postStatement
    },
    directive_abstract: buildDirectiveAbstract(issues),
    raw_advice: issues.length > 0 
      ? issues.map(issue => issue.suggestion).join("；") + "。建议优先处理以上问题以提升 ATS 通过率。"
      : "简历格式干净，符合 ATS 要求，可直接投递。",
    
    // 元数据
    confidence: confidence,
    issue_count: issues.length,
    issues: issues.map(issue => ({
      description: issue.description,
      suggestion: issue.suggestion,
      penalty: issue.penalty
    }))
  };
}

export class AtsService {
  async apply(resumeText) {
    const originalText = resumeText ?? "";
    let optimized = normalizeBullets(originalText)
      .replace(/\r\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n");

    const changes = [];

    if (optimized !== originalText) {
      changes.push({
        module: "ATS",
        type: "format",
        priority: "high",
        description: "统一项目符号与行距，提升 ATS 解析兼容性",
        reason: "减少异常符号或多余空行导致的解析失败",
        impact: "ats_compatibility",
      });
    }

    if (/\t|\u3000/.test(originalText)) {
      optimized = optimized.replace(/\t|\u3000/g, " ");
      changes.push({
        module: "ATS",
        type: "format",
        priority: "medium",
        description: "去除制表符/全角空格，保持文本流畅",
        reason: "避免 ATS 误判分栏或表格",
      });
    }

    if (optimized.length > 7000) {
      optimized = optimized.slice(0, 7000);
      changes.push({
        module: "ATS",
        type: "length",
        priority: "medium",
        description: "截断过长文本以保留核心信息",
        reason: "超长简历容易被解析器降权",
        impact: "readability",
      });
    }

    const atsCompatibility = scoreCompatibility(originalText);

    return {
      optimizedResume: optimized,
      changes,
      atsCompatibility,
    };
  }
}
