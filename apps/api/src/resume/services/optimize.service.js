import { parseJD } from '../../check/parsers/jd.parser.js';
import { optimizeWeights } from '../../config/optimize-weights.js';
import { optimizeConfig } from '../config/optimize-config.js';
import { normalizeResumeText } from '../utils/text-normalize.js';
import { extractKeywords, countKeywordFrequency } from '../utils/keyword-utils.js';
import { AtsService } from './ats.service.js';
import { HardRequirementService } from './hard-requirement.service.js';
import { CoreCompetencyService } from './core-competency.service.js';
import { KeywordBoosterService } from './keyword-booster.service.js';
import { HrImpressionService } from './hr-impression.service.js';
import { RiskEliminatorService } from './risk-eliminator.service.js';

export class OptimizeService {
  constructor() {
    this.atsService = new AtsService();
    this.hardRequirementService = new HardRequirementService();
    this.coreCompetencyService = new CoreCompetencyService();
    this.keywordBoosterService = new KeywordBoosterService();
    this.hrImpressionService = new HrImpressionService();
    this.riskEliminatorService = new RiskEliminatorService();
  }

  async optimize(resumeText, jdText, companyType = 'balanced') {
    const normalizedResume = normalizeResumeText(resumeText);
    const normalizedJd = String(jdText || '').trim();

    if (!normalizedResume || !normalizedJd) {
      throw new Error('resumeText and jdText required');
    }

    const parsedJD = parseJD(normalizedJd);
    const resumeKeywords = extractKeywords(normalizedResume);

    const strategy =
      optimizeConfig.companyStrategies[companyType] ||
      optimizeConfig.companyStrategies.balanced;

    const context = {
      parsedJD,
      companyType,
      resumeKeywords,
      strategy,
    };

    const originalScore = this.calculatePassRateScore(normalizedResume, parsedJD, context);

    const moduleResults = [];
    let workingResume = normalizedResume;

    const atsResult = await this.atsService.apply(workingResume, parsedJD, context);
    workingResume = atsResult.optimizedResume;
    moduleResults.push(atsResult);

    const hardResult = await this.hardRequirementService.apply(workingResume, parsedJD, context);
    workingResume = hardResult.optimizedResume;
    moduleResults.push(hardResult);

    const coreResult = await this.coreCompetencyService.apply(workingResume, parsedJD, context);
    workingResume = coreResult.optimizedResume;
    moduleResults.push(coreResult);

    const keywordResult = await this.keywordBoosterService.apply(workingResume, parsedJD, context);
    workingResume = keywordResult.optimizedResume;
    moduleResults.push(keywordResult);

    const hrResult = await this.hrImpressionService.apply(workingResume, parsedJD, context);
    workingResume = hrResult.optimizedResume;
    moduleResults.push(hrResult);

    const riskResult = await this.riskEliminatorService.apply(workingResume, parsedJD, context);
    workingResume = riskResult.optimizedResume;
    moduleResults.push(riskResult);

    const optimizedScore = this.calculatePassRateScore(workingResume, parsedJD, context);
    const delta = Math.max(0, optimizedScore - originalScore);
    const riskEliminated = moduleResults.flatMap((r) => r.risksEliminated || []);
    const appliedChanges = moduleResults.flatMap((r) => r.changes);

    const key_improvements = appliedChanges
      .filter((item) => item.priority === 'critical' || item.priority === 'high')
      .slice(0, 6)
      .map((item) => item.description);

    const checklist = optimizeConfig.defaultChecklist || [];

    return {
      optimized_resume: workingResume,
      original_score: Math.round(originalScore),
      optimized_score: Math.round(optimizedScore),
      expected_pass_rate_increase: `${Math.round(delta)}%`,
      key_improvements: key_improvements.length ? key_improvements : appliedChanges.map((c) => c.description).slice(0, 5),
      applied_changes: appliedChanges,
      risk_eliminated: riskEliminated,
      checklist,
    };
  }

  calculatePassRateScore(resumeText, parsedJD, context) {
    const atsScore = this.calculateAtsScore(resumeText);
    const hardReqScore = this.calculateHardRequirementScore(resumeText, parsedJD);
    const keywordScore = this.calculateKeywordScore(resumeText, parsedJD, context);
    const hrImpressionScore = this.calculateHrImpressionScore(resumeText, context);
    const riskFreeScore = this.calculateRiskFreeScore(resumeText);

    const { passRatePredictor } = optimizeWeights;
    const weights = this.adjustWeightsByCompanyType(passRatePredictor, context);

    const overall =
      atsScore * weights.atsCompatibility +
      hardReqScore * weights.hardRequirementMatch +
      keywordScore * weights.keywordRanking +
      hrImpressionScore * weights.hrFirstImpression +
      riskFreeScore * weights.riskFree;

    return Math.min(Math.max(overall * 100, 0), 100);
  }

