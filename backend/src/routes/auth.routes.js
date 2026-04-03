import express from 'express';
import { registerUser, loginUser } from '../controllers/auth.controller.js';
import { getGoogleAuthUrl, googleCallback } from '../controllers/google.controller.js';

const router = express.Router();

router.post('/register', registerUser);
router.post('/login', loginUser);

router.get('/google/url', getGoogleAuthUrl);
router.get('/google/callback', googleCallback);

export default router;
