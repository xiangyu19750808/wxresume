import { HardRequirementsService } from './hard-requirements.service.js';
import { WarningsService } from './warnings.service.js';
import { calcMatchScore } from './match.service.js';
import { scoreResumeQuality } from './quality.service.js';
import type { ParsedJD } from '../parsers/jd.parser';

export interface HardCheckItem {
  label: string;
  jdValue: string;
  resumeValue: string;
  match: string;
}

export interface ScreeningResult {
  status: 'success' | 'warning' | 'error';
  screening_passed: boolean;
  warnings: string[] | null;
  jd_quality: 'A' | 'B' | 'C' | 'D';
  resume_quality: 'A' | 'B' | 'C' | 'D';
  hard_requirement_match: number;
  hardCheckResult: HardCheckItem[];
  match_score: number;
  next_step: 'proceed_to_optimization' | 'user_input_required' | 'reject';
  reason?: string;
  required_action?: string;
}

export class ScreeningService {
  private hardRequirementsService = new HardRequirementsService();
  private warningsService = new WarningsService();

  async runScreening(input: { resumeText: string; jdText: string; parsedJD: ParsedJD }): Promise<ScreeningResult> {
    const { resumeText, jdText, parsedJD } = input;

    const hardRules = await this.hardRequirementsService.checkRequirements(resumeText, jdText, parsedJD);
    if (hardRules.shouldStop) {
      return {
        status: 'error',
        screening_passed: false,
        warnings: hardRules.warnings,
        jd_quality: parsedJD?.qualityScore ?? 'D',
        resume_quality: 'D',
        hard_requirement_match: 0,
        hardCheckResult: hardRules.hardCheckItems,
        match_score: 0,
        next_step: 'user_input_required',
        reason: 'resume_too_short',
        required_action: '请补充简历内容至 50 字以上',
      };
    }

    const warningResult = await this.warningsService.generateWarnings(resumeText, jdText, parsedJD);
    const { matchScore, hardMatchRatio, hardCheckItems } = await calcMatchScore(resumeText, parsedJD);
    const resumeQuality = scoreResumeQuality(resumeText);
    const jdQuality = parsedJD?.qualityScore ?? 'C';

    const status: ScreeningResult['status'] = warningResult.warnings.length > 0 ? 'warning' : 'success';
    const next_step: ScreeningResult['next_step'] =
      status === 'success' ? 'proceed_to_optimization' : 'user_input_required';

    return {
      status,
      screening_passed: true,
      warnings: [...warningResult.warnings, ...(parsedJD?.warnings || [])],
      jd_quality: jdQuality,
      resume_quality: resumeQuality,
      hard_requirement_match: hardMatchRatio,
      hardCheckResult: hardCheckItems,
      match_score: matchScore,
      next_step,
    };
  }
}
