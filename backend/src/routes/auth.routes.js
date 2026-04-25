import express from 'express';
import { registerUser, loginUser } from '../controllers/auth.controller.js';
import { getGoogleAuthUrl, googleCallback } from '../controllers/google.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

router.post('/register', registerUser);
router.post('/login', loginUser);

router.get('/me', protect, (req, res) => res.json(req.user));
router.post('/logout', (req, res) => {
    res.clearCookie('token');
    res.json({ message: 'Logged out successfully' });
});

router.get('/google/url', getGoogleAuthUrl);
router.get('/google/callback', googleCallback);

export default router;
