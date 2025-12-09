// 综合测试技能匹配度分析器
console.log("=== 综合测试技能匹配度分析器 ===");

// 更真实的测试数据
const resumeText = `
张三 | 前端开发工程师 | 3年经验

专业技能：
- 精通React框架，有大型电商项目开发经验
- 熟练掌握JavaScript，熟悉ES6+新特性
- 熟悉Vue.js，有管理系统开发经验
- 掌握TypeScript，在项目中应用TS类型系统
- 熟练使用HTML5/CSS3，能够实现复杂布局
- 了解前端工程化，配置过Webpack
- 使用过Node.js开发简单后端接口

项目经验：
1. 电商平台项目（2022-2023）
   - 使用React + TypeScript开发前端应用
   - 实现商品列表、购物车、订单管理等核心功能
   - 使用Webpack进行项目构建优化
   - 性能优化，首屏加载时间减少40%

2. 企业管理系统（2021-2022）
   - 使用Vue.js + Element UI开发
   - 与后端API对接，实现数据可视化
   - 使用Git进行版本控制，参与代码评审

工作经历：
- ABC科技有限公司（2021-至今）
  - 负责前端架构设计和开发
  - 带领3人前端团队
  - 技术栈选型和代码规范制定

自我评价：
- 热爱前端技术，持续学习新技术
- 有良好的团队协作和沟通能力
`;

const jdText = `
高级前端开发工程师

岗位职责：
1. 负责公司核心产品的前端架构设计和开发
2. 带领前端团队，进行技术攻关和代码评审
3. 优化前端性能，提升用户体验

任职要求：
1. 精通React框架，有大型项目经验
2. 熟练掌握JavaScript/TypeScript
3. 熟悉Vue.js框架者优先
4. 掌握前端工程化，熟悉Webpack、Vite等构建工具
5. 了解Node.js，有全栈开发经验者优先
6. 具备良好的团队协作和沟通能力

技能要求：
必须精通：React、JavaScript
需要掌握：TypeScript、Vue
熟悉：前端工程化、Webpack
了解：Node.js、性能优化
`;

// 运行测试
async function runTest() {
  try {
    const { SkillMatchService } = await import('./apps/api/src/analysis/services/skill-match.service.js');
    
    const service = new SkillMatchService();
    console.log("开始分析...");
    
    const result = await service.analyze(resumeText, jdText);
    
    console.log("\n=== 核心指标 ===");
    console.log(`当前分数: ${result.current_score} (${result.current_grade}级)`);
    console.log(`优化目标: ${result.optimized_score} (${result.optimized_grade}级)`);
    console.log(`改进空间: ${result.improvement_score}分`);
    console.log(`状态: ${result.status}`);
    
    console.log("\n=== 技能匹配分析 ===");
    console.log(`JD技能数: ${result.detailed_analysis.jd_skill_count}`);
    console.log(`简历技能数: ${result.detailed_analysis.resume_skill_count}`);
    console.log(`匹配数: ${result.detailed_analysis.matched_count}`);
    console.log(`覆盖率: ${result.detailed_analysis.coverage}%`);
    console.log(`级别匹配度: ${result.detailed_analysis.level_match}%`);
    
    console.log("\n=== 问题分析 ===");
    console.log(`问题总数: ${result.issue_count}`);
    result.issues.forEach((issue, index) => {
      console.log(`\n${index + 1}. [${issue.type}] ${issue.description}`);
      console.log(`   严重程度: ${issue.severity}`);
      console.log(`   建议: ${issue.suggestion}`);
    });
    
    console.log("\n=== 优化建议 ===");
    console.log(`优化摘要: ${result.directive_abstract}`);
    console.log(`优化前: ${result.statement.pre_optimization}`);
    console.log(`优化后: ${result.statement.post_optimization}`);
    
    // 检查是否符合规范要求
    console.log("\n=== 规范符合性检查 ===");
    console.log(`是否使用P1优先级: ${service.priority === 'P1' ? '✅' : '❌'}`);
    console.log(`是否使用正确图标: ${result.icon === '🛠️' ? '✅' : '❌'}`);
    console.log(`当前等级是否为B级目标: ${result.current_grade === 'B' ? '✅ 已达到' : '❌ 未达到'}`);
    console.log(`优化目标是否为B级: ${result.optimized_grade === 'B' ? '✅ 可达标' : '❌ 需优化'}`);
    
    return result;
    
  } catch (error) {
    console.error("测试失败:", error);
    console.error("错误堆栈:", error.stack);
  }
}

runTest();
