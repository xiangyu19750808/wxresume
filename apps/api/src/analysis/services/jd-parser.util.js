/**
 * 极致准确版：JD要求结构化提取工具
 */
export class JDParserUtil {
    static parse(text) {
        if (!text) return null;

        // 1. 提取岗位名称
        const jobTitle = text.match(/(岗位|职位|招聘|角色)[:：]\s*(.+)/)?.[2] || "识别中";

        // 2. 提取硬技能词云（用于九维诊断：技能匹配度）
        // 匹配英文缩写和常见的IT技能词
        const skillsRequired = (text.match(/[a-zA-Z0-9+#]{2,}/g) || [])
            .filter(s => !/^[0-9]+$/.test(s)) // 排除纯数字
            .slice(0, 15);

        // 3. 提取工作年限要求
        const expMatch = text.match(/(\d+[-－至]\d+年|\d+年以上|\d+年)/);
        const yearsRequired = expMatch ? expMatch[0] : "经验不限";

        // 4. 提取学历门槛
        const degreeMatch = text.match(/(本科|硕士|大专|研究生|博士)/);
        const degreeRequired = degreeMatch ? degreeMatch[0] : "学历不限";

        return {
            job_title: jobTitle.trim(),
            skills_required: [...new Set(skillsRequired)], // 去重
            years_required: yearsRequired,
            degree_required: degreeRequired,
            is_urgent: text.includes('急聘') || text.includes('尽快')
        };
    }
}
