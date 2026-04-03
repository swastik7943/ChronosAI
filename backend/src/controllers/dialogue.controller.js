import axios from 'axios';
import ConversationSession from '../models/ConversationSession.model.js';
import Meeting from '../models/Meeting.model.js';
import User from '../models/User.model.js';
import moment from 'moment-timezone';
import { sendEmail } from '../utils/sendEmail.js';
import { syncWithGoogleCalendar } from '../utils/googleSync.js';

export const processDialogue = async (req, res) => {
  try {
    const { message, sessionId } = req.body;
    let session;
    
    if (sessionId) {
      session = await ConversationSession.findById(sessionId);
    }

    if (!session || session.status !== 'active') {
      session = await ConversationSession.create({
        userId: req.user._id,
        status: 'active'
      });
    }

    const user = await User.findById(req.user._id);

    // Call AI Service
    const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';
    const aiResponse = await axios.post(`${aiServiceUrl}/parse`, { message });
    
    const { intent, date, time, timezone, duration, participants } = aiResponse.data;

    // Persist Intent
    if (intent && session.intent !== 'reschedule' && session.intent !== 'cancel' && intent !== 'unknown') {
        session.intent = intent;
    }

    // --- State Machine Updates ---
    if (session.intent === 'reschedule' || session.intent === 'cancel') {
        if (!session.meetingId && session.intent === 'reschedule') {
           // Phase 1 of Reschedule: finding the old meeting
           if (date) session.targetDate = date;
           if (participants && participants.length > 0) session.targetParticipant = participants[0];
        } else if (session.intent === 'cancel') {
           if (date) session.targetDate = date;
           if (participants && participants.length > 0) session.targetParticipant = participants[0];
        } else {
           // Phase 2 of Reschedule: getting new info
           if (date) session.date = date;
           if (time) session.time = time;
           if (timezone) session.timezone = timezone;
           if (duration) session.duration = duration;
        }
    } else {
        // Schedule flow
        if (date) session.date = date;
        if (time) session.time = time;
        if (timezone) session.timezone = timezone;
        if (duration) session.duration = duration;
        
        // --- Disambiguation Phase ---
        if (session.pendingResolutionName) {
           const chosen = session.ambiguousCandidates.find(c => message.toLowerCase().includes(c.toLowerCase()) || message.toLowerCase().includes(c.split('@')[0].toLowerCase()));
           if (chosen) {
              const safeList = session.resolvedParticipants || [];
              session.resolvedParticipants = [...new Set([...safeList, chosen])];
              session.pendingResolutionName = null;
              session.ambiguousCandidates = [];
           } else {
              return res.json({ reply: `I didn't catch that. Did you mean ${session.ambiguousCandidates.join(' or ')}?`, sessionId: session._id });
           }
        } else if (participants && participants.length > 0) {
          const safeList = session.resolvedParticipants || [];
          for (const part of participants) {
             const users = await User.find({ name: { $regex: new RegExp(part, 'i') } });
             if (users.length > 1) {
                session.pendingResolutionName = part;
                session.ambiguousCandidates = users.map(u => u.email);
                await session.save();
                return res.json({ reply: `I found multiple users named ${part}. Did you mean ${session.ambiguousCandidates.join(', or ')}?`, sessionId: session._id });
             } else if (users.length === 1) {
                safeList.push(users[0].email);
             } else {
                safeList.push(part);
             }
          }
          session.resolvedParticipants = [...new Set(safeList)];
        }
    }

    await session.save();

    // --- Sequential Logic ---

    if (session.intent === 'schedule') {
      if (!session.resolvedParticipants || session.resolvedParticipants.length === 0) {
         return res.json({ reply: 'Who would you like to schedule the meeting with?', sessionId: session._id });
      }
      if (!session.date) {
         return res.json({ reply: 'What date works best for this meeting?', sessionId: session._id });
      }
      if (!session.time) {
         return res.json({ reply: 'What time should we start?', sessionId: session._id });
      }
      if (!session.duration) {
         return res.json({ reply: 'How long will the meeting be? (e.g. 30 minutes, 1 hour)', sessionId: session._id });
      }
      
      // --- Availability & Buffer Logic ---
      const tz = session.timezone || user.timezone || 'UTC';
      const buffer = user.bufferTime || 0;
      
      // We parse the requested strings securely in Moment
      const reqStart = moment.tz(`${session.date}T${session.time}`, tz);
      const reqEnd = reqStart.clone().add(session.duration, 'minutes');

      // Load DB meetings for this specific date
      const todaysMeetings = await Meeting.find({ organizer: user._id, date: session.date, status: 'scheduled' });
      let conflictDetected = false;
      let suggestedFreeTime = null;

      for (let m of todaysMeetings) {
          const mStart = moment.tz(`${m.date}T${m.startTime}`, tz).subtract(buffer, 'minutes');
          const mEnd = moment.tz(`${m.date}T${m.startTime}`, tz).add(m.duration, 'minutes').add(buffer, 'minutes');

          if (reqStart.isBefore(mEnd) && reqEnd.isAfter(mStart)) {
             conflictDetected = true;
             suggestedFreeTime = mEnd.format('HH:mm'); // The moment it is free from buffer
             break;
          }
      }

      if (conflictDetected) {
         session.time = null; // Clear so they reply with a new time
         await session.save();
         return res.json({ reply: `It looks like you are double-booked or crossing a buffer gap. Would ${suggestedFreeTime} work better instead?`, sessionId: session._id });
      }

      const meeting = await Meeting.create({
        title: `Meeting with ${session.resolvedParticipants.join(', ')}`.trim(),
        date: session.date,
        startTime: session.time, // Local user time logic
        duration: session.duration,
        participants: session.resolvedParticipants,
        organizer: req.user._id
      });
      
      meeting.jitsiRoom = `chronosai-${meeting._id}`;
      await meeting.save();
      
      // -- Execute Integrations --
      if (user.googleId) {
         await syncWithGoogleCalendar(user, meeting, 'insert');
      }
      
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

      session.status = 'completed';
      session.meetingId = meeting._id;
      await session.save();

      return res.json({
        reply: `All set! I've scheduled your ${session.duration} minute meeting with ${session.resolvedParticipants.join(', ')} for ${session.date} at ${session.time} ${tz}.`,
        sessionId: null,
        meeting
      });

    } else if (session.intent === 'cancel') {
      if (!session.targetDate) {
         return res.json({ reply: 'What is the date of the meeting you want to cancel?', sessionId: session._id });
      }
      if (!session.targetParticipant) {
         return res.json({ reply: 'Who is the meeting with?', sessionId: session._id });
      }

      const query = { 
        organizer: req.user._id, 
        status: 'scheduled',
        date: session.targetDate,
        participants: { $regex: new RegExp(session.targetParticipant, 'i') }
      };

      const meetingToCancel = await Meeting.findOne(query);
      
      if (meetingToCancel) {
        meetingToCancel.status = 'canceled';
        await meetingToCancel.save();
        session.status = 'completed';
        await session.save();
        
        // Dispatch Emails
        if (process.env.SMTP_USER && meetingToCancel.participants?.length > 0) {
          const emailAddresses = meetingToCancel.participants.filter(p => p.includes('@'));
          if (emailAddresses.length > 0) {
             await sendEmail({
               to: emailAddresses.join(', '),
               subject: `CANCELED: ${meetingToCancel.title}`,
               html: `<p>The meeting scheduled on <b>${meetingToCancel.date}</b> at <b>${meetingToCancel.startTime}</b> has been canceled.</p>`
             });
          }
        }
        
        return res.json({
          reply: `Your meeting with ${meetingToCancel.participants.join(', ')} on ${meetingToCancel.date} has been canceled.`,
          sessionId: null,
          meeting: meetingToCancel
        });
      } else {
        session.status = 'completed';
        await session.save();
        return res.json({
          reply: `I couldn't find any scheduled meeting with ${session.targetParticipant} on ${session.targetDate}.`,
          sessionId: null
        });
      }

    } else if (session.intent === 'reschedule') {
      if (!session.meetingId) {
         if (!session.targetDate) return res.json({ reply: 'What is the original date of the meeting you want to reschedule?', sessionId: session._id });
         if (!session.targetParticipant) return res.json({ reply: 'Who is the original meeting with?', sessionId: session._id });

         const query = { 
           organizer: req.user._id, 
           status: 'scheduled',
           date: session.targetDate,
           participants: { $regex: new RegExp(session.targetParticipant, 'i') }
         };

         const oldMeeting = await Meeting.findOne(query);
         if (oldMeeting) {
            session.meetingId = oldMeeting._id;
            session.date = null;
            session.time = null;
            await session.save();
            return res.json({ reply: `Got it! What is the proposed new date for this reschedule?`, sessionId: session._id });
         } else {
            session.status = 'completed';
            await session.save();
            return res.json({ reply: `I couldn't find a scheduled meeting with ${session.targetParticipant} on ${session.targetDate} to reschedule.`, sessionId: null });
         }
      } else {
         if (!session.date) return res.json({ reply: 'What is the new date you want to reschedule to?', sessionId: session._id });
         if (!session.time) return res.json({ reply: 'What is the new time?', sessionId: session._id });

         // Reschedule Buffer Engine check could also be placed here, for brevity we push straight for this MVP
         const meetingToReschedule = await Meeting.findById(session.meetingId);
         if (meetingToReschedule) {
            meetingToReschedule.date = session.date;
            meetingToReschedule.startTime = session.time;
            if (session.duration) meetingToReschedule.duration = session.duration;
            
            await meetingToReschedule.save();
            session.status = 'completed';
            await session.save();

            // Dispatch Emails
            if (process.env.SMTP_USER && meetingToReschedule.participants?.length > 0) {
              const emailAddresses = meetingToReschedule.participants.filter(p => p.includes('@'));
              if (emailAddresses.length > 0) {
                 await sendEmail({
                   to: emailAddresses.join(', '),
                   subject: `RESCHEDULED: ${meetingToReschedule.title}`,
                   html: `<p>The meeting has been rescheduled to <b>${meetingToReschedule.date}</b> at <b>${meetingToReschedule.startTime}</b>.</p>
                          <p>Join Video call here: <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/meet/${meetingToReschedule.jitsiRoom}">Join Meeting</a></p>`
                 });
              }
            }

            return res.json({
               reply: `Successfully rescheduled the meeting to ${session.date} at ${session.time}.`,
               sessionId: null,
               meeting: meetingToReschedule
            });
         }
      }
    }

    return res.json({
      reply: "I'm not sure what you mean. Do you want to schedule, reschedule, or cancel a meeting?",
      sessionId: session._id
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message, reply: "Oops, something went wrong while processing your request." });
  }
};
