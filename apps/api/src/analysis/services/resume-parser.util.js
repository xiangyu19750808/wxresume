/**
 * 极致准确版：简历结构化提取工具
 */
export class ResumeParserUtil {
    static parse(text) {
        if (!text) return null;
        
        // 1. 提取量化成果（九维诊断核心：核心能力呈现）
        // 匹配包含百分比、金额、千万、亿等量化描述的句子
        const quantifiedResults = text.match(/[^。；\n]*(\d+(\.\d+)?%|\d+万|\d+亿|提升|增加|优化|节约)[^。；\n]*/g) || [];

        // 2. 提取技能块
        const skillBlock = text.match(/(技能|工具|掌握|精通|技术栈)[\s\S]*?(?=经历|教育|项目|荣誉|$)/g)?.[0] || "";

        // 3. 提取教育背景（九维诊断核心：教育背景匹配）
        const education = {
            degree: text.match(/(博士|研究生|硕士|本科|大专|高中)/)?.[0] || "其他",
            is985211: /(985|211|双一流|清华|北大|复旦|交大)/.test(text),
            school: text.match(/[\u4e00-\u9fa5]+(大学|学院)/)?.[0] || "未知学校"
        };

        // 4. 提取大厂背景（九维诊断核心：职业风险与竞争力）
        const famousCompanies = ['腾讯', '阿里', '字节', '美团', '百度', '华为', '京东', '拼多多', '小米', '网易'];
        const backgroud = famousCompanies.filter(c => text.includes(c));

        return {
            raw_length: text.length,
            quantified_count: quantifiedResults.length,
            quantified_list: quantifiedResults.slice(0, 5), // 取前5条精华
            skill_block: skillBlock,
            education,
            is_big_name: backgroud.length > 0,
            big_names: backgroud
        };
    }
}
