// 调试高匹配简历
const resumeText = "张三\n教育背景：硕士，计算机科学\n工作经验：5年前端开发经验\n技能：精通React、Vue、TypeScript\n证书：PMP证书、高级前端工程师证书";
const jdText = "高级前端工程师\n要求：\n1. 学历：本科及以上\n2. 工作经验：3年以上前端开发经验\n3. 证书：要求具备PMP证书\n4. 技能：精通React、熟练Vue、掌握TypeScript";

console.log("=== 调试高匹配简历 ===");
console.log("简历文本:", resumeText);
console.log("JD文本:", jdText);

// 模拟提取要求
const extractRequirements = (jdText) => {
  const requirements = [];
  
  // 1. 学历要求
  if (jdText.includes("学历：") || jdText.includes("学历:") || jdText.includes("本科") || jdText.includes("硕士") || jdText.includes("大专")) {
    let degree = "本科";
    if (jdText.includes("大专")) degree = "大专";
    if (jdText.includes("本科")) degree = "本科";
    if (jdText.includes("硕士")) degree = "硕士";
    if (jdText.includes("博士")) degree = "博士";
    
    console.log(`学历要求: ${degree}及以上`);
    requirements.push({
      type: "degree",
      value: degree,
      description: `学历要求：${degree}及以上`,
      weight: 25
    });
  }

  // 2. 经验要求
  const expMatch = jdText.match(/(\d+)\s*年/);
  if (expMatch) {
    const years = parseInt(expMatch[1]);
    if (years > 0 && years < 50) {
      console.log(`经验要求: ${years}年以上`);
      requirements.push({
        type: "experience",
        value: years,
        description: `工作经验：${years}年以上`,
        weight: 30
      });
    }
  }

  // 3. 证书要求
  if (jdText.includes("PMP") || jdText.includes("证书")) {
    console.log("证书要求: PMP证书");
    requirements.push({
      type: "certification",
      value: "PMP",
      description: "证书要求：PMP证书",
      weight: 20
    });
  }

  // 4. 技能要求
  const skills = ["typescript", "react", "vue", "javascript", "python", "java"];
  skills.forEach(skill => {
    if (jdText.toLowerCase().includes(skill)) {
      console.log(`技能要求: ${skill}`);
      requirements.push({
        type: "skill",
        value: skill,
        description: `技能要求：${skill}`,
        weight: 15
      });
    }
  });

  console.log(`总共提取到 ${requirements.length} 个要求`);
  return requirements;
};

// 模拟检查要求
const checkRequirement = (resumeText, requirement) => {
  switch (requirement.type) {
    case "degree":
      const hasDegree = resumeText.includes(requirement.value);
      console.log(`学历检查: 要求${requirement.value}, 结果${hasDegree ? '匹配' : '不匹配'}, 简历包含"硕士": ${resumeText.includes("硕士")}`);
      return hasDegree;
    case "experience":
      const yearMatch = resumeText.match(/(\d+)\s*年/);
      if (yearMatch) {
        const foundYears = parseInt(yearMatch[1]);
        const matched = foundYears >= requirement.value;
        console.log(`经验检查: 要求${requirement.value}年, 找到${foundYears}年, 结果${matched ? '匹配' : '不匹配'}`);
        return matched;
      }
      console.log(`经验检查: 要求${requirement.value}年, 未找到经验信息`);
      return false;
    case "certification":
      const hasCert = resumeText.toLowerCase().includes(requirement.value.toLowerCase());
      console.log(`证书检查: 要求${requirement.value}, 结果${hasCert ? '有' : '无'}, 简历包含"PMP": ${resumeText.includes("PMP")}`);
      return hasCert;
    case "skill":
      const hasSkill = resumeText.toLowerCase().includes(requirement.value.toLowerCase());
      console.log(`技能检查: 要求${requirement.value}, 结果${hasSkill ? '有' : '无'}, 简历包含"${requirement.value}": ${resumeText.toLowerCase().includes(requirement.value.toLowerCase())}`);
      return hasSkill;
    default:
      return false;
  }
};

// 运行调试
console.log("\n=== 提取要求 ===");
const requirements = extractRequirements(jdText);

console.log("\n=== 检查匹配 ===");
let matchedWeight = 0;
let totalWeight = 0;

requirements.forEach((req, i) => {
  totalWeight += req.weight;
  const matched = checkRequirement(resumeText, req);
  console.log(`要求${i+1}: ${req.description} - ${matched ? '✓ 匹配' : '✗ 不匹配'}`);
  if (matched) {
    matchedWeight += req.weight;
  }
});

console.log("\n=== 计算结果 ===");
const weightRatio = totalWeight > 0 ? matchedWeight / totalWeight : 0;
const score = Math.round(weightRatio * 100);
console.log(`权重匹配: ${matchedWeight}/${totalWeight}`);
console.log(`分数: ${score}`);
console.log(`等级: ${score >= 90 ? 'S' : score >= 75 ? 'A' : score >= 60 ? 'B' : score >= 40 ? 'C' : 'D'}`);
