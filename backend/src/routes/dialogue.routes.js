import express from 'express';
import { processDialogue } from '../controllers/dialogue.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

router.use(protect);

router.post('/process', processDialogue);

export default router;
