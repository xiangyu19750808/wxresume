export class HrImpressionService {
  async apply(resumeText, parsedJD, context) {
    const changes = [];
    let optimized = resumeText;
    const introExists = /摘要|简介|summary|profile/i.test(resumeText.slice(0, 600));

    const headlineKeywords = (parsedJD.jdKeywords || []).slice(0, 3);
    const keywordLine = headlineKeywords.length
      ? `关键聚焦：${headlineKeywords.join(' / ')}`
      : '关键聚焦：岗位匹配能力与成果';

    if (!introExists) {
      optimized = `个人简介\n- ${keywordLine}\n- 在最近项目中取得的成果请突出量化指标\n\n${resumeText}`;
      changes.push({
        module: 'HRImpression',
        type: 'summary',
        priority: 'high',
        description: '新增个人简介段落，突出关键关键词与可量化成果',
        reason: '首屏缺少摘要，难以快速留下印象',
        impact: 'hr_impression',
      });
    }

    if (context.strategy.tone === 'formal') {
      optimized = optimized.replace(/(我|本人)/g, '本人');
    }

    return { optimizedResume: optimized, changes };
  }
}
