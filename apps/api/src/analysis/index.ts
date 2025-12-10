import { Router } from 'express';
import { DiagnoseController } from './controller/diagnose.controller';

export function createDiagnoseRouter() {
  const router = Router();
  const controller = new DiagnoseController();

  router.post('/diagnose', controller.handleDiagnose.bind(controller));

  return router;
}

export * from './controller/diagnose.controller';
export * from './controller/deep.controller';
export * from './services/diagnose.service';
export * from './services/deep.service';
export * from './config/analysis-thresholds';
export * from './utils/scoring-utils';
