import moment from 'moment-timezone';
import User from '../models/User.model.js';
import Meeting from '../models/Meeting.model.js';

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

export function resolveTimezone(tz) {
  return TZ_MAP[tz] || tz || 'UTC';
}

// ── Fetch constraints for all registered participants ────────────
// Returns an array of { user, ianaZone, workStart, workEnd, breakStart, breakEnd, buffer, meetings }
// All time values are moment objects in UTC for the given date.
export async function fetchUserConstraints(participantEmails, dateStr, organizerUser) {
  const constraints = [];

  // Always include the organizer as the first constraint
  const orgConstraint = await buildConstraintForUser(organizerUser, dateStr);
  constraints.push(orgConstraint);

  // Resolve registered participants
  for (const email of participantEmails) {
    if (!email.includes('@')) continue; // skip unresolved names
    if (email === organizerUser.email) continue; // skip organizer duplicate

    const participantUser = await User.findOne({ email: email.toLowerCase() });
    if (!participantUser) continue; // external participant — ignore availability

    const constraint = await buildConstraintForUser(participantUser, dateStr);
    constraints.push(constraint);
  }

  return constraints;
}

// ── Build constraint object for a single user ────────────────────
async function buildConstraintForUser(user, dateStr) {
  const ianaZone = resolveTimezone(user.timezone || 'UTC');
  const buffer = user.bufferTime || 0;

  // Working hours in UTC for the given date
  const workStart = moment.tz(`${dateStr}T${user.workingHoursStart || '09:00'}`, ianaZone).utc();
  const workEnd = moment.tz(`${dateStr}T${user.workingHoursEnd || '18:00'}`, ianaZone).utc();

  // Break time in UTC
  const breakStart = moment.tz(`${dateStr}T${user.breakStart || '13:00'}`, ianaZone).utc();
  const breakEnd = moment.tz(`${dateStr}T${user.breakEnd || '14:00'}`, ianaZone).utc();

  // Fetch existing meetings for this user on this date
  // We query using the user's local date, since meetings are stored in local time
  const meetings = await Meeting.find({
    organizer: user._id,
    date: dateStr,
    status: 'scheduled'
  });

  // Also find meetings where this user is a participant (invited to by others)
  const participantMeetings = await Meeting.find({
    participants: { $regex: new RegExp(user.email, 'i') },
    date: dateStr,
    status: 'scheduled',
    organizer: { $ne: user._id } // exclude own meetings (already fetched)
  });

  // Convert all meetings to UTC busy blocks
  const busyBlocks = [];

  for (const m of [...meetings, ...participantMeetings]) {
    // Determine the timezone used when storing this meeting
    // Meetings are stored in the organizer's local time
    const meetingOrganizer = m.organizer.toString() === user._id.toString() ? user : null;
    let meetingTz = ianaZone; // default to current user's timezone

    if (!meetingOrganizer) {
      // This is a meeting organized by someone else — the startTime is in the organizer's timezone
      // For simplicity, we treat the stored time as the date's timezone
      // In a more robust system, we'd store timezone per meeting
      meetingTz = ianaZone;
    }

    const mStart = moment.tz(`${m.date}T${m.startTime}`, meetingTz).utc();
    const mEnd = mStart.clone().add(m.duration, 'minutes').add(buffer, 'minutes');
    busyBlocks.push({ start: mStart, end: mEnd, type: 'busy' });
  }

  // Add break as a busy block
  busyBlocks.push({ start: breakStart.clone(), end: breakEnd.clone(), type: 'on break' });

  // Add Day Off as a full-day busy block
  const dayOfWeek = moment.tz(`${dateStr}T12:00:00`, ianaZone).day();
  if ((user.offDays || [0]).includes(dayOfWeek)) {
    busyBlocks.push({ start: workStart.clone().subtract(1, 'hour'), end: workEnd.clone().add(1, 'hour'), type: 'on a day off' });
  }

  // Sort by start time
  busyBlocks.sort((a, b) => a.start - b.start);

  return {
    userId: user._id,
    email: user.email,
    name: user.name,
    ianaZone,
    workStart,
    workEnd,
    buffer,
    busyBlocks,
    offDays: user.offDays || [0]
  };
}

