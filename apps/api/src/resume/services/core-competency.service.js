export class CoreCompetencyService {
  async apply(resumeText, parsedJD, context) {
    const changes = [];
    const jdKeywords = (parsedJD.jdKeywords || []).map((k) => k.toLowerCase());
    const resumeKeywords = new Set((context.resumeKeywords || []).map((k) => k.toLowerCase()));

    const alignedKeywords = jdKeywords.filter((kw) => resumeKeywords.has(kw)).slice(0, 5);
    let optimized = resumeText;

    if (alignedKeywords.length) {
      const highlightBlock = `核心能力高光\n- ${alignedKeywords
        .map((kw) => `${kw.toUpperCase ? kw.toUpperCase() : kw}`)
        .join('\n- ')}`;
      optimized = `${highlightBlock}\n\n${resumeText}`;
      changes.push({
        module: 'CoreCompetency',
        type: 'highlight',
        priority: 'high',
        description: `突出与 JD 最相关的 ${alignedKeywords.length} 项能力`,
        reason: '让关键能力在首屏可见，方便 HR/面试官快速理解匹配度',
        impact: 'core_competency',
      });
    }

    return { optimizedResume: optimized, changes };
  }
}
