import { ChangeItem, ModuleResult, OptimizeContext } from './optimize.service';

export class RiskEliminatorService {
  async apply(resumeText: string, _parsedJD, _context: OptimizeContext): Promise<ModuleResult> {
    const changes: ChangeItem[] = [];
    const risksEliminated: string[] = [];
    let optimized = resumeText;

    if (resumeText.length < 400) {
      changes.push({
        module: 'RiskEliminator',
        type: 'length',
        priority: 'critical',
        description: '简历过短，建议补充核心经历与成果',
        reason: '文本长度不足，容易被视为信息缺失',
        impact: 'risk_reduction',
      });
    }

    const gapMatch = resumeText.match(/20\d{2}[^2]*20\d{2}/);
    if (gapMatch) {
      changes.push({
        module: 'RiskEliminator',
        type: 'timeline',
        priority: 'medium',
        description: '请确认时间线连续，必要时补充“实习/项目/学习”说明',
        reason: '时间跨度可能存在空档，需要解释',
      });
      risksEliminated.push('潜在时间空档已提醒补充说明');
    }

    if (resumeText.length > 8000) {
      optimized = `${resumeText.slice(0, 7800)}\n...（其余内容建议精简后再补充）`;
      changes.push({
        module: 'RiskEliminator',
        type: 'length',
        priority: 'medium',
        description: '对超长文本进行压缩提示',
        reason: '简历过长会稀释重点，建议精简',
        impact: 'readability',
      });
      risksEliminated.push('过长文本导致的可读性风险');
    }

    return { optimizedResume: optimized, changes, risksEliminated };
  }
}