// ── Merge overlapping time blocks ────────────────────────────────
function mergeBlocks(blocks) {
  if (blocks.length === 0) return [];
  const sorted = [...blocks].sort((a, b) => a.start - b.start);
  const merged = [{ start: sorted[0].start.clone(), end: sorted[0].end.clone() }];

  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1];
    if (sorted[i].start.isSameOrBefore(last.end)) {
      if (sorted[i].end.isAfter(last.end)) {
        last.end = sorted[i].end.clone();
      }
    } else {
      merged.push({ start: sorted[i].start.clone(), end: sorted[i].end.clone() });
    }
  }
  return merged;
}

// ── Find free slots within a work window, given busy blocks ──────
function findFreeSlots(workStart, workEnd, mergedBusy, minDurationMins = 15) {
  const slots = [];
  let cursor = workStart.clone();

  for (const block of mergedBusy) {
    if (block.start.isAfter(workEnd)) break;
    if (block.end.isBefore(cursor)) continue;

    if (cursor.isBefore(block.start)) {
      const gapEnd = moment.min(block.start, workEnd);
      const gap = gapEnd.diff(cursor, 'minutes');
      if (gap >= minDurationMins) {
        slots.push({ start: cursor.clone(), end: gapEnd.clone() });
      }
    }
    if (block.end.isAfter(cursor)) {
      cursor = block.end.clone();
    }
  }

  // Check trailing gap after last busy block
  if (cursor.isBefore(workEnd)) {
    const gap = workEnd.diff(cursor, 'minutes');
    if (gap >= minDurationMins) {
      slots.push({ start: cursor.clone(), end: workEnd.clone() });
    }
  }

  return slots;
}

// ── Calculate the overlapping work window for all participants ───
function getCommonWorkWindow(constraints) {
  // The common work window is the intersection of all participants' work hours
  let latestStart = constraints[0].workStart.clone();
  let earliestEnd = constraints[0].workEnd.clone();

  for (let i = 1; i < constraints.length; i++) {
    if (constraints[i].workStart.isAfter(latestStart)) {
      latestStart = constraints[i].workStart.clone();
    }
    if (constraints[i].workEnd.isBefore(earliestEnd)) {
      earliestEnd = constraints[i].workEnd.clone();
    }
  }

  return { start: latestStart, end: earliestEnd };
}

// ── MAIN: Calculate multi-user intersection ──────────────────────
// Returns: { commonSlots, leastConflictingSlots, registeredCount, externalCount }
//
// commonSlots: time windows where ALL registered participants are free
// leastConflictingSlots: if commonSlots is empty, slots ranked by fewest conflicts
//
// Privacy: No meeting titles/details are ever included in the output.
export async function calculateMultiUserAvailability(participantEmails, dateStr, organizerUser, desiredDurationMins = 30) {
  const constraints = await fetchUserConstraints(participantEmails, dateStr, organizerUser);

  const registeredCount = constraints.length;
  const externalCount = participantEmails.filter(e => {
    if (!e.includes('@')) return true;
    return !constraints.some(c => c.email.toLowerCase() === e.toLowerCase());
  }).length;

  // ── Step 1: Find the common work window ──
  const commonWindow = getCommonWorkWindow(constraints);

  // If the common window is invalid (no overlap), return empty
  if (commonWindow.end.diff(commonWindow.start, 'minutes') < desiredDurationMins) {
    return {
      commonSlots: [],
      leastConflictingSlots: [],
      registeredCount,
      externalCount,
      noOverlap: true,
      constraints // for reporting which users cause the issue
    };
  }

  // ── Step 2: Merge ALL busy blocks from ALL participants ──
  const allBusyBlocks = [];
  for (const c of constraints) {
    allBusyBlocks.push(...c.busyBlocks);
  }
  const mergedAllBusy = mergeBlocks(allBusyBlocks);

  // ── Step 3: Find slots where ALL are free ──
  const rawCommonSlots = findFreeSlots(commonWindow.start, commonWindow.end, mergedAllBusy, desiredDurationMins);

  // Convert to discrete time slots (every 15 min increment within free windows)
  const commonSlots = discretizeSlots(rawCommonSlots, desiredDurationMins, commonWindow.end);

  // ── Step 4: If no common slots, find "least conflicting" ──
  let leastConflictingSlots = [];
  if (commonSlots.length === 0 && constraints.length > 1) {
    leastConflictingSlots = findLeastConflictingSlots(
      constraints, commonWindow, desiredDurationMins
    );
  }

  return {
    commonSlots,
    leastConflictingSlots,
    registeredCount,
    externalCount,
    noOverlap: false,
    constraints
  };
}

