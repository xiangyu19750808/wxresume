export const optimizeConfig = {
  sixModuleOptimizers: ['ats', 'hard', 'core', 'keyword', 'hr', 'risk'],
  passRatePredictor: {
    atsCompatibility: 0.25,
    hardRequirementMatch: 0.3,
    keywordRanking: 0.15,
    hrFirstImpression: 0.2,
    riskFree: 0.1,
  },
  companyStrategies: {
    large_corp: {
      tone: 'formal',
      keywordBoost: 1.1,
      hrEmphasis: 0.9,
    },
    startup: {
      tone: 'balanced',
      keywordBoost: 0.95,
      hrEmphasis: 1.1,
    },
    balanced: {
      tone: 'balanced',
      keywordBoost: 1,
      hrEmphasis: 1,
    },
    unknown: {
      tone: 'balanced',
      keywordBoost: 1,
      hrEmphasis: 1,
    },
  },
  defaultChecklist: [
    '请确认联系方式、邮箱等信息为最新且可用。',
    '检查项目/工作经历的时间线是否连续且真实。',
    '确保关键技能与 JD 中的要求一致且有真实支撑。',
    '如对措辞有疑虑，请在导出 PDF 前手动微调。',
    '导出前请再次通读，避免敏感信息或笔误。',
  ],
};
