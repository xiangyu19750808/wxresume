// 测试三个模块的完整性和集成
import { DiagnoseService } from './src/analysis/services/diagnose.service.js';

async function testAllThreeModules() {
  console.log("=== 测试三个模块的完整集成 ===");
  
  // 测试数据 - 中文
  const resumeText = "张三\n教育背景：本科\n工作经验：3年前端开发经验\n技能：React、Vue、JavaScript\n项目经验：电商平台开发，使用React和Vue框架";
  const jdText = "高级前端工程师\n要求：\n1. 学历：本科及以上\n2. 工作经验：3年以上前端开发经验\n3. 技能要求：精通React、Vue、JavaScript\n4. 具备电商平台开发经验者优先";
  
  console.log("测试数据：");
  console.log("简历长度:", resumeText.length);
  console.log("JD长度:", jdText.length);
  console.log("简历预览:", resumeText.substring(0, 50) + "...");
  console.log("JD预览:", jdText.substring(0, 50) + "...");
  
  try {
    // 创建诊断服务
    const diagnoseService = new DiagnoseService();
    
    // 运行九维分析（目前只有三个模块）
    const results = await diagnoseService.runDiagnose(resumeText, jdText);
    
    console.log("\n=== 测试结果 ===");
    console.log("成功分析维度数量:", Object.keys(results).length);
    
    // 检查每个模块
    const modules = ['ats_compatibility', 'hard_requirements', 'keyword_density'];
    let allPassed = true;
    
    modules.forEach(moduleKey => {
      if (results[moduleKey]) {
        const module = results[moduleKey];
        console.log(`\n✅ ${module.display_name}:`);
        console.log(`   当前等级: ${module.current_grade} (${module.current_score}分)`);
        console.log(`   优化目标: ${module.optimized_grade} (${module.optimized_score}分)`);
        console.log(`   状态: ${module.status}`);
        console.log(`   颜色: ${module.color}`);
        console.log(`   问题数: ${module.issue_count}`);
        
        // 检查规范符合性
        if (!module.color || !module.icon || !module.statement) {
          console.log(`   ⚠️ 缺少规范字段`);
          allPassed = false;
        }
      } else {
        console.log(`\n❌ ${moduleKey} 模块缺失`);
        allPassed = false;
      }
    });
    
    // 检查关键词密度模块是否优化到A级（规范要求）
    const keywordModule = results.keyword_density;
    if (keywordModule) {
      const isTargetA = keywordModule.optimized_grade === 'A' && 
                       keywordModule.optimized_score >= 75 && 
                       keywordModule.optimized_score <= 89;
      console.log(`\n🎯 关键词密度优化目标检查:`);
      console.log(`   规范要求: A级 (75-89分)`);
      console.log(`   实际优化: ${keywordModule.optimized_grade}级 (${keywordModule.optimized_score}分)`);
      console.log(`   符合规范: ${isTargetA ? '✅' : '❌'}`);
    }
    
    // 总体结论
    console.log("\n=== 总体结论 ===");
    if (allPassed && Object.keys(results).length === 3) {
      console.log("✅ 三个模块全部正常工作且符合规范");
      console.log("✅ 集成测试通过");
      console.log("✅ 可以开始模块4（技能匹配度）的开发");
    } else {
      console.log("❌ 测试失败，需要修复");
    }
    
    return results;
    
  } catch (error) {
    console.error("❌ 测试失败:", error);
    console.error("错误堆栈:", error.stack);
    return null;
  }
}

// 运行测试
testAllThreeModules().then(results => {
  if (results) {
    console.log("\n✅ 测试完成");
  } else {
    console.log("\n❌ 测试失败");
    process.exit(1);
  }
});
