import { countKeywordFrequency } from '../utils/keyword-utils';
import { ChangeItem, ModuleResult, OptimizeContext } from './optimize.service';

export class KeywordBoosterService {
  async apply(resumeText: string, parsedJD, context: OptimizeContext): Promise<ModuleResult> {
    const important = Array.from(
      new Set([...(parsedJD.mustHaveSkills || []), ...(parsedJD.jdKeywords || [])]),
    );
    const presentKeywords = important.filter((kw) =>
      (context.resumeKeywords || []).some((existing) => existing.toLowerCase() === kw.toLowerCase()),
    );

    const freq = countKeywordFrequency(resumeText, presentKeywords);
    const boosts = presentKeywords.filter((kw) => (freq[kw] || 0) < 2);
    let optimized = resumeText;
    const changes: ChangeItem[] = [];

    if (boosts.length) {
      const reinforceLine = `关键词强化：${boosts.join(', ')}`;
      optimized = `${resumeText}\n\n${reinforceLine}`;
      changes.push({
        module: 'KeywordBooster',
        type: 'keyword',
        priority: 'medium',
        description: `提升 ${boosts.length} 个 JD 关键词的曝光度`,
        reason: '确保关键技能在文本中出现 2~5 次，利于检索排序',
        impact: 'keyword_ranking',
      });
    }

    return { optimizedResume: optimized, changes };
  }
}
