// 测试完整的九维分析集成
import { DiagnoseService } from './apps/api/src/analysis/services/diagnose.service.js';

async function testCompleteSystem() {
  console.log("=== 🚀 测试完整的九维分析系统 ===");
  
  const diagnoseService = new DiagnoseService();
  
  // 测试数据
  const resumeText = `
  张三 - 高级前端工程师
  
  教育背景：
  - 北京大学计算机科学硕士（2020-2023）
  - 电子科技大学计算机学士（2016-2020）
  
  工作经历：
  1. 阿里巴巴 - 前端开发工程师（2023至今）
  - 负责电商平台前端开发，使用React和TypeScript
  - 优化页面性能，提升用户体验
  - 参与组件库开发和维护
  
  2. 腾讯 - 前端开发实习生（2022-2023）
  - 参与社交平台前端开发
  - 学习Vue.js和企业级开发流程
  
  技能：
  - 前端框架：React、Vue、TypeScript
  - 开发工具：Webpack、Git、VS Code
  - 其他：HTML5、CSS3、JavaScript ES6+
  
  项目成就：
  - 获得阿里巴巴年度优秀新人奖
  - 主导的页面优化项目提升加载速度30%
  `;
  
  const jdText = `
  高级前端工程师招聘
  
  职位要求：
  1. 学历要求：计算机相关专业本科及以上
  2. 工作经验：3年以上前端开发经验
  3. 技术栈：精通React、熟练Vue、掌握TypeScript
  4. 项目经验：有大型互联网公司经验者优先
  5. 软技能：良好的团队协作和沟通能力
  
  我们提供：
  - 有竞争力的薪酬待遇
  - 技术成长和晋升空间
  - 优秀的团队文化和工作环境
  `;
  
  console.log("开始完整九维分析...");
  
  try {
    const result = await diagnoseService.diagnose(resumeText, jdText);
    
    console.log("\n=== 📊 分析结果 ===");
    console.log(`总体得分: ${result.overview.final_score}`);
    console.log(`分析维度数: ${result.overview.dimension_count}`);
    console.log(`等级分布:`, result.overview.grade_summary);
    console.log(`预计改进效果: ${result.overview.estimated_improvement}`);
    
    console.log("\n=== 🔍 各维度详情 ===");
    Object.entries(result.dimensions).forEach(([dim, data]) => {
      console.log(`${data.icon} ${data.display_name}: ${data.current_grade}级 → ${data.optimized_grade}级`);
    });
    
    // 验证所有9个维度都存在
    const expectedDimensions = [
      'ats_compatibility', 'hard_requirement', 'keyword_density',
      'skill_match', 'core_ability', 'career_risk',
      'education_match', 'function_match', 'semantic_match'
    ];
    
    const missingDimensions = expectedDimensions.filter(dim => !result.dimensions[dim]);
    
    if (missingDimensions.length === 0) {
      console.log("\n✅ 所有9个维度分析完成！");
      console.log("🎉 九维分析系统完整集成成功！");
    } else {
      console.log(`\n⚠️ 缺少维度: ${missingDimensions.join(', ')}`);
    }
    
  } catch (error) {
    console.error("测试失败:", error);
  }
}

testCompleteSystem();
