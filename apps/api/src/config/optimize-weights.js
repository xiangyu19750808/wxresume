export const optimizeWeights = {
  passRatePredictor: {
    atsCompatibility: 0.25,
    hardRequirementMatch: 0.3,
    keywordRanking: 0.15,
    hrFirstImpression: 0.2,
    riskFree: 0.1,
  },
  moduleWeights: {
    ats: 1,
    hard: 1,
    core: 1,
    keyword: 1,
    hr: 1,
    risk: 1,
  },
};
