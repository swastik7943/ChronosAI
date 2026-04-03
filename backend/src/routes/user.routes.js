import express from 'express';
import { getUserSettings, updateUserSettings } from '../controllers/user.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

router.use(protect); // Ensure user is logged in

router.get('/settings', getUserSettings);
router.put('/settings', updateUserSettings);

export default router;