// ── Discretize free windows into bookable time slots ─────────────
function discretizeSlots(freeWindows, durationMins, hardEnd) {
  const slots = [];
  const STEP = 15; // 15-minute increments
  // Any slot starting less than 5 minutes from now is already effectively in the past.
  const minValidStart = moment.utc().add(5, 'minutes');

  for (const window of freeWindows) {
    let cursor = window.start.clone();
    const windowEnd = moment.min(window.end, hardEnd);

    while (cursor.clone().add(durationMins, 'minutes').isSameOrBefore(windowEnd)) {
      // Only include slots that start in the future
      if (cursor.isSameOrAfter(minValidStart)) {
        slots.push({
          startUTC: cursor.clone(),
          endUTC: cursor.clone().add(durationMins, 'minutes')
        });
      }
      cursor.add(STEP, 'minutes');
    }
  }

  return slots;
}

// ── Find slots ranked by fewest conflicts ────────────────────────
// This generates candidate slots across the common work window,
// then counts how many participants have conflicts at each slot.
function findLeastConflictingSlots(constraints, commonWindow, durationMins) {
  const STEP = 15;
  const candidates = [];
  let cursor = commonWindow.start.clone();

  while (cursor.clone().add(durationMins, 'minutes').isSameOrBefore(commonWindow.end)) {
    const slotStart = cursor.clone();
    const slotEnd = cursor.clone().add(durationMins, 'minutes');

    let conflicts = 0;
    const conflictingUsers = [];

    for (const c of constraints) {
      // Check if this slot overlaps with any of this user's busy blocks
      const hasConflict = c.busyBlocks.some(b =>
        slotStart.isBefore(b.end) && slotEnd.isAfter(b.start)
      );
      if (hasConflict) {
        conflicts++;
        // Privacy: only expose name, never what they are doing
        conflictingUsers.push(c.name);
      }
    }

    // Only suggest slots where at least SOME people are free
    if (conflicts < constraints.length) {
      candidates.push({
        startUTC: slotStart,
        endUTC: slotEnd,
        conflicts,
        freeCount: constraints.length - conflicts,
        conflictingUsers // names only, no meeting details (privacy)
      });
    }

    cursor.add(STEP, 'minutes');
  }

  // Sort: fewest conflicts first, then by time
  candidates.sort((a, b) => a.conflicts - b.conflicts || a.startUTC - b.startUTC);

  return candidates.slice(0, 5); // top 5 options
}

// ── Helper: Convert UTC slot to a user's local time string ───────
export function slotToLocalTime(slotStartUTC, userTimezone) {
  const ianaZone = resolveTimezone(userTimezone);
  return slotStartUTC.clone().tz(ianaZone).format('HH:mm');
}

