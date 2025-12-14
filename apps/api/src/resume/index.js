import express from 'express';
import { ParseController } from './controller/parse.controller.js';
import { OptimizeController } from './controller/optimize.controller.js';

const parseController = new ParseController();
const optimizeController = new OptimizeController();

export function createResumeRouter() {
  const router = express.Router();

  router.post('/parse', (req, res) => parseController.handleParse(req, res));

  if (typeof optimizeController.handleOptimize === 'function') {
    router.post('/optimize', (req, res) => optimizeController.handleOptimize(req, res));
  }

  return router;
}

export { createResumeRouter as default };

export * from './controller/parse.controller.js';
export * from './controller/optimize.controller.js';
export * from './controller/export.controller.js';
export * from './services/parse.service.js';
export * from './services/optimize.service.js';
export * from './services/ats.service.js';
export * from './services/hard-requirement.service.js';
export * from './services/core-competency.service.js';
export * from './services/keyword-booster.service.js';
export * from './services/hr-impression.service.js';
export * from './services/risk-eliminator.service.js';
export * from './services/export.service.js';
export * from './config/optimize-config.js';
export * from './utils/text-normalize.js';
export * from './utils/keyword-utils.js';
export * from './utils/diff-utils.js';
