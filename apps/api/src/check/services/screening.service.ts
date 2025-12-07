import { HardRequirementsService } from './hard-requirements.service';
import { WarningsService } from './warnings.service';
import { MatchService } from './match.service';
import { QualityService } from './quality.service';

export interface ScreeningResult {
  status: 'success' | 'warning' | 'error';
  hardCheckResult?: any;
  warnings?: any[];
  matchScore?: number;
  qualityScore?: number;
  metadata?: Record<string, unknown>;
}

export class ScreeningService {
  private hardRequirementsService = new HardRequirementsService();
  private warningsService = new WarningsService();
  private matchService = new MatchService();
  private qualityService = new QualityService();

  async runScreening(resumeText: string, jdText: string): Promise<ScreeningResult> {
    // Orchestrates hard checks, warnings, match score, and quality score
    // Returns consolidated screening result (implementation pending)
    return {
      status: 'warning',
      hardCheckResult: await this.hardRequirementsService.checkRequirements(resumeText, jdText),
      warnings: await this.warningsService.generateWarnings(resumeText, jdText),
      matchScore: await this.matchService.calculateMatchScore(resumeText, jdText),
      qualityScore: await this.qualityService.scoreQuality(resumeText),
      metadata: {},
    };
  }
}
