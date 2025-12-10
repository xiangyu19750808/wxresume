function findMatch(text, patterns) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[0];
  }
  return null;
}

export class HardRequirementService {
  async apply(resumeText, parsedJD, context) {
    const changes = [];
    const coverage = [];
    let optimized = resumeText;

    if (parsedJD.degreeRequired) {
      const degreeMatch = findMatch(resumeText, [/博士/, /硕士/, /本科/, /大专/, /研究生/]);
      if (degreeMatch) {
        coverage.push(`学历：${degreeMatch}`);
      } else {
        changes.push({
          module: 'HardRequirement',
          type: 'gap',
          priority: 'high',
          description: `请明确标注学历以对应 JD 要求（${parsedJD.degreeRequired}）`,
          reason: '硬性学历要求未在简历中体现',
          impact: 'hard_requirement',
        });
      }
    }

    if (parsedJD.experienceYears) {
      const experienceMatch = findMatch(resumeText, [/(\d+)\s*年[^\n]*?经验/]);
      if (experienceMatch) {
        coverage.push(`经验：${experienceMatch}`);
      } else {
        changes.push({
          module: 'HardRequirement',
          type: 'gap',
          priority: 'high',
          description: `建议在个人摘要中写明总工作年限以对应 JD ${parsedJD.experienceYears} 年经验`,
          reason: '经验年限未显式出现',
        });
      }
    }

    const resumeLower = resumeText.toLowerCase();
    const matchedCertificates = (parsedJD.certificates || []).filter((cert) =>
      resumeLower.includes(cert.toLowerCase()),
    );
    if (matchedCertificates.length) {
      coverage.push(`证书：${matchedCertificates.join('、')}`);
    }
    const missingCertificates = (parsedJD.certificates || []).filter(
      (cert) => !resumeLower.includes(cert.toLowerCase()),
    );
    missingCertificates.forEach((cert) => {
      changes.push({
        module: 'HardRequirement',
        type: 'gap',
        priority: 'medium',
        description: `JD 证书要求未覆盖：${cert}`,
        reason: '建议在技能或证书栏补充已取得的认证',
      });
    });

    const jdSkills = (parsedJD.mustHaveSkills || []).map((s) => s.toLowerCase());
    const resumeSkills = new Set((context.resumeKeywords || []).map((s) => s.toLowerCase()));
    const matchedSkills = jdSkills.filter((s) => resumeSkills.has(s));
    if (matchedSkills.length) {
      coverage.push(`必备技能：${matchedSkills.join('、')}`);
    }
    jdSkills
      .filter((s) => !resumeSkills.has(s))
      .forEach((skill) => {
        changes.push({
          module: 'HardRequirement',
          type: 'gap',
          priority: 'medium',
          description: `JD 必备技能未体现：${skill}`,
          reason: '请确认是否具备并在经历中补充相关描述',
        });
      });

    if (coverage.length) {
      optimized = `硬性要求对齐概览\n- ${coverage.join('\n- ')}\n\n${resumeText}`;
      changes.push({
        module: 'HardRequirement',
        type: 'summary',
        priority: 'high',
        description: '在开头增加硬性要求匹配概览',
        reason: '显式回应学历/年限/证书/必备技能要求',
        impact: 'hard_requirement',
      });
    }

    return { optimizedResume: optimized, changes };
  }
}
