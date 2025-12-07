import { parseJD, ParsedJD } from '../../check/parsers/jd.parser';
import { optimizeWeights } from '../../config/optimize-weights';
import { optimizeConfig } from '../config/optimize-config';
import { normalizeResumeText } from '../utils/text-normalize';
import { extractKeywords, countKeywordFrequency } from '../utils/keyword-utils';
import { AtsService } from './ats.service';
import { HardRequirementService } from './hard-requirement.service';
import { CoreCompetencyService } from './core-competency.service';
import { KeywordBoosterService } from './keyword-booster.service';
import { HrImpressionService } from './hr-impression.service';
import { RiskEliminatorService } from './risk-eliminator.service';

export interface ChangeItem {
  module: string;
  type: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  reason: string;
  impact?: string;
}

export interface OptimizationResult {
  optimized_resume: string;
  original_score: number;
  optimized_score: number;
  expected_pass_rate_increase: string;
  key_improvements: string[];
  applied_changes: ChangeItem[];
  risk_eliminated: string[];
  checklist: string[];
}

export interface ModuleResult {
  optimizedResume: string;
  changes: ChangeItem[];
  risksEliminated?: string[];
}

export interface OptimizeContext {
  parsedJD: ParsedJD;
  companyType: string;
  resumeKeywords: string[];
  strategy: {
    tone: 'formal' | 'balanced';
    keywordBoost: number;
    hrEmphasis: number;
  };
}

export class OptimizeService {
  private atsService = new AtsService();
  private hardRequirementService = new HardRequirementService();
  private coreCompetencyService = new CoreCompetencyService();
  private keywordBoosterService = new KeywordBoosterService();
  private hrImpressionService = new HrImpressionService();
  private riskEliminatorService = new RiskEliminatorService();

  async optimize(
    resumeText: string,
    jdText: string,
    companyType: string = 'balanced',
  ): Promise<OptimizationResult> {
    const normalizedResume = normalizeResumeText(resumeText);
    const normalizedJd = String(jdText || '').trim();

    if (!normalizedResume || !normalizedJd) {
      throw new Error('resumeText and jdText required');
    }

    const parsedJD = parseJD(normalizedJd);
    const resumeKeywords = extractKeywords(normalizedResume);

    const strategy =
      optimizeConfig.companyStrategies[companyType as keyof typeof optimizeConfig.companyStrategies] ||
      optimizeConfig.companyStrategies.balanced;

    const context: OptimizeContext = {
      parsedJD,
      companyType,
      resumeKeywords,
      strategy,
    };

    const originalScore = this.calculatePassRateScore(normalizedResume, parsedJD, context);

    const moduleResults: ModuleResult[] = [];
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

  private calculatePassRateScore(resumeText: string, parsedJD: ParsedJD, context: OptimizeContext): number {
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

  private adjustWeightsByCompanyType(
    baseWeights: typeof optimizeWeights.passRatePredictor,
    context: OptimizeContext,
  ): typeof optimizeWeights.passRatePredictor {
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

  private calculateAtsScore(resumeText: string): number {
    const length = resumeText.length;
    let score = 0.7;
    if (/\t|\u3000/.test(resumeText)) score -= 0.05;
    if (/\|\s*\|/.test(resumeText)) score -= 0.05;
    if (length > 6000) score -= 0.1;
    if (length < 500) score -= 0.05;
    return this.clampScore(score);
  }

  private calculateHardRequirementScore(resumeText: string, parsedJD: ParsedJD): number {
    const checks: Array<boolean | null> = [];
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

  private calculateKeywordScore(resumeText: string, parsedJD: ParsedJD, context: OptimizeContext): number {
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

  private calculateHrImpressionScore(resumeText: string, context: OptimizeContext): number {
    const firstChunk = resumeText.slice(0, 600).toLowerCase();
    let score = 0.6;
    if (/摘要|简介|summary|profile/.test(firstChunk)) score += 0.15;
    if (/\d{4}/.test(firstChunk)) score += 0.05;
    if (firstChunk.split(/\n/).filter(Boolean).length >= 3) score += 0.05;
    score *= context.strategy.hrEmphasis;
    return this.clampScore(score);
  }

  private calculateRiskFreeScore(resumeText: string): number {
    let score = 0.7;
    if (/\b(?:离职|裁员|freelance)\b/i.test(resumeText)) score -= 0.05;
    const jobHopMatches = resumeText.match(/\b20\d{2}\b/g);
    if (jobHopMatches && jobHopMatches.length > 12) score -= 0.1;
    if (resumeText.length > 7000) score -= 0.1;
    return this.clampScore(score);
  }

  private clampScore(value: number): number {
    if (!Number.isFinite(value)) return 0;
    if (value < 0) return 0;
    if (value > 1) return 1;
    return Number(value);
  }
}
