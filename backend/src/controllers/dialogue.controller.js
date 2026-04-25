import axios from 'axios';
import ConversationSession from '../models/ConversationSession.model.js';
import Meeting from '../models/Meeting.model.js';
import User from '../models/User.model.js';
import Team from '../models/Team.model.js';
import moment from 'moment-timezone';
import { sendEmail } from '../utils/sendEmail.js';
import { syncWithGoogleCalendar } from '../utils/googleSync.js';
import {
  calculateMultiUserAvailability,
  getAvailableSlotsForUser,
  slotToLocalTime,
  formatTime12 as availFormatTime12,
  resolveTimezone as availResolveTimezone,
  findAlternativeSlots,
  validateSpecificSlot
} from '../utils/availability.js';

// ── Timezone Mapping (abbreviations to IANA) ─────────────────────
const TZ_MAP = {
  'UTC': 'UTC', 'GMT': 'Europe/London',
  'EST': 'America/New_York', 'CST': 'America/Chicago',
  'MST': 'America/Denver', 'PST': 'America/Los_Angeles',
  'IST': 'Asia/Kolkata', 'CET': 'Europe/Paris',
  'JST': 'Asia/Tokyo', 'AEST': 'Australia/Sydney',
  'Asia/Kolkata': 'Asia/Kolkata', 'America/New_York': 'America/New_York',
  'America/Chicago': 'America/Chicago', 'America/Denver': 'America/Denver',
  'America/Los_Angeles': 'America/Los_Angeles', 'Europe/London': 'Europe/London',
  'Europe/Paris': 'Europe/Paris', 'Asia/Tokyo': 'Asia/Tokyo',
  'Australia/Sydney': 'Australia/Sydney'
};

function resolveTimezone(tz) {
  return TZ_MAP[tz] || tz || 'UTC';
}

// ── Availability Engine (delegated to utils/availability.js) ─────
// Single-user availability is handled by getAvailableSlotsForUser.
// Multi-user availability is handled by calculateMultiUserAvailability.
function getAvailableSlots(meetings, dateStr, tz, buffer, startHour, startMin, endHour, endMin, breakStartStr, breakEndStr) {
  return getAvailableSlotsForUser(meetings, dateStr, tz, buffer, startHour, startMin, endHour, endMin, breakStartStr, breakEndStr);
}

function formatTime12(time24) {
  const [h, m] = time24.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return m === 0 ? `${hour} ${ampm}` : `${hour}:${String(m).padStart(2,'0')} ${ampm}`;
}

// Convert user-local time to UTC and back
function toUTC(dateStr, timeStr, userTz) {
  const ianaZone = resolveTimezone(userTz);
  return moment.tz(`${dateStr}T${timeStr}`, ianaZone).utc();
}

function fromUTC(utcMoment, targetTz) {
  const ianaZone = resolveTimezone(targetTz);
  return utcMoment.clone().tz(ianaZone);
}

function formatTimeInZone(dateStr, timeStr, fromTz, toTz) {
  const ianaFrom = resolveTimezone(fromTz);
  const ianaTo = resolveTimezone(toTz);
  const m = moment.tz(`${dateStr}T${timeStr}`, ianaFrom).tz(ianaTo);
  return formatTime12(m.format('HH:mm'));
}

function timeRangeToHour(range) {
  if (range === 'morning') return { start: 9, end: 12 };
  if (range === 'afternoon') return { start: 12, end: 17 };
  if (range === 'evening') return { start: 17, end: 21 };
  return { start: 9, end: 18 };
}

function generateTitle(participants, titleHint) {
  if (titleHint) {
    const words = titleHint.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    return `${words} Meeting`;
  }
  if (participants.length === 0) return 'New Meeting';
  const names = participants.map(p => p.includes('@') ? p.split('@')[0] : p);
  if (names.length === 1) return `Meeting with ${names[0]}`;
  if (names.length <= 3) return `Meeting with ${names.join(', ')}`;
  return `Team Meeting (${names.length} participants)`;
}

function parseTimeField(timeStr) {
  if (!timeStr) return { hour: 9, min: 0 };
  const [h, m] = timeStr.split(':').map(Number);
  return { hour: h || 0, min: m || 0 };
}

// ── Build email HTML with timezone info ──────────────────────────
function buildInviteEmail(meeting, organizerTz, formattedParticipantsStr, organizerStr) {
  const ianaZone = resolveTimezone(organizerTz);
  const localStart = moment.tz(`${meeting.date}T${meeting.startTime}`, ianaZone);
  const utcStart = localStart.clone().utc();
  const localTimeStr = formatTime12(localStart.format('HH:mm'));
  const utcTimeStr = formatTime12(utcStart.format('HH:mm'));
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

  return `
    <div style="font-family: Arial, sans-serif; max-width: 500px; margin: auto;">
      <h2 style="color: #4F46E5;">📅 ${meeting.title}</h2>
      <table style="border-collapse: collapse; width: 100%;">
        <tr><td style="padding: 8px; font-weight: bold;">👑 Organizer</td><td style="padding: 8px;">${organizerStr || 'Unknown'}</td></tr>
        <tr><td style="padding: 8px; font-weight: bold;">📆 Date</td><td style="padding: 8px;">${meeting.date}</td></tr>
        <tr><td style="padding: 8px; font-weight: bold;">🕐 Time (${organizerTz})</td><td style="padding: 8px;">${localTimeStr}</td></tr>
        <tr><td style="padding: 8px; font-weight: bold;">🌐 Time (UTC)</td><td style="padding: 8px;">${utcTimeStr}</td></tr>
        <tr><td style="padding: 8px; font-weight: bold;">⏱ Duration</td><td style="padding: 8px;">${meeting.duration} minutes</td></tr>
        <tr><td style="padding: 8px; font-weight: bold;">👥 Participants</td><td style="padding: 8px;">${formattedParticipantsStr || 'None'}</td></tr>
      </table>
      <p style="margin-top: 16px;"><a href="${frontendUrl}/meet/${meeting.jitsiRoom}" style="background: #4F46E5; color: white; padding: 10px 24px; border-radius: 8px; text-decoration: none;">Join Video Call</a></p>
      <p style="color: #888; font-size: 12px; margin-top: 20px;">Sent by ChronosAI • Times shown in organizer's timezone and UTC</p>
    </div>`;
}