  adjustWeightsByCompanyType(baseWeights, context) {
    const { companyType, strategy } = context;
    if (companyType === 'large_corp') {
      return {
        ...baseWeights,
        atsCompatibility: baseWeights.atsCompatibility * 1.1,
        keywordRanking: baseWeights.keywordRanking * strategy.keywordBoost,
      };
    }
    if (companyType === 'startup') {
      return {
        ...baseWeights,
        hrFirstImpression: baseWeights.hrFirstImpression * strategy.hrEmphasis,
        riskFree: baseWeights.riskFree * 1.05,
      };
    }
    return baseWeights;
  }

  calculateAtsScore(resumeText) {
    const length = resumeText.length;
    let score = 0.7;
    if (/\t|\u3000/.test(resumeText)) score -= 0.05;
    if (/\|\s*\|/.test(resumeText)) score -= 0.05;
    if (length > 6000) score -= 0.1;
    if (length < 500) score -= 0.05;
    return this.clampScore(score);
  }

  calculateHardRequirementScore(resumeText, parsedJD) {
    const checks = [];
    if (parsedJD.degreeRequired) {
      checks.push(new RegExp(parsedJD.degreeRequired).test(resumeText));
    }
    if (parsedJD.experienceYears) {
      const expMatch = resumeText.match(/(\d+)\s*年/);
      if (expMatch) {
        const years = Number(expMatch[1]);
        checks.push(years >= parsedJD.experienceYears * 0.7);
      }
    }
    if (parsedJD.certificates?.length) {
      const resumeLower = resumeText.toLowerCase();
      parsedJD.certificates.forEach((cert) => {
        checks.push(resumeLower.includes(cert.toLowerCase()));
      });
    }
    if (parsedJD.mustHaveSkills?.length) {
      const resumeLower = resumeText.toLowerCase();
      parsedJD.mustHaveSkills.forEach((skill) => {
        checks.push(resumeLower.includes(skill.toLowerCase()));
      });
    }

    const truthy = checks.filter((c) => c !== null);
    if (!truthy.length) return 0.5;
    const hit = truthy.filter(Boolean).length;
    return this.clampScore(hit / truthy.length);
  }

  calculateKeywordScore(resumeText, parsedJD, context) {
    const importantKeywords = Array.from(
      new Set([...(parsedJD.mustHaveSkills || []), ...(parsedJD.jdKeywords || [])]),
    );
    if (!importantKeywords.length) return 0.5;
    const freq = countKeywordFrequency(resumeText, importantKeywords);
    const hits = importantKeywords.filter((kw) => (freq[kw] || 0) > 0).length;
    const coverage = hits / importantKeywords.length;
    const densityBonus = Math.min(
      0.2,
      importantKeywords.reduce((acc, kw) => acc + Math.min(freq[kw] || 0, 3) * 0.01, 0),
    );
    const boosted = (coverage + densityBonus) * context.strategy.keywordBoost;
    return this.clampScore(boosted);
  }

  calculateHrImpressionScore(resumeText, context) {
    const firstChunk = resumeText.slice(0, 600).toLowerCase();
    let score = 0.6;
    if (/摘要|简介|summary|profile/.test(firstChunk)) score += 0.15;
    if (/\d{4}/.test(firstChunk)) score += 0.05;
    if (firstChunk.split(/\n/).filter(Boolean).length >= 3) score += 0.05;
    score *= context.strategy.hrEmphasis;
    return this.clampScore(score);
  }

  calculateRiskFreeScore(resumeText) {
    let score = 0.7;
    if (/\b(?:离职|裁员|freelance)\b/i.test(resumeText)) score -= 0.05;
    const jobHopMatches = resumeText.match(/\b20\d{2}\b/g);
    if (jobHopMatches && jobHopMatches.length > 12) score -= 0.1;
    if (resumeText.length > 7000) score -= 0.1;
    return this.clampScore(score);
  }

  clampScore(value) {
    if (!Number.isFinite(value)) return 0;
    if (value < 0) return 0;
    if (value > 1) return 1;
    return Number(value);
  }
}
