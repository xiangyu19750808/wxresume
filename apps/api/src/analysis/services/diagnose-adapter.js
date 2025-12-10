// 诊断服务适配器 - 修复 runDiagnose 不存在的问题
const { DiagnoseService } = require('./diagnose.service.js');

class DiagnoseServiceAdapter {
    constructor() {
        this.diagnoseService = new DiagnoseService();
    }
    
    // 添加 runDiagnose 方法来兼容现有代码
    async diagnose(resumeText, jdText) {
        console.log('通过适配器调用诊断服务...');
        return await this.diagnoseService.diagnose(resumeText, jdText);
    }
    
    // 保留原有的 diagnose 方法
    async diagnose(resumeText, jdText) {
        return await this.diagnoseService.diagnose(resumeText, jdText);
    }
}

module.exports = { DiagnoseServiceAdapter };

