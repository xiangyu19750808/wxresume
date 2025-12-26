import { Router } from 'express';
import { DiagnoseController } from './controller/diagnose.controller.js';
import { handleOptimize } from './controller/optimize.controller.js';
import { handleExportPdf } from './controller/export.controller.js'; // ? 确保导入了导出 PDF 的逻辑

export function createDiagnoseRouter() {
  const router = Router();
  const controller = new DiagnoseController();

  // 1. 深度诊断接口 -> POST /v1/analysis/diagnose
  router.post('/diagnose', (req, res) => controller.handleDiagnose(req, res));
  
  // 2. 简历优化重构接口 -> POST /v1/analysis/optimize
  router.post('/optimize', handleOptimize);

  // 3. 导出 PDF 接口 -> POST /v1/analysis/export-pdf
  router.post('/export-pdf', handleExportPdf); 

  return router;
}

// 导出控制器，方便其他地方调用
export * from './controller/diagnose.controller.js';