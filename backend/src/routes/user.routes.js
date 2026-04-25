import express from 'express';
import { getUserSettings, updateUserSettings, disconnectGoogle } from '../controllers/user.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

router.use(protect); // Ensure user is logged in

router.get('/settings', getUserSettings);
router.put('/settings', updateUserSettings);
router.post('/google-disconnect', disconnectGoogle);

export default router;