function buildCancelEmail(meeting, organizerTz, formattedParticipantsStr, organizerStr) {
  const ianaZone = resolveTimezone(organizerTz);
  const localStart = moment.tz(`${meeting.date}T${meeting.startTime}`, ianaZone);
  const utcStart = localStart.clone().utc();
  return `
    <div style="font-family: Arial, sans-serif; max-width: 500px; margin: auto;">
      <h2 style="color: #EF4444;">❌ Meeting Canceled</h2>
      <p><b>${meeting.title}</b> on <b>${meeting.date}</b> at <b>${formatTime12(localStart.format('HH:mm'))} (${organizerTz})</b> / <b>${formatTime12(utcStart.format('HH:mm'))} (UTC)</b> has been canceled.</p>
      <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
        <tr><td style="padding: 8px; font-weight: bold;">👑 Organizer</td><td style="padding: 8px;">${organizerStr || 'Unknown'}</td></tr>
        <tr><td style="padding: 8px; font-weight: bold;">👥 Participants</td><td style="padding: 8px;">${formattedParticipantsStr || 'None'}</td></tr>
      </table>
      <p style="color: #888; font-size: 12px; margin-top: 20px;">Sent by ChronosAI</p>
    </div>`;
}

function buildRescheduleEmail(meeting, organizerTz, formattedParticipantsStr, organizerStr) {
  const ianaZone = resolveTimezone(organizerTz);
  const localStart = moment.tz(`${meeting.date}T${meeting.startTime}`, ianaZone);
  const utcStart = localStart.clone().utc();
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  return `
    <div style="font-family: Arial, sans-serif; max-width: 500px; margin: auto;">
      <h2 style="color: #F59E0B;">🔄 Meeting Rescheduled</h2>
      <p><b>${meeting.title}</b> has been moved to:</p>
      <table style="border-collapse: collapse; width: 100%;">
        <tr><td style="padding: 8px; font-weight: bold;">👑 Organizer</td><td style="padding: 8px;">${organizerStr || 'Unknown'}</td></tr>
        <tr><td style="padding: 8px; font-weight: bold;">📆 New Date</td><td style="padding: 8px;">${meeting.date}</td></tr>
        <tr><td style="padding: 8px; font-weight: bold;">🕐 Time (${organizerTz})</td><td style="padding: 8px;">${formatTime12(localStart.format('HH:mm'))}</td></tr>
        <tr><td style="padding: 8px; font-weight: bold;">🌐 Time (UTC)</td><td style="padding: 8px;">${formatTime12(utcStart.format('HH:mm'))}</td></tr>
        <tr><td style="padding: 8px; font-weight: bold;">👥 Participants</td><td style="padding: 8px;">${formattedParticipantsStr || 'None'}</td></tr>
      </table>
      <p style="margin-top: 16px;"><a href="${frontendUrl}/meet/${meeting.jitsiRoom}" style="background: #4F46E5; color: white; padding: 10px 24px; border-radius: 8px; text-decoration: none;">Join Video Call</a></p>
      <p style="color: #888; font-size: 12px; margin-top: 20px;">Sent by ChronosAI</p>
    </div>`;
}

function formatSessionHistory(session) {
  if (!session.messages) return [];
  // Send the last 20 messages to keep context window manageable
  return session.messages.slice(-20).map(m => ({
    role: m.role,
    content: m.content
  }));
}

async function sendResponse(res, session, payload) {
  if (session && payload.reply) {
    session.messages.push({ role: 'model', content: payload.reply });
    await session.save();
  }
  return res.json(payload);
}

