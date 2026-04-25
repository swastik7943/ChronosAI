import express from 'express';
import { protect } from '../middleware/auth.middleware.js';
import { createApiKey, getApiKeys, revokeApiKey, deleteApiKey } from '../controllers/apikey.controller.js';

const router = express.Router();
router.use(protect);

router.post('/', createApiKey);
router.get('/', getApiKeys);
router.put('/:id/revoke', revokeApiKey);
router.delete('/:id', deleteApiKey);

export default router;
