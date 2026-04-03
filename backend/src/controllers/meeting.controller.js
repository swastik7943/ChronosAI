import Meeting from '../models/Meeting.model.js';
import User from '../models/User.model.js';
import { sendEmail } from '../utils/sendEmail.js';
import { syncWithGoogleCalendar } from '../utils/googleSync.js';

export const scheduleMeeting = async (req, res) => {
  try {
    const { title, date, startTime, duration, participants } = req.body;

    const meeting = await Meeting.create({
      title: title || 'New Meeting',
      date,
      startTime,
      duration: duration || 30, // default 30 mins
      participants: participants || [],
      organizer: req.user._id
    });
    
    // Assign unique Jitsi Room Identifier
    meeting.jitsiRoom = `chronosai-${meeting._id}`;
    await meeting.save();

    const populatedUser = await User.findById(req.user._id);

    // Sync to Google Calendar
    if (populatedUser.googleId) {
      await syncWithGoogleCalendar(populatedUser, meeting, 'insert');
    }

    // Dispatch Emails via NodeMailer
    if (process.env.SMTP_USER && meeting.participants?.length > 0) {
      const emailAddresses = meeting.participants.filter(p => p.includes('@'));
      if (emailAddresses.length > 0) {
         await sendEmail({
           to: emailAddresses.join(', '),
           subject: `Meeting Invite: ${meeting.title}`,
           html: `<p>You have been invited to a meeting on <b>${meeting.date}</b> at <b>${meeting.startTime}</b>.</p>
                  <p>Join Video call here: <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/meet/${meeting.jitsiRoom}">Join Meeting</a></p>`
         });
      }
    }

    res.status(201).json(meeting);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getMeetingsByDate = async (req, res) => {
  try {
    const { date } = req.params;
    const meetings = await Meeting.find({ 
      date, 
      organizer: req.user._id 
    });
    res.json(meetings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getAllMeetings = async (req, res) => {
  try {
    const meetings = await Meeting.find({ organizer: req.user._id, status: 'scheduled' });
    res.json(meetings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const rescheduleMeeting = async (req, res) => {
  try {
    const { date, startTime, duration } = req.body;
    const meeting = await Meeting.findById(req.params.id);

    if (!meeting) return res.status(404).json({ message: 'Meeting not found' });
    if (meeting.organizer.toString() !== req.user._id.toString()) return res.status(401).json({ message: 'Not authorized' });

    if (date) meeting.date = date;
    if (startTime) meeting.startTime = startTime;
    if (duration) meeting.duration = duration;

    await meeting.save();
    res.json(meeting);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const cancelMeeting = async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id);

    if (!meeting) return res.status(404).json({ message: 'Meeting not found' });
    if (meeting.organizer.toString() !== req.user._id.toString()) return res.status(401).json({ message: 'Not authorized' });

    meeting.status = 'canceled';
    await meeting.save();
    
    // Dispatch Emails via NodeMailer
    if (process.env.SMTP_USER && meeting.participants?.length > 0) {
      const emailAddresses = meeting.participants.filter(p => p.includes('@'));
      if (emailAddresses.length > 0) {
         await sendEmail({
           to: emailAddresses.join(', '),
           subject: `CANCELED: ${meeting.title}`,
           html: `<p>The meeting scheduled on <b>${meeting.date}</b> at <b>${meeting.startTime}</b> has been canceled.</p>`
         });
      }
    }
    
    res.json({ message: 'Meeting canceled successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
