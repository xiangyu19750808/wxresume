import express from 'express';
import { handleOptimize } from '../controllers/optimize.controller.js';

const router = express.Router();

// 完整路径将会是：POST /api/analysis/optimize
router.post('/optimize', handleOptimize);

export default router;