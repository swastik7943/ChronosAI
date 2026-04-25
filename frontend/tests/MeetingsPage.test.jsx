/**
 * Unit Tests: MeetingsPage Component
 *
 * Tests: empty state, meeting list rendering, filter logic,
 *        participant count display, status badges
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import MeetingsPage from '../src/pages/MeetingsPage.jsx';

// Mock axios
vi.mock('axios', () => ({
  default: {
    get: vi.fn()
  }
}));

import axios from 'axios';

// Helper: create a mock meeting
function mockMeeting(overrides = {}) {
  const today = new Date().toISOString().split('T')[0]; // always today so it passes 'today' filter

  return {
    _id: `meeting-${Math.random()}`,
    title: 'Team Sync',
    date: today,
    startTime: '23:00', // late evening so it's always "upcoming" regardless of test time
    duration: 30,
    participants: ['alice@test.com'],
    jitsiRoom: 'chronosai-abc123',
    status: 'scheduled',
    ...overrides
  };
}

function renderMeetingsPage() {
  return render(
    <BrowserRouter>
      <MeetingsPage token="test-token" />
    </BrowserRouter>
  );
}

describe('MeetingsPage — Empty State', () => {
  it('shows empty state when there are no meetings', async () => {
    axios.get.mockResolvedValue({ data: [] });
    renderMeetingsPage();

    await waitFor(() => {
      expect(screen.getByText(/No meetings for this filter/i)).toBeInTheDocument();
    });
  });
});

describe('MeetingsPage — Meeting List', () => {
  it('displays meeting titles from the API response', async () => {
    axios.get.mockResolvedValue({
      data: [mockMeeting({ title: 'Product Review' })]
    });
    renderMeetingsPage();

    await waitFor(() => {
      expect(screen.getByText('Product Review')).toBeInTheDocument();
    });
  });

  it('shows participant count for meetings with participants', async () => {
    axios.get.mockResolvedValue({
      data: [mockMeeting({ participants: ['a@test.com', 'b@test.com'] })]
    });
    renderMeetingsPage();

    await waitFor(() => {
      expect(screen.getByText(/2 participants/i)).toBeInTheDocument();
    });
  });

  it('shows "Join" button for scheduled meetings with a jitsiRoom', async () => {
    const today = new Date().toISOString().split('T')[0];
    axios.get.mockResolvedValue({
      data: [mockMeeting({ date: today, status: 'scheduled', jitsiRoom: 'chronosai-room' })]
    });
    renderMeetingsPage();

    await waitFor(() => {
      expect(screen.getByText('Join')).toBeInTheDocument();
    });
  });
});

describe('MeetingsPage — Meeting Count', () => {
  it('displays the count of filtered meetings', async () => {
    axios.get.mockResolvedValue({
      data: [
        mockMeeting({ title: 'Meeting 1' }),
        mockMeeting({ title: 'Meeting 2' })
      ]
    });
    renderMeetingsPage();

    await waitFor(() => {
      expect(screen.getByText(/2 meetings/i)).toBeInTheDocument();
    });
  });

  it('displays singular "meeting" for 1 meeting count (all upcoming filter)', async () => {
    // Use 'all upcoming' returns all non-canceled future meetings regardless of date
    const todayMeeting = {
      _id: `meeting-today`,
      title: 'Solo Meeting',
      date: new Date().toISOString().split('T')[0], // today
      startTime: '23:59',
      duration: 30,
      participants: [],
      jitsiRoom: null,
      status: 'scheduled'
    };
    axios.get.mockResolvedValue({ data: [todayMeeting] });
    renderMeetingsPage();

    await waitFor(() => {
      expect(screen.getByText(/1 meeting/i)).toBeInTheDocument();
    });
  });
});

describe('MeetingsPage — Filters', () => {
  it('renders filter tabs', () => {
    axios.get.mockResolvedValue({ data: [] });
    renderMeetingsPage();

    expect(screen.getByText('Today')).toBeInTheDocument();
    expect(screen.getByText('This Week')).toBeInTheDocument();
    expect(screen.getByText('This Month')).toBeInTheDocument();
    expect(screen.getByText('All Upcoming')).toBeInTheDocument();
    expect(screen.getByText('Ended')).toBeInTheDocument();
  });

  it('switches the active filter when a tab is clicked', async () => {
    axios.get.mockResolvedValue({ data: [] });
    renderMeetingsPage();

    const weekFilter = screen.getByText('This Week');
    fireEvent.click(weekFilter);
    expect(weekFilter.className).toMatch(/indigo|active|selected/i);
  });
});
