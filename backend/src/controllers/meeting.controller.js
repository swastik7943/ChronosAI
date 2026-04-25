import Meeting from '../models/Meeting.model.js';
import User from '../models/User.model.js';
import { sendEmail } from '../utils/sendEmail.js';
import { syncWithGoogleCalendar } from '../utils/googleSync.js';
import { validateSpecificSlot } from '../utils/availability.js';

export const scheduleMeeting = async (req, res) => {
  try {
    const { title, date, startTime, duration, participants } = req.body;
    const populatedUser = await User.findById(req.user._id);

    // Validate the requested slot before proceeding
    const conflictCheck = await validateSpecificSlot(
      participants || [], date, startTime, duration || 30, populatedUser
    );

    if (conflictCheck.length > 0) {
      return res.status(409).json({
        message: 'Slot unavailable',
        conflicts: conflictCheck
      });
    }

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

    // Sync to Google Calendar
    if (populatedUser.googleId) {
      const syncRes = await syncWithGoogleCalendar(populatedUser, meeting, 'insert');
      if (syncRes.success && syncRes.eventId) {
        meeting.googleEventId = syncRes.eventId;
        await meeting.save();
      }
    }

    // Dispatch Emails via NodeMailer
    if (process.env.SMTP_USER && meeting.participants?.length > 0) {
      const emailAddresses = meeting.participants.filter(p => p.includes('@'));
      if (emailAddresses.length > 0) {
        const userDocs = await User.find({ email: { $in: emailAddresses } });
        const formattedParticipantsStr = emailAddresses.map(email => {
          const u = userDocs.find(x => x.email === email);
          return u ? `${u.name} (${u.email})` : email;
        }).join(', ');
        
        const orgStr = `${populatedUser.name} (${populatedUser.email})`;

        await sendEmail({
          to: emailAddresses.join(', '),
          subject: `Meeting Invite: ${meeting.title}`,
          html: `<div style="font-family: Arial, sans-serif; max-width: 500px; margin: auto;">
                   <h2 style="color: #4F46E5;">📅 ${meeting.title}</h2>
                   <table style="border-collapse: collapse; width: 100%;">
                     <tr><td style="padding: 8px; font-weight: bold;">👑 Organizer</td><td style="padding: 8px;">${orgStr}</td></tr>
                     <tr><td style="padding: 8px; font-weight: bold;">📆 Date</td><td style="padding: 8px;">${meeting.date}</td></tr>
                     <tr><td style="padding: 8px; font-weight: bold;">🕐 Time</td><td style="padding: 8px;">${meeting.startTime}</td></tr>
                     <tr><td style="padding: 8px; font-weight: bold;">⏱ Duration</td><td style="padding: 8px;">${meeting.duration} minutes</td></tr>
                     <tr><td style="padding: 8px; font-weight: bold;">👥 Participants</td><td style="padding: 8px;">${formattedParticipantsStr}</td></tr>
                   </table>
                   <p style="margin-top: 16px;"><a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/meet/${meeting.jitsiRoom}" style="background: #4F46E5; color: white; padding: 10px 24px; border-radius: 8px; text-decoration: none;">Join Video Call</a></p>
                   <p style="color: #888; font-size: 12px; margin-top: 20px;">Sent by ChronosAI</p>
                 </div>`
        });
      }
    }

    res.status(201).json(meeting);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const mapParticipantsToNames = async (meetingsList) => {
  const allEmails = [...new Set(meetingsList.flatMap(m => m.participants || []).filter(p => typeof p === 'string' && p.includes('@')))];
  if (allEmails.length === 0) return meetingsList;
  
  const userDocs = await User.find({ email: { $in: allEmails } }).lean();
  
  return meetingsList.map(m => {
    if (!m.participants) return m;
    const mappedParticipants = m.participants.map(email => {
      const isEmail = typeof email === 'string' && email.includes('@');
      if (!isEmail) return email;
      const u = userDocs.find(x => x.email === email);
      return u ? `${u.name} (${u.email})` : email;
    });
    return { ...m, participants: mappedParticipants };
  });
};

export const getMeetingsByDate = async (req, res) => {
  try {
    const { date } = req.params;
    const meetings = await Meeting.find({ 
      date, 
      $or: [
        { organizer: req.user._id },
        { participants: req.user.email }
      ]
    }).populate('organizer', 'name email').lean();
    
    const enrichedMeetings = meetings.map(m => ({
      ...m,
      isOrganizer: m.organizer._id.toString() === req.user._id.toString(),
      organizerDetails: m.organizer ? `${m.organizer.name} (${m.organizer.email})` : 'Unknown',
      organizer: m.organizer._id
    }));
    
    const visuallyEnriched = await mapParticipantsToNames(enrichedMeetings);
    res.json(visuallyEnriched);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getAllMeetings = async (req, res) => {
  try {
    const meetings = await Meeting.find({ 
      status: { $in: ['scheduled', 'canceled'] },
      $or: [
        { organizer: req.user._id },
        { participants: req.user.email }
      ]
    }).populate('organizer', 'name email').lean();
    
    const enrichedMeetings = meetings.map(m => ({
      ...m,
      isOrganizer: m.organizer._id.toString() === req.user._id.toString(),
      organizerDetails: m.organizer ? `${m.organizer.name} (${m.organizer.email})` : 'Unknown',
      organizer: m.organizer._id
    }));
    
    const visuallyEnriched = await mapParticipantsToNames(enrichedMeetings);
    res.json(visuallyEnriched);
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

    const targetDate = date || meeting.date;
    const targetTime = startTime || meeting.startTime;
    const targetDuration = duration || meeting.duration;
    const user = await User.findById(req.user._id);

    const conflictCheck = await validateSpecificSlot(
      meeting.participants, targetDate, targetTime, targetDuration, user
    );

    if (conflictCheck.length > 0) {
      return res.status(409).json({
        message: 'Slot unavailable',
        conflicts: conflictCheck
      });
    }

    if (date) meeting.date = date;
    if (startTime) meeting.startTime = startTime;
    if (duration) meeting.duration = duration;
    meeting.isRescheduled = true;

    await meeting.save();
    if (user && user.googleId && meeting.googleEventId) {
      await syncWithGoogleCalendar(user, meeting, 'update');
    }

    if (process.env.SMTP_USER && meeting.participants?.length > 0) {
      const emailAddresses = meeting.participants.filter(p => p.includes('@'));
      if (emailAddresses.length > 0) {
        const userDocs = await User.find({ email: { $in: emailAddresses } });
        const formattedParticipantsStr = emailAddresses.map(email => {
          const u = userDocs.find(x => x.email === email);
          return u ? `${u.name} (${u.email})` : email;
        }).join(', ');
        
        const orgStr = user ? `${user.name} (${user.email})` : 'Unknown';
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

        await sendEmail({
          to: emailAddresses.join(', '),
          subject: `🔄 Rescheduled: ${meeting.title}`,
          html: `<div style="font-family: Arial, sans-serif; max-width: 500px; margin: auto;">
                   <h2 style="color: #F59E0B;">🔄 Meeting Rescheduled</h2>
                   <p><b>${meeting.title}</b> has been moved to:</p>
                   <table style="border-collapse: collapse; width: 100%;">
                     <tr><td style="padding: 8px; font-weight: bold;">👑 Organizer</td><td style="padding: 8px;">${orgStr}</td></tr>
                     <tr><td style="padding: 8px; font-weight: bold;">📆 New Date</td><td style="padding: 8px;">${meeting.date}</td></tr>
                     <tr><td style="padding: 8px; font-weight: bold;">🕐 Time</td><td style="padding: 8px;">${meeting.startTime}</td></tr>
                     <tr><td style="padding: 8px; font-weight: bold;">👥 Participants</td><td style="padding: 8px;">${formattedParticipantsStr}</td></tr>
                   </table>
                   <p style="margin-top: 16px;"><a href="${frontendUrl}/meet/${meeting.jitsiRoom}" style="background: #4F46E5; color: white; padding: 10px 24px; border-radius: 8px; text-decoration: none;">Join Video Call</a></p>
                   <p style="color: #888; font-size: 12px; margin-top: 20px;">Sent by ChronosAI</p>
                 </div>`
        });
      }
    }

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
         const userDocs = await User.find({ email: { $in: emailAddresses } });
         const formattedParticipantsStr = emailAddresses.map(email => {
           const u = userDocs.find(x => x.email === email);
           return u ? `${u.name} (${u.email})` : email;
         }).join(', ');
         
         const organizerParams = await User.findById(req.user._id);
         const orgStr = organizerParams ? `${organizerParams.name} (${organizerParams.email})` : 'Unknown';

         await sendEmail({
           to: emailAddresses.join(', '),
           subject: `CANCELED: ${meeting.title}`,
           html: `<div style="font-family: Arial, sans-serif; max-width: 500px; margin: auto;">
                    <h2 style="color: #EF4444;">❌ Meeting Canceled</h2>
                    <p><b>${meeting.title}</b> has been canceled.</p>
                    <table style="border-collapse: collapse; width: 100%;">
                      <tr><td style="padding: 8px; font-weight: bold;">👑 Organizer</td><td style="padding: 8px;">${orgStr}</td></tr>
                      <tr><td style="padding: 8px; font-weight: bold;">📆 Date</td><td style="padding: 8px;">${meeting.date}</td></tr>
                      <tr><td style="padding: 8px; font-weight: bold;">🕐 Time</td><td style="padding: 8px;">${meeting.startTime}</td></tr>
                      <tr><td style="padding: 8px; font-weight: bold;">👥 Participants</td><td style="padding: 8px;">${formattedParticipantsStr}</td></tr>
                    </table>
                    <p style="color: #888; font-size: 12px; margin-top: 20px;">Sent by ChronosAI</p>
                  </div>`
         });
      }
    }
    const user = await User.findById(req.user._id);
    if (user && user.googleId && meeting.googleEventId) {
      await syncWithGoogleCalendar(user, meeting, 'delete');
    }
    
    res.json({ message: 'Meeting canceled successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
