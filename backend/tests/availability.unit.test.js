/**
 * Unit Tests: availability.js utility
 *
 * These tests exercise the pure, deterministic functions of the availability
 * engine without touching MongoDB. DB-dependent functions (fetchUserConstraints,
 * calculateMultiUserAvailability) are covered in integration tests.
 */

import moment from 'moment-timezone';
import {
  resolveTimezone,
  formatTime12,
  slotToLocalTime,
  getAvailableSlotsForUser
} from '../src/utils/availability.js';

// ── resolveTimezone ───────────────────────────────────────────────
describe('resolveTimezone()', () => {
  it('maps IST abbreviation to Asia/Kolkata', () => {
    expect(resolveTimezone('IST')).toBe('Asia/Kolkata');
  });

  it('maps PST to America/Los_Angeles', () => {
    expect(resolveTimezone('PST')).toBe('America/Los_Angeles');
  });

  it('maps EST to America/New_York', () => {
    expect(resolveTimezone('EST')).toBe('America/New_York');
  });

  it('passes through a valid IANA zone unchanged', () => {
    expect(resolveTimezone('Europe/London')).toBe('Europe/London');
  });

  it('defaults to UTC for undefined input', () => {
    expect(resolveTimezone(undefined)).toBe('UTC');
  });

  it('defaults to UTC for empty string', () => {
    expect(resolveTimezone('')).toBe('UTC');
  });

  it('passes through an unknown zone as-is (moment will validate it)', () => {
    expect(resolveTimezone('Some/Unknown')).toBe('Some/Unknown');
  });
});

// ── formatTime12 ──────────────────────────────────────────────────
describe('formatTime12()', () => {
  it('formats midnight correctly', () => {
    expect(formatTime12('00:00')).toBe('12 AM');
  });

  it('formats noon correctly', () => {
    expect(formatTime12('12:00')).toBe('12 PM');
  });

  it('formats 9 AM correctly', () => {
    expect(formatTime12('09:00')).toBe('9 AM');
  });

  it('formats 6 PM correctly', () => {
    expect(formatTime12('18:00')).toBe('6 PM');
  });

  it('formats 2:30 PM correctly', () => {
    expect(formatTime12('14:30')).toBe('2:30 PM');
  });

  it('formats 11:59 PM correctly', () => {
    expect(formatTime12('23:59')).toBe('11:59 PM');
  });

  it('formats 1:00 AM correctly', () => {
    expect(formatTime12('01:00')).toBe('1 AM');
  });
});

// ── slotToLocalTime ───────────────────────────────────────────────
describe('slotToLocalTime()', () => {
  it('converts UTC 12:00 to IST (UTC+5:30 = 17:30)', () => {
    const utcMoment = moment.utc('2025-06-01T12:00:00');
    const result = slotToLocalTime(utcMoment, 'IST');
    expect(result).toBe('17:30');
  });

  it('converts UTC 12:00 to EST (UTC-5 = 07:00)', () => {
    // Note: non-DST period
    const utcMoment = moment.utc('2025-01-15T12:00:00');
    const result = slotToLocalTime(utcMoment, 'EST');
    expect(result).toBe('07:00');
  });

  it('converts UTC 00:00 to UTC stays 00:00', () => {
    const utcMoment = moment.utc('2025-06-01T00:00:00');
    const result = slotToLocalTime(utcMoment, 'UTC');
    expect(result).toBe('00:00');
  });

  it('converts UTC 06:30 to IST gives 12:00', () => {
    const utcMoment = moment.utc('2025-06-01T06:30:00');
    const result = slotToLocalTime(utcMoment, 'IST');
    expect(result).toBe('12:00');
  });
});

// ── getAvailableSlotsForUser ──────────────────────────────────────
describe('getAvailableSlotsForUser()', () => {
  const DATE = '2027-06-01';
  const TZ = 'UTC';

  it('returns morning, afternoon slots when calendar is empty', () => {
    const slots = getAvailableSlotsForUser(
      [], DATE, TZ, 0,
      9, 0, 17, 0,
      '13:00', '14:00'
    );
    // Should return 9:00 and 14:00 at minimum (split by break)
    expect(slots.length).toBeGreaterThanOrEqual(2);
    expect(slots[0]).toBe('09:00');
  });

  it('excludes break time from available slots', () => {
    const slots = getAvailableSlotsForUser(
      [], DATE, TZ, 0,
      9, 0, 17, 0,
      '13:00', '14:00'
    );
    // 13:00 should NOT appear (it's break)
    expect(slots).not.toContain('13:00');
    expect(slots).not.toContain('13:30');
  });

  it('accounts for post-meeting buffer in conflict detection', () => {
    // Meeting from 09:00 for 30 min, plus 30 min buffer = 10:00 blocked
    const meetings = [{
      date: DATE,
      startTime: '09:00',
      duration: 30,
      status: 'scheduled'
    }];
    const slots = getAvailableSlotsForUser(
      meetings, DATE, TZ, 30, // 30 min buffer
      9, 0, 12, 0,
      null, null
    );
    // First available slot should be at 10:00 (09:00 meeting + 30 min + 30 min buffer)
    expect(slots[0]).toBe('10:00');
  });

  it('does not include canceled meetings in busy blocks', () => {
    const meetings = [{
      date: DATE,
      startTime: '09:00',
      duration: 60,
      status: 'canceled' // should be ignored
    }];
    const slots = getAvailableSlotsForUser(
      meetings, DATE, TZ, 0,
      9, 0, 12, 0,
      null, null
    );
    expect(slots[0]).toBe('09:00');
  });

  it('handles timezone-aware conversion (IST)', () => {
    // IST is UTC+5:30
    // Work 09:00–17:00 IST  →  03:30–11:30 UTC internally
    // The returned slots are in IST (HH:mm in local)
    const slots = getAvailableSlotsForUser(
      [], DATE, 'IST', 0,
      9, 0, 17, 0,
      '13:00', '14:00'
    );
    expect(slots.length).toBeGreaterThan(0);
    expect(slots[0]).toBe('09:00');
  });

  it('returns empty when work window is fully occupied', () => {
    const meetings = [{
      date: DATE,
      startTime: '09:00',
      duration: 180, // 3 hour meeting = 09:00–12:00, covers full window
      status: 'scheduled'
    }];
    const slots = getAvailableSlotsForUser(
      meetings, DATE, TZ, 0,
      9, 0, 12, 0,
      null, null
    );
    expect(slots.length).toBe(0);
  });
});
