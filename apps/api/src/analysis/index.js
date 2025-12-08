import { Router } from 'express';
import { DiagnoseController } from './controller/diagnose.controller.js';

export function createDiagnoseRouter() {
  const router = Router();
  const controller = new DiagnoseController();

  router.post('/diagnose', controller.handleDiagnose);

  return router;
}

export * from './controller/diagnose.controller.js';
export * from './services/diagnose.service.js';