// ── Main Dialogue Handler ────────────────────────────────────────
export const processDialogue = async (req, res) => {
  try {
    const { message, sessionId } = req.body;
    const lowerMsg = message.toLowerCase().trim();
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
    const tz = user.timezone || 'UTC';
    const buffer = user.bufferTime || 0;
    const whStart = parseTimeField(user.workingHoursStart || '09:00');
    const whEnd = parseTimeField(user.workingHoursEnd || '18:00');
    const breakStartStr = user.breakStart || '13:00';
    const breakEndStr = user.breakEnd || '14:00';

    // Compute the user's current local datetime as an ISO string so the AI
    // service can resolve relative references ("Tuesday", "10 AM") correctly.
    const ianaUserTz = resolveTimezone(tz);
    const userNow = moment().tz(ianaUserTz).format(); // e.g. "2026-04-21T08:00:00+05:30"

    // PERSIST USER MESSAGE TO HISTORY
    session.messages.push({ role: 'user', content: message });
    const history = formatSessionHistory(session);

    // ── Handle confirmation responses ──
    if (session.awaitingConfirmation) {
      if (['yes', 'yeah', 'sure', 'ok', 'confirm', 'do it', 'go ahead', 'yep', 'y'].includes(lowerMsg)) {
        session.awaitingConfirmation = false;
        if (session.suggestedSlots?.length > 0 && !session.time) {
          session.time = session.suggestedSlots[0];
        }
        await session.save();
      } else if (['no', 'nah', 'nope', 'n', 'cancel', 'nevermind', 'never mind'].includes(lowerMsg)) {
        session.awaitingConfirmation = false;
        session.suggestedSlots = [];
        session.time = null;
        await session.save();
        return sendResponse(res, session, {
          reply: "No worries! 😊 What time would you prefer instead?",
          sessionId: session._id
        });
      } else {
        const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';
        const aiResp = await axios.post(`${aiServiceUrl}/parse`, { message, current_time: userNow, history });
        if (aiResp.data.time) {
          session.time = aiResp.data.time;
          session.awaitingConfirmation = false;
          session.suggestedSlots = [];
          await session.save();
        } else {
          return sendResponse(res, session, {
            reply: "I didn't quite catch that. Could you say **yes** to confirm, or give me a different time? 🕐",
            sessionId: session._id
          });
        }
      }
    }

    if (session.awaitingParticipants) {
      if (['cancel', 'nevermind', 'never mind', 'stop', 'quit'].includes(lowerMsg)) {
        session.status = 'canceled';
        await session.save();
        return sendResponse(res, session, {
          reply: "Okay, I've canceled the meeting setup.",
          sessionId: null,
          suggestedActions: ['Schedule a Meeting', 'View Calendar']
        });
      }
      const rawParts = message.replace(/ and /gi, ',').split(',').map(p => p.trim()).filter(Boolean);
      session.pendingParticipants = [...new Set([...(session.pendingParticipants || []), ...rawParts])];
      session.awaitingParticipants = false;
      await session.save();
    }

    if (session.awaitingTitle) {
      if (['cancel', 'nevermind', 'never mind', 'stop', 'quit'].includes(lowerMsg)) {
        session.status = 'canceled';
        await session.save();
        return sendResponse(res, session, {
          reply: "Okay, I've canceled the meeting setup.",
          sessionId: null,
          suggestedActions: ['Schedule a Meeting', 'View Calendar']
        });
      }
      session.title = message.trim();
      session.awaitingTitle = false;
      await session.save();
    }

    // ── Reschedule/Navigation Intercepts ──
    if (['choose another day', 'another day', 'different day'].includes(lowerMsg)) {
      if (session.intent === 'reschedule' && !session.meetingId) {
         session.targetDate = null;
      } else {
         session.date = null;
         session.time = null;
      }
      session.suggestedSlots = [];
      await session.save();
      return sendResponse(res, session, {
        reply: "📅 What day would you prefer then?",
        sessionId: session._id,
        suggestedActions: ['Tomorrow', 'Next Monday']
      });
    }

    if (['choose another time', 'another time', 'different time'].includes(lowerMsg)) {
      session.time = null;
      session.suggestedSlots = [];
      await session.save();
      return sendResponse(res, session, {
        reply: `🕐 What time on **${session.date || 'that day'}** works better?`,
        sessionId: session._id,
        suggestedActions: ['10 AM', '2 PM']
      });
    }

    // ── Call AI Service ──
    const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';
    const aiResponse = await axios.post(`${aiServiceUrl}/parse`, { message, current_time: userNow, history });
    const { intent, date, time, time_range, timezone, duration, participants, title_hint } = aiResponse.data;

    // Persist Intent
    if (intent && intent !== 'unknown' && !session.intent) {
      session.intent = intent;
    } else if (intent && intent !== 'unknown' && intent !== 'schedule' && !['reschedule','cancel'].includes(session.intent)) {
      session.intent = intent;
    }

    // ── Handle QUERY intent ──
    if (session.intent === 'query' || intent === 'query') {
      const ianaZone = resolveTimezone(tz);
      const queryDate = date; // If date provided, use it
      
      const query = { 
        status: 'scheduled',
        $or: [
          { organizer: user._id },
          { participants: user.email }
        ]
      };
      if (queryDate) query.date = queryDate;
      
      // Advanced Search: Title hint or Participants
      if (title_hint) {
        query.title = { $regex: new RegExp(title_hint, 'i') };
      }
      if (participants?.length > 0) {
        query.participants = { $in: participants.map(p => new RegExp(p, 'i')) };
      }
      
      // If nothing provided, default to today
      if (!queryDate && !title_hint && participants?.length === 0) {
        query.date = moment().tz(ianaZone).format('YYYY-MM-DD');
      }

      const meetings = await Meeting.find(query);
      session.status = 'completed';
      await session.save();

      if (meetings.length === 0) {
        return sendResponse(res, session, {
          reply: `You have a clear schedule on **${queryDate || 'that period'}** — no meetings booked! 🎉 Would you like to schedule one?`,
          sessionId: null
        });
      }

      let list = meetings.map(m => {
        const localTime = formatTime12(m.startTime);
        const utcTime = formatTimeInZone(m.date, m.startTime, tz, 'UTC');
        const endStr = formatTime12(moment.tz(`${m.date}T${m.startTime}`, ianaZone).add(m.duration, 'minutes').format('HH:mm'));
        return `• **${m.title}** — ${localTime} to ${endStr} (${tz}) | ${utcTime} (UTC)`;
      }).join('\n');

      return sendResponse(res, session, {
        reply: `📅 Here's your schedule for **${queryDate || 'that period'}** (${tz}):\n\n${list}\n\nNeed to make any changes?`,
        sessionId: null
      });
    }

    // ── Handle AVAILABILITY intent ──
    if (session.intent === 'availability' || intent === 'availability') {
      const ianaZone = resolveTimezone(tz);
      const avDate = date || moment().tz(ianaZone).add(1, 'day').format('YYYY-MM-DD');

      const avDateDayOfWeek = moment.tz(`${avDate}T12:00:00`, ianaZone).day();
      if ((user.offDays || [0]).includes(avDateDayOfWeek)) {
        session.status = 'completed';
        await session.save();
        const dayName = moment.tz(`${avDate}T12:00:00`, ianaZone).format('dddd');
        return sendResponse(res, session, {
          reply: `**${avDate}** is a day off for you (${dayName})! 🎉 Want me to check another day?`,
          sessionId: null,
          suggestedActions: ['Check tomorrow', 'Check next week']
        });
      }

      const meetings = await Meeting.find({ organizer: user._id, date: avDate, status: 'scheduled' });
      const slots = getAvailableSlots(meetings, avDate, tz, buffer, whStart.hour, whStart.min, whEnd.hour, whEnd.min, breakStartStr, breakEndStr);
      session.status = 'completed';
      await session.save();

      if (slots.length === 0) {
        return sendResponse(res, session, {
          reply: `Hmm, looks like **${avDate}** is completely packed! 😅 Want me to check another day?`,
          sessionId: null,
          suggestedActions: ['Check tomorrow', 'Check next week']
        });
      }

      const slotLabels = slots.slice(0, 5).map(s => formatTime12(s));
      return sendResponse(res, session, {
        reply: `🕐 Free slots on **${avDate}** (${tz}, working hours ${formatTime12(user.workingHoursStart || '09:00')} – ${formatTime12(user.workingHoursEnd || '18:00')}):\n\n${slotLabels.map(s => `• ${s}`).join('\n')}\n\n_Break: ${formatTime12(breakStartStr)} – ${formatTime12(breakEndStr)} excluded_\n\nWould you like to schedule something?`,
        sessionId: null,
        suggestedActions: slotLabels.slice(0, 3)
      });
    }

    // ── State Machine Updates ──
    if (session.intent === 'reschedule' || session.intent === 'cancel') {
      const isMissingParticipant = (!session.targetParticipant && session.targetDate);
      
      if (!session.meetingId && session.intent === 'reschedule') {
        if (date) session.targetDate = date;
        if (participants?.length > 0) session.targetParticipant = participants[0];
        else if (title_hint) session.targetParticipant = title_hint;
        else if (isMissingParticipant) session.targetParticipant = message.trim();
      } else if (session.intent === 'cancel') {
        if (date) session.targetDate = date;
        if (participants?.length > 0) session.targetParticipant = participants[0];
        else if (title_hint) session.targetParticipant = title_hint;
        else if (isMissingParticipant) session.targetParticipant = message.trim();
      } else {
        if (date) session.date = date;
        if (time) session.time = time;
        if (timezone) session.timezone = timezone;
        if (duration) session.duration = duration;
      }
    } else {
      if (date) session.date = date;
      if (time) session.time = time;
      if (timezone) session.timezone = timezone;
      if (duration) session.duration = duration;
      if (title_hint) session.title = generateTitle([], title_hint);

      // ── Disambiguation ──
      // 1. Process new participants from AI into the queue
      if (participants?.length > 0) {
        session.pendingParticipants = [...new Set([...(session.pendingParticipants || []), ...participants])];
      }

      // 2. Resolve previously asked ambiguity if applicable
      if (session.pendingResolutionName) {
        const chosen = session.ambiguousCandidates.find(c =>
          lowerMsg.includes(c.toLowerCase()) || lowerMsg.includes(c.split('@')[0].toLowerCase())
        );
        if (chosen) {
          const safeList = session.resolvedParticipants || [];
          session.resolvedParticipants = [...new Set([...safeList, chosen])];
          session.pendingResolutionName = null;
          session.ambiguousCandidates = [];
        } else {
          await session.save();
          return sendResponse(res, session, {
            reply: `🤔 I didn't catch that. Did you mean ${session.ambiguousCandidates.join(' or ')}?`,
            sessionId: session._id,
            suggestedActions: session.ambiguousCandidates
          });
        }
      }

      // 3. Process the queue until we hit an ambiguity or empty it
      const safeList = session.resolvedParticipants || [];
      while (session.pendingParticipants && session.pendingParticipants.length > 0) {
        const part = session.pendingParticipants.shift();

        // Team/Workspace Resolution
        const team = await Team.findOne({ name: { $regex: new RegExp(`^${part}$`, 'i') }, owner: user._id });
        if (team) {
          for (const m of team.members) {
            const member = await User.findById(m.user);
            if (member) safeList.push(member.email);
          }
          continue;
        }

        const users = await User.find({ name: { $regex: new RegExp(part, 'i') } });
        if (users.length > 1) {
          session.pendingResolutionName = part;
          session.ambiguousCandidates = users.map(u => u.email);
          session.resolvedParticipants = [...new Set(safeList)];
          await session.save();
          return sendResponse(res, session, {
            reply: `I found multiple people named **${part}**. Which one did you mean? 🧐`,
            sessionId: session._id,
            suggestedActions: users.map(u => `${u.name} (${u.email})`)
          });
        } else if (users.length === 1) {
          safeList.push(users[0].email);
        } else {
          safeList.push(part);
        }
      }
      session.resolvedParticipants = [...new Set(safeList)];
    }

    await session.save();

    // ── Schedule Flow ──
    if (session.intent === 'schedule') {
      if (!session.resolvedParticipants || session.resolvedParticipants.length === 0) {
        session.awaitingParticipants = true;
        await session.save();
        return sendResponse(res, session, {
          reply: "Sure thing! 🙌 Who would you like to schedule this meeting with?",
          sessionId: session._id,
          suggestedActions: ['Schedule Meeting', 'View Calendar']
        });
      }
      if (!session.date) {
        return sendResponse(res, session, {
          reply: `Great, a meeting with **${session.resolvedParticipants.join(', ')}**! 📅 What date works best?`,
          sessionId: session._id,
          suggestedActions: ['Tomorrow', 'Today', 'Next Monday']
        });
      }
      if (!session.time) {
        const ianaOrgTz = resolveTimezone(tz);
        const reqDayOfWeek = moment.tz(`${session.date}T12:00:00`, ianaOrgTz).day();
        if ((user.offDays || [0]).includes(reqDayOfWeek)) {
          const staleDate = session.date;
          session.date = null;
          await session.save();
          const dayName = moment.tz(`${staleDate}T12:00:00`, ianaOrgTz).format('dddd');
          return sendResponse(res, session, {
            reply: `📅 **${staleDate}** is a day off for you (${dayName}). Please pick another day!`,
            sessionId: session._id,
            suggestedActions: ['Tomorrow', 'Next Monday']
          });
        }

        // ── Multi-User Availability Check ──
        // Use the new multi-user engine to find slots that work for ALL participants
        const desiredDuration = session.duration || 30;
        const multiAvail = await calculateMultiUserAvailability(
          session.resolvedParticipants, session.date, user, desiredDuration
        );

        if (time_range) {
          const range = timeRangeToHour(time_range);
          // Filter multi-user slots to the requested time range
          const ianaOrgTz = resolveTimezone(tz);
          const rangeStartUTC = moment.tz(`${session.date}T${String(range.start).padStart(2,'0')}:00`, ianaOrgTz).utc();
          const rangeEndUTC = moment.tz(`${session.date}T${String(range.end).padStart(2,'0')}:00`, ianaOrgTz).utc();

          let filteredSlots = multiAvail.commonSlots.filter(s =>
            s.startUTC.isSameOrAfter(rangeStartUTC) && s.endUTC.isSameOrBefore(rangeEndUTC)
          );

          if (filteredSlots.length > 0) {
            const topSlots = filteredSlots.slice(0, 3);
            const slotLabels = topSlots.map(s => formatTime12(slotToLocalTime(s.startUTC, tz)));
            session.suggestedSlots = topSlots.map(s => slotToLocalTime(s.startUTC, tz));
            session.time = session.suggestedSlots[0];
            session.awaitingConfirmation = true;
            await session.save();

            let replyMsg = `🕐 Best available ${time_range} slot for everyone is **${slotLabels[0]}** (${tz}).`;
            if (multiAvail.registeredCount > 1) {
              replyMsg += ` _(checked ${multiAvail.registeredCount} participants' schedules)_`;
            }
            replyMsg += ` Shall I book it?`;
            if (slotLabels.length > 1) {
              replyMsg += `\n\nOther options: ${slotLabels.slice(1).join(', ')}`;
            }

            return sendResponse(res, session, {
              reply: replyMsg,
              sessionId: session._id,
              suggestedActions: [...slotLabels, 'Choose another time']
            });
          } else {
            // Check if there are least-conflicting slots in this range
            const leastInRange = multiAvail.leastConflictingSlots.filter(s =>
              s.startUTC.isSameOrAfter(rangeStartUTC) && s.endUTC.isSameOrBefore(rangeEndUTC)
            );
            if (leastInRange.length > 0) {
              const topSlots = leastInRange.slice(0, 3);
              const slotLabels = topSlots.map(s => formatTime12(slotToLocalTime(s.startUTC, tz)));
              let replyMsg = `😕 No ${time_range} slot works for **everyone** on **${session.date}**.\n\nBest options (fewest conflicts):`;
              for (const slot of topSlots) {
                const localTime = formatTime12(slotToLocalTime(slot.startUTC, tz));
                replyMsg += `\n• **${localTime}** — ${slot.freeCount}/${multiAvail.registeredCount} available`;
                if (slot.conflictingUsers.length > 0) {
                  replyMsg += ` _(${slot.conflictingUsers.join(', ')} has a conflict)_`;
                }
              }
              return sendResponse(res, session, {
                reply: replyMsg,
                sessionId: session._id,
                suggestedActions: [...slotLabels, 'Choose another time range', 'Choose another day']
              });
            }
            return sendResponse(res, session, {
              reply: `😕 No available slots in the ${time_range} on **${session.date}**. Want me to check a different time range?`,
              sessionId: session._id,
              suggestedActions: ['Morning', 'Afternoon', 'Evening', 'Choose another day']
            });
          }
        }

        // No specific time range — show best available common slots
        if (multiAvail.commonSlots.length > 0) {
          const topSlots = multiAvail.commonSlots.slice(0, 5);
          const slotLabels = topSlots.map(s => formatTime12(slotToLocalTime(s.startUTC, tz)));
          let replyMsg = `⏰ What time works for you?`;
          if (multiAvail.registeredCount > 1) {
            replyMsg += ` I've checked **${multiAvail.registeredCount} participants'** schedules.`;
          }
          replyMsg += ` Common free slots on **${session.date}** (${tz}):\n\n${slotLabels.map(s => `• ${s}`).join('\n')}`;
          replyMsg += `\n\n_Working hours: ${formatTime12(user.workingHoursStart || '09:00')} – ${formatTime12(user.workingHoursEnd || '18:00')}_`;
          if (multiAvail.externalCount > 0) {
            replyMsg += `\n_Note: ${multiAvail.externalCount} external participant(s) excluded from availability check._`;
          }
          return sendResponse(res, session, {
            reply: replyMsg,
            sessionId: session._id,
            suggestedActions: [...slotLabels.slice(0, 3), 'Choose another time']
          });
        } else if (multiAvail.leastConflictingSlots.length > 0) {
          // No perfect slot — show least conflicting options
          const topSlots = multiAvail.leastConflictingSlots.slice(0, 3);
          const slotLabels = topSlots.map(s => formatTime12(slotToLocalTime(s.startUTC, tz)));
          let replyMsg = `⚠️ No single time works for **all ${multiAvail.registeredCount} participants** on **${session.date}**.\n\nHere are the **least conflicting** options (${tz}):`;
          for (const slot of topSlots) {
            const localTime = formatTime12(slotToLocalTime(slot.startUTC, tz));
            replyMsg += `\n• **${localTime}** — ${slot.freeCount}/${multiAvail.registeredCount} available`;
            if (slot.conflictingUsers.length > 0) {
              replyMsg += ` _(${slot.conflictingUsers.join(', ')} has a conflict)_`;
            }
          }
          replyMsg += `\n\nWould you like to pick one of these, or try a different day?`;
          return sendResponse(res, session, {
            reply: replyMsg,
            sessionId: session._id,
            suggestedActions: [...slotLabels, 'Choose another day']
          });
        } else if (multiAvail.noOverlap) {
          return sendResponse(res, session, {
            reply: `⚠️ The participants' working hours don't overlap on **${session.date}**. Their timezones may be too far apart. Would you like to try a different day or adjust participants?`,
            sessionId: session._id,
            suggestedActions: ['Choose another day', 'Change participants']
          });
        } else {
          return sendResponse(res, session, {
            reply: `⏰ What time should we schedule this on **${session.date}**?`,
            sessionId: session._id,
            suggestedActions: ['10 AM', '2 PM', '4 PM']
          });
        }
      }
      if (!session.duration) {
        return sendResponse(res, session, {
          reply: "⏳ How long should this meeting be?",
          sessionId: session._id,
          suggestedActions: ['30 minutes', '1 hour', '15 minutes']
        });
      }

      // ── Past Date-Time Guard ──
      // Before any further validation, ensure the requested date+time is not in the past.
      if (session.date && session.time) {
        const reqTzGuard = session.timezone || tz;
        const ianaReqTzGuard = resolveTimezone(reqTzGuard);
        const requestedMoment = moment.tz(`${session.date}T${session.time}`, ianaReqTzGuard);
        const nowMoment = moment().tz(ianaReqTzGuard);
        if (requestedMoment.isBefore(nowMoment)) {
          // Clear the stale date/time so the flow asks the user again
          const wasDate = session.date;
          const wasTime = formatTime12(session.time);
          session.date = null;
          session.time = null;
          await session.save();
          return sendResponse(res, session, {
            reply: `⏰ **${wasDate} at ${wasTime}** has already passed! Please choose a future date and time.`,
            sessionId: session._id,
            suggestedActions: ['Tomorrow', 'Next Monday', 'Choose a time']
          });
        }

        // ── Specific Availability / Conflict Guard ──
        const conflictCheck = await validateSpecificSlot(
          session.resolvedParticipants, session.date, session.time, session.duration, user
        );

        if (conflictCheck.length > 0) {
          session.time = null; // Clear time so they choose again
          await session.save();

          const reasons = conflictCheck.map(c => `**${c.name}** is ${c.reason}`).join(', ');
          let conflictMsg = `⚠️ Conflict detected: ${reasons} at that time.`;

          if (buffer > 0 && conflictCheck.some(c => c.name === user.name)) {
            conflictMsg += ` _(includes ${buffer} min post-meeting buffer)_`;
          }

          // Proactive Alternative Slot Suggestions
          const alternatives = await findAlternativeSlots(
            session.resolvedParticipants, session.date, user, session.duration || 30
          );

          if (alternatives.length > 0) {
            conflictMsg += `\n\n**Common free slots instead:**`;
            const slotLabels = alternatives.map(a => a.label);
            session.suggestedSlots = alternatives.map(a => `${a.date}T${a.time}`);
            await session.save();
            return sendResponse(res, session, {
              reply: conflictMsg + `\n${alternatives.map(a => `• ${a.label}`).join('\n')}\n\nShall I book one of these for you?`,
              sessionId: session._id,
              suggestedActions: [...slotLabels, 'Choose another day']
            });
          }

          return sendResponse(res, session, {
            reply: conflictMsg + `\nLet's pick a different time!`,
            sessionId: session._id,
            suggestedActions: ['Choose another time', 'Choose another day']
          });
        }
      }

      // Title asked AFTER successful time validation!
      if (!session.title) {
        session.awaitingTitle = true;
        await session.save();
        return sendResponse(res, session, {
          reply: "📝 What is this meeting about?",
          sessionId: session._id,
          suggestedActions: ['Sync up', 'Catch up', 'Project Discussion']
        });
      }

      // ── Auto Title Generation ──
      const meetingTitle = session.title;

      // ── Store the meeting time in the user's local timezone ──
      const meeting = await Meeting.create({
        title: meetingTitle,
        date: session.date,
        startTime: session.time,
        duration: session.duration,
        participants: session.resolvedParticipants,
        organizer: req.user._id
      });

      meeting.jitsiRoom = `chronosai-${meeting._id}`;
      await meeting.save();

      // ── Integrations ──
      let googleSyncWarning = '';
      if (user.googleId) {
        const syncRes = await syncWithGoogleCalendar(user, meeting, 'insert');
        if (syncRes.success && syncRes.eventId) {
          meeting.googleEventId = syncRes.eventId;
          await meeting.save();
        } else if (!syncRes.success) {
          googleSyncWarning = `\n\n⚠️ Note: Could not sync to Google Calendar (${syncRes.error}).`;
        }
      }
      if (process.env.SMTP_USER && meeting.participants?.length > 0) {
        const emails = meeting.participants.filter(p => p.includes('@'));
        if (emails.length > 0) {
          const userDocs = await User.find({ email: { $in: emails } });
          const formattedParticipantsStr = emails.map(email => {
            const u = userDocs.find(x => x.email === email);
            return u ? `${u.name} (${u.email})` : email;
          }).join(', ');
          
          sendEmail({
            to: emails.join(', '),
            subject: `📅 Meeting Invite: ${meeting.title}`,
            html: buildInviteEmail(meeting, tz, formattedParticipantsStr, `${user.name} (${user.email})`)
          }).catch(e => console.error('Email error:', e.message));
        }
      }

      session.status = 'completed';
      session.meetingId = meeting._id;
      await session.save();

      // Build confirmation with timezone info
      const localTimeStr = formatTime12(session.time);
      const utcMoment = toUTC(session.date, session.time, tz);
      const utcTimeStr = formatTime12(utcMoment.format('HH:mm'));
      const participantNames = session.resolvedParticipants.map(p => p.includes('@') ? p.split('@')[0] : p).join(', ');

      let confirmMsg = `🎉 All set! Your meeting is booked:\n\n📌 **${meetingTitle}**\n📅 ${session.date}\n🕐 ${localTimeStr} (${tz}) | ${utcTimeStr} (UTC)\n⏱ ${session.duration} min\n👥 ${participantNames}\n🔗 Video link ready!`;

      // ── Participant availability summary for final message ──
      // If we came from a flow that didn't calculate multiAvail (e.g. user provided an exact time),
      // we quickly resolve the registered/external counts here.
      let registeredCount = session.resolvedParticipants.length;
      let externalCount = 0;
      
      const registeredUsers = await User.find({ email: { $in: session.resolvedParticipants.map(e => e.toLowerCase()) } });
      const registeredEmails = registeredUsers.map(u => u.email.toLowerCase());
      externalCount = session.resolvedParticipants.filter(e => !registeredEmails.includes(e.toLowerCase())).length;
      registeredCount = registeredUsers.length + 1; // +1 for the organizer
      
      if (registeredCount > 1) {
        confirmMsg += `\n✅ All ${registeredCount} participants are available at this time.`;
      }
      if (externalCount > 0) {
        confirmMsg += `\n📧 ${externalCount} external participant(s) will receive an invite.`;
      }
      confirmMsg += `${googleSyncWarning}\n\nAnything else I can help with?`;

      return sendResponse(res, session, {
        reply: confirmMsg,
        sessionId: null,
        meeting,
        meetingCard: {
          title: meetingTitle,
          date: session.date,
          time: localTimeStr,
          duration: session.duration,
          participants: participantNames,
          room: meeting.jitsiRoom
        },
        suggestedActions: ['Schedule another', 'View Calendar']
      });

    // ── Cancel Flow ──
    } else if (session.intent === 'cancel') {
      if (!session.targetDate) {
        return sendResponse(res, session, {
          reply: "Sure, I can help cancel a meeting. 📋 What date is the meeting on?",
          sessionId: session._id,
          suggestedActions: ['Today', 'Tomorrow']
        });
      }
      if (!session.targetParticipant) {
        const meetings = await Meeting.find({ organizer: user._id, date: session.targetDate, status: 'scheduled' });
        if (meetings.length > 0) {
          const list = meetings.map(m => `${m.title} at ${formatTime12(m.startTime)}`);
          return sendResponse(res, session, {
            reply: `Which meeting on **${session.targetDate}** would you like to cancel?\n\n${list.map(l => `• ${l}`).join('\n')}`,
            sessionId: session._id,
            suggestedActions: meetings.map(m => m.participants?.[0] || m.title)
          });
        }
        return sendResponse(res, session, { reply: "Who is the meeting with, or what is its title?", sessionId: session._id });
      }

      let searchRegex = new RegExp(session.targetParticipant, 'i');
      const team = await Team.findOne({ name: { $regex: new RegExp(`^${session.targetParticipant}$`, 'i') }, owner: req.user._id });
      if (team && team.members && team.members.length > 0) {
        const firstMember = await User.findById(team.members[0].user);
        if (firstMember) searchRegex = new RegExp(firstMember.email, 'i');
      }

      const meetingToCancel = await Meeting.findOne({
        organizer: req.user._id, status: 'scheduled', date: session.targetDate,
        $or: [
          { participants: { $regex: searchRegex } },
          { title: { $regex: new RegExp(session.targetParticipant, 'i') } }
        ]
      });

      if (meetingToCancel) {
        meetingToCancel.status = 'canceled';
        await meetingToCancel.save();
        session.status = 'completed';
        await session.save();

        if (process.env.SMTP_USER && meetingToCancel.participants?.length > 0) {
          const emails = meetingToCancel.participants.filter(p => p.includes('@'));
          if (emails.length > 0) {
            const userDocs = await User.find({ email: { $in: emails } });
            const formattedParticipantsStr = emails.map(email => {
              const u = userDocs.find(x => x.email === email);
              return u ? `${u.name} (${u.email})` : email;
            }).join(', ');
            
            sendEmail({
              to: emails.join(', '),
              subject: `❌ CANCELED: ${meetingToCancel.title}`,
              html: buildCancelEmail(meetingToCancel, tz, formattedParticipantsStr, `${user.name} (${user.email})`)
            }).catch(e => console.error('Email error:', e.message));
          }
        }

        let googleSyncWarning = '';
        if (user.googleId && meetingToCancel.googleEventId) {
          const syncRes = await syncWithGoogleCalendar(user, meetingToCancel, 'delete');
          if (!syncRes.success) {
            googleSyncWarning = `\n\n⚠️ Note: Could not sync to Google Calendar (${syncRes.error}).`;
          }
        }

        return sendResponse(res, session, {
          reply: `✅ Done! **${meetingToCancel.title}** on ${meetingToCancel.date} at ${formatTime12(meetingToCancel.startTime)} (${tz}) has been canceled.${googleSyncWarning}`,
          sessionId: null, meeting: meetingToCancel,
          suggestedActions: ['Schedule Meeting', 'View Calendar']
        });
      } else {
        session.status = 'completed';
        await session.save();
        return sendResponse(res, session, {
          reply: `🔍 I couldn't find a scheduled meeting with **${session.targetParticipant}** on **${session.targetDate}**.`,
          sessionId: null, suggestedActions: ['Try again', 'View Calendar']
        });
      }

    // ── Reschedule Flow ──
    } else if (session.intent === 'reschedule') {
      if (!session.meetingId) {
        if (!session.targetDate) {
          return sendResponse(res, session, { reply: "Got it, let's reschedule! 📋 What's the original date?", sessionId: session._id, suggestedActions: ['Today', 'Tomorrow'] });
        }
        if (!session.targetParticipant) {
          return sendResponse(res, session, { reply: "Who is the meeting with, or what is its title?", sessionId: session._id });
        }

        let searchRegex = new RegExp(session.targetParticipant, 'i');
        const team = await Team.findOne({ name: { $regex: new RegExp(`^${session.targetParticipant}$`, 'i') }, owner: req.user._id });
        if (team && team.members && team.members.length > 0) {
          const firstMember = await User.findById(team.members[0].user);
          if (firstMember) searchRegex = new RegExp(firstMember.email, 'i');
        }

        const oldMeeting = await Meeting.findOne({
          organizer: req.user._id, status: 'scheduled', date: session.targetDate,
          $or: [
            { participants: { $regex: searchRegex } },
            { title: { $regex: new RegExp(session.targetParticipant, 'i') } }
          ]
        });

        if (oldMeeting) {
          session.meetingId = oldMeeting._id;
          session.date = null;
          session.time = null;
          await session.save();
          return sendResponse(res, session, {
            reply: `Found it! **${oldMeeting.title}** at ${formatTime12(oldMeeting.startTime)}. 📅 What's the new date?`,
            sessionId: session._id, suggestedActions: ['Tomorrow', 'Next Monday', 'Next Week']
          });
        } else {
          session.status = 'completed';
          await session.save();
          return sendResponse(res, session, { reply: `🔍 I couldn't find that meeting.`, sessionId: null, suggestedActions: ['Try again', 'View Calendar'] });
        }
      } else {
        if (!session.date) return sendResponse(res, session, { reply: "📅 What's the new date?", sessionId: session._id, suggestedActions: ['Tomorrow', 'Next Monday'] });
        if (!session.time) {
          const ianaOrgTz = resolveTimezone(tz);
          const reqDayOfWeek = moment.tz(`${session.date}T12:00:00`, ianaOrgTz).day();
          if ((user.offDays || [0]).includes(reqDayOfWeek)) {
            const staleDate = session.date;
            session.date = null;
            await session.save();
            const dayName = moment.tz(`${staleDate}T12:00:00`, ianaOrgTz).format('dddd');
            return sendResponse(res, session, {
              reply: `📅 **${staleDate}** is a day off for you (${dayName}). Please pick another day!`,
              sessionId: session._id,
              suggestedActions: ['Tomorrow', 'Next Monday']
            });
          }

          const meetingToReschedule = await Meeting.findById(session.meetingId);
          const partsToCheck = meetingToReschedule ? meetingToReschedule.participants : [];
          const multiAvail = await calculateMultiUserAvailability(
            partsToCheck, session.date, user, session.duration || meetingToReschedule?.duration || 30
          );
          
          if (multiAvail.commonSlots.length > 0) {
            const topSlots = multiAvail.commonSlots.slice(0, 3);
            const slotLabels = topSlots.map(s => formatTime12(slotToLocalTime(s.startUTC, tz)));
            return sendResponse(res, session, {
              reply: `⏰ What time on **${session.date}**?\n\nSlots that work for everyone:\n${slotLabels.map(s => `• ${s}`).join('\n')}`,
              sessionId: session._id, suggestedActions: [...slotLabels]
            });
          } else {
             return sendResponse(res, session, {
              reply: `⏰ What time on **${session.date}**? (Warning: No common slot found that works for all participants on this day).`,
              sessionId: session._id, suggestedActions: ['10 AM', '2 PM', 'Choose another day']
            });
          }
        }

        const meetingToReschedule = await Meeting.findById(session.meetingId);
        if (meetingToReschedule) {
          // Check multi-user conflict for the new time before saving
          const conflictCheck = await validateSpecificSlot(
            meetingToReschedule.participants, session.date, session.time, session.duration || meetingToReschedule.duration, user
          );

          if (conflictCheck.length > 0) {
            session.time = null; // Clear time so they choose again
            await session.save();

            const reasons = conflictCheck.map(c => `**${c.name}** is ${c.reason}`).join(', ');
            let conflictMsg = `⚠️ Conflict detected: ${reasons} at that time.`;

            if (buffer > 0 && conflictCheck.some(c => c.name === user.name)) {
              conflictMsg += ` _(includes ${buffer} min post-meeting buffer)_`;
            }

            return sendResponse(res, session, {
              reply: conflictMsg + `\nLet's pick a different time!`,
              sessionId: session._id,
              suggestedActions: ['Choose another time', 'Choose another day']
            });
          }

          meetingToReschedule.date = session.date;
          meetingToReschedule.startTime = session.time;
          if (session.duration) meetingToReschedule.duration = session.duration;
          meetingToReschedule.isRescheduled = true;
          await meetingToReschedule.save();
          session.status = 'completed';
          await session.save();

          if (process.env.SMTP_USER && meetingToReschedule.participants?.length > 0) {
            const emails = meetingToReschedule.participants.filter(p => p.includes('@'));
            if (emails.length > 0) {
              const userDocs = await User.find({ email: { $in: emails } });
              const formattedParticipantsStr = emails.map(email => {
                const u = userDocs.find(x => x.email === email);
                return u ? `${u.name} (${u.email})` : email;
              }).join(', ');
              
              sendEmail({
                to: emails.join(', '),
                subject: `🔄 RESCHEDULED: ${meetingToReschedule.title}`,
                html: buildRescheduleEmail(meetingToReschedule, tz, formattedParticipantsStr, `${user.name} (${user.email})`)
              }).catch(e => console.error('Email error:', e.message));
            }
          }

          let googleSyncWarning = '';
          if (user.googleId && meetingToReschedule.googleEventId) {
            const syncRes = await syncWithGoogleCalendar(user, meetingToReschedule, 'update');
            if (!syncRes.success) {
              googleSyncWarning = `\n\n⚠️ Note: Could not sync to Google Calendar (${syncRes.error}).`;
            }
          }

          const utcM = toUTC(session.date, session.time, tz);
          return sendResponse(res, session, {
            reply: `✅ **${meetingToReschedule.title}** moved to **${session.date}** at **${formatTime12(session.time)}** (${tz}) | **${formatTime12(utcM.format('HH:mm'))}** (UTC). Everyone's notified! 🔔${googleSyncWarning}`,
            sessionId: null, meeting: meetingToReschedule,
            suggestedActions: ['Schedule Meeting', 'View Calendar']
          });
        }
      }
    }

    // ── Fallback ──
    const responsePayload = {
      reply: "Hey there! 👋 I can help you with:\n\n• **Schedule** a new meeting\n• **Reschedule** an existing one\n• **Cancel** a meeting\n• **Check your calendar** for a specific day\n• **Find free slots** in your schedule\n\nWhat would you like to do?",
      sessionId: session._id,
      suggestedActions: ['Schedule Meeting', 'View Calendar', 'Cancel Meeting', 'When am I free?']
    };
    session.messages.push({ role: 'model', content: responsePayload.reply });
    await session.save();
    return res.json(responsePayload);
  } catch (err) {
    console.error('Dialogue Error:', err);
    return res.status(500).json({ reply: "Sorry, I had a technical glitch. 😵 Could you try that again?" });
  }
};

function formatHistory(messages) {
  return messages.slice(-20).map(m => ({ role: m.role, parts: [{ text: m.content }] }));
}