// ── Helper: Format time for display ──────────────────────────────
export function formatTime12(time24) {
  const [h, m] = time24.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return m === 0 ? `${hour} ${ampm}` : `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
}

// ── Single-user availability (backward compatible) ───────────────
// Used when a user asks "when am I free?" without specifying participants.
export function getAvailableSlotsForUser(meetings, dateStr, tz, buffer, startHour, startMin, endHour, endMin, breakStartStr, breakEndStr) {
  const ianaZone = resolveTimezone(tz);
  const slots = [];
  // Any slot starting less than 5 minutes from now is already in the past.
  const minValidStart = moment().add(5, 'minutes');

  // Build occupied blocks: meeting + buffer AFTER only
  const occupied = meetings
    .filter(m => m.status === 'scheduled')
    .map(m => ({
      start: moment.tz(`${m.date}T${m.startTime}`, ianaZone),
      end: moment.tz(`${m.date}T${m.startTime}`, ianaZone).add(m.duration, 'minutes').add(buffer, 'minutes')
    }))
    .sort((a, b) => a.start - b.start);

  // Add break as an occupied block
  if (breakStartStr && breakEndStr) {
    occupied.push({
      start: moment.tz(`${dateStr}T${breakStartStr}`, ianaZone),
      end: moment.tz(`${dateStr}T${breakEndStr}`, ianaZone)
    });
    occupied.sort((a, b) => a.start - b.start);
  }

  let cursor = moment.tz(`${dateStr}T${String(startHour).padStart(2, '0')}:${String(startMin).padStart(2, '0')}`, ianaZone);
  const dayEnd = moment.tz(`${dateStr}T${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`, ianaZone);

  for (const block of occupied) {
    if (cursor.isBefore(block.start)) {
      const gap = block.start.diff(cursor, 'minutes');
      // Only suggest slots that are in the future
      if (gap >= 15 && cursor.isSameOrAfter(minValidStart)) slots.push(cursor.format('HH:mm'));
    }
    if (block.end.isAfter(cursor)) cursor = block.end.clone();
  }
  if (cursor.isBefore(dayEnd)) {
    const gap = dayEnd.diff(cursor, 'minutes');
    // Only suggest slots that are in the future
    if (gap >= 15 && cursor.isSameOrAfter(minValidStart)) slots.push(cursor.format('HH:mm'));
  }
  return slots;
}

// ── Multi-Day Alternative Search ─────────────────────────────────
// Hunts for free slots across multiple days starting from anchorDate.
export async function findAlternativeSlots(emails, anchorDateStr, organizerUser, durationMins = 30) {
  const alternatives = [];
  let MAX_DAYS = 5;
  let currentDay = moment(anchorDateStr);

  for (let i = 0; i < MAX_DAYS; i++) {
    const dateStr = currentDay.format('YYYY-MM-DD');
    
    // Skip organizer's off days
    const orgIana = resolveTimezone(organizerUser.timezone || 'UTC');
    const dayOfWeek = moment.tz(`${dateStr}T12:00:00`, orgIana).day();
    if ((organizerUser.offDays || [0]).includes(dayOfWeek)) {
      currentDay.add(1, 'day');
      MAX_DAYS++;
      continue;
    }
    const result = await calculateMultiUserAvailability(emails, dateStr, organizerUser, durationMins);
    
    if (result.commonSlots.length > 0) {
      for (const slot of result.commonSlots) {
        alternatives.push({
          date: dateStr,
          time: slotToLocalTime(slot.startUTC, organizerUser.timezone || 'UTC'),
          label: `${dateStr === moment().format('YYYY-MM-DD') ? 'Today' : currentDay.format('ddd')} at ${formatTime12(slotToLocalTime(slot.startUTC, organizerUser.timezone || 'UTC'))}`
        });
        if (alternatives.length >= 3) break;
      }
    }
    
    if (alternatives.length >= 3) break;
    currentDay.add(1, 'day');
  }

  return alternatives.slice(0, 3);
}

// ── Specific Slot Validation ─────────────────────────────────────
// Validates an exact date and time against all constraints
// Returns an array of conflicts, e.g., [{ name: 'Alex', reason: 'on break' }]
export async function validateSpecificSlot(participantEmails, dateStr, startTimeStr, durationMins, organizerUser) {
  const constraints = await fetchUserConstraints(participantEmails, dateStr, organizerUser);
  const conflicts = [];
  
  const orgIanaZone = resolveTimezone(organizerUser.timezone || 'UTC');
  const reqStartUTC = moment.tz(`${dateStr}T${startTimeStr}`, orgIanaZone).utc();
  const reqEndUTC = reqStartUTC.clone().add(durationMins, 'minutes');

  // Verify the slot is in the future
  if (reqStartUTC.isBefore(moment().utc())) {
    return [{ name: 'System', reason: 'in the past' }];
  }

  for (const c of constraints) {
    // Check 0: Day Off
    const dayOfWeek = moment.tz(`${dateStr}T${startTimeStr}`, orgIanaZone).day();
    if (c.offDays?.includes(dayOfWeek)) {
      conflicts.push({ name: c.name, reason: 'on a day off' });
      continue;
    }

    // Check 1: Outside working hours
    if (reqStartUTC.isBefore(c.workStart) || reqEndUTC.isAfter(c.workEnd)) {
      conflicts.push({ name: c.name, reason: 'outside working hours' });
      continue;
    }

    // Check 2: Busy blocks (meetings and breaks)
    const conflictingBlock = c.busyBlocks.find(b =>
      reqStartUTC.isBefore(b.end) && reqEndUTC.isAfter(b.start)
    );

    if (conflictingBlock) {
      conflicts.push({ name: c.name, reason: conflictingBlock.type || 'busy' });
    }
  }

  return conflicts;
}
