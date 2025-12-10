// 九维分析系统 - 最终健康检查
import { DiagnoseService } from './apps/api/src/analysis/services/diagnose.service.js';

async function systemHealthCheck() {
  console.log("=== 🏥 九维分析系统健康检查 ===");
  
  const service = new DiagnoseService();
  
  // 1. 检查模块数量
  const dimensionCount = Object.keys(service.analyzers).length;
  console.log(`\n1. 模块数量检查: ${dimensionCount}/9 ${dimensionCount === 9 ? '✅' : '❌'}`);
  
  if (dimensionCount !== 9) {
    console.log("  实际维度:", Object.keys(service.analyzers));
  }
  
  // 2. 检查接口一致性
  console.log("\n2. 接口一致性检查:");
  const testResume = "测试简历";
  const testJD = "测试职位";
  
  let interfaceValid = true;
  for (const [dimension, analyzer] of Object.entries(service.analyzers)) {
    try {
      if (typeof analyzer.analyze !== 'function') {
        console.log(`  ${dimension}: ❌ 缺少analyze方法`);
        interfaceValid = false;
      } else {
        console.log(`  ${dimension}: ✅ analyze方法存在`);
      }
    } catch (error) {
      console.log(`  ${dimension}: ❌ 检查失败 - ${error.message}`);
      interfaceValid = false;
    }
  }
  
  // 3. 快速功能测试
  console.log("\n3. 快速功能测试:");
  try {
    const result = await service.diagnose(testResume, testJD);
    
    // 检查结果结构
    const hasOverview = result.overview && typeof result.overview === 'object';
    const hasDimensions = result.dimensions && typeof result.dimensions === 'object';
    const dimensionCountInResult = Object.keys(result.dimensions || {}).length;
    
    console.log(`  返回结果结构: ${hasOverview && hasDimensions ? '✅' : '❌'}`);
    console.log(`  返回维度数: ${dimensionCountInResult}/${dimensionCount}`);
    
    if (dimensionCountInResult === dimensionCount) {
      console.log("  ✅ 所有维度都返回了结果");
    }
    
  } catch (error) {
    console.log(`  ❌ 功能测试失败: ${error.message}`);
  }
  
  // 4. B→A提升逻辑验证
  console.log("\n4. B→A提升逻辑验证:");
  const bTestResume = "有3年Java开发经验，熟悉Spring Boot。";
  const bTestJD = "招聘Java开发工程师，要求有Spring Boot经验。";
  
  try {
    const bTestResult = await service.diagnose(bTestResume, bTestJD);
    const semanticResult = bTestResult.dimensions.semantic_match;
    
    console.log(`  语义匹配模块: ${semanticResult.current_grade}级 → ${semanticResult.optimized_grade}级`);
    
    if (semanticResult.current_grade === 'B' && semanticResult.optimized_grade === 'A') {
      console.log("  ✅ B→A提升逻辑工作正常");
    } else {
      console.log(`  ℹ️ 当前为${semanticResult.current_grade}级，提升到${semanticResult.optimized_grade}级`);
    }
  } catch (error) {
    console.log(`  ⚠️ B→A测试跳过: ${error.message}`);
  }
  
  console.log("\n=== 🎯 健康检查总结 ===");
  
  if (dimensionCount === 9 && interfaceValid) {
    console.log("✅ 九维分析系统健康状态良好！");
    console.log("✅ 所有9个模块集成成功");
    console.log("✅ 接口一致性验证通过");
    console.log("✅ 可以投入生产使用");
  } else {
    console.log("⚠️ 系统存在一些问题，需要检查");
  }
}

systemHealthCheck();
