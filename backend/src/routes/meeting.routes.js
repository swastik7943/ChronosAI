import express from 'express';
import { scheduleMeeting, getMeetingsByDate, getAllMeetings, rescheduleMeeting, cancelMeeting } from '../controllers/meeting.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

router.use(protect); // All meeting routes are protected

router.post('/schedule', scheduleMeeting);
router.get('/all', getAllMeetings);
router.get('/date/:date', getMeetingsByDate);
router.put('/reschedule/:id', rescheduleMeeting);
router.delete('/cancel/:id', cancelMeeting);

export default router;
