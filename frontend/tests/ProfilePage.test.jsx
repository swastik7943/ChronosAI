/**
 * Unit Tests: ProfilePage Component
 *
 * Tests: initial loading state, form fields render, Google connect/disconnect
 *        button state, settings save feedback
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import ProfilePage from '../src/pages/ProfilePage.jsx';

vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
    put: vi.fn(),
    post: vi.fn()
  }
}));

import axios from 'axios';

function mockProfile(overrides = {}) {
  return {
    name: 'Jane Doe',
    email: 'jane@test.com',
    timezone: 'UTC',
    bufferTime: 0,
    workingHoursStart: '09:00',
    workingHoursEnd: '18:00',
    breakStart: '13:00',
    breakEnd: '14:00',
    googleId: null,
    avatar: null,
    ...overrides
  };
}

function renderProfile(profile = mockProfile()) {
  axios.get.mockResolvedValue({ data: profile });
  return render(
    <BrowserRouter>
      <ProfilePage token="test-token" />
    </BrowserRouter>
  );
}

describe('ProfilePage — Initial Load', () => {
  it('shows a loading spinner before data arrives', () => {
    // Mock a delayed response
    axios.get.mockReturnValue(new Promise(() => {})); // never resolves
    render(
      <BrowserRouter>
        <ProfilePage token="test-token" />
      </BrowserRouter>
    );
    // There should be some loading indicator (spinner or similar)
    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('renders user name after data loads', async () => {
    renderProfile();
    await waitFor(() => {
      expect(screen.getByDisplayValue('Jane Doe')).toBeInTheDocument();
    });
  });

  it('renders the user email', async () => {
    renderProfile();
    await waitFor(() => {
      expect(screen.getByText('jane@test.com')).toBeInTheDocument();
    });
  });
});

describe('ProfilePage — Settings Form', () => {
  it('renders the Timezone dropdown', async () => {
    renderProfile();
    await waitFor(() => {
      expect(screen.getByText(/Timezone/i)).toBeInTheDocument();
    });
  });

  it('renders Working Hours fields', async () => {
    renderProfile();
    await waitFor(() => {
      expect(screen.getByText(/Working Hours/i)).toBeInTheDocument();
    });
  });

  it('renders Post-Meeting Buffer slider', async () => {
    renderProfile();
    await waitFor(() => {
      expect(screen.getByText(/Post-Meeting Buffer/i)).toBeInTheDocument();
    });
  });

  it('renders the Save Changes button', async () => {
    renderProfile();
    await waitFor(() => {
      expect(screen.getByText(/Save Changes/i)).toBeInTheDocument();
    });
  });
});

describe('ProfilePage — Google Integration', () => {
  it('shows "Connect Google Calendar" when not connected', async () => {
    renderProfile(mockProfile({ googleId: null }));
    await waitFor(() => {
      expect(screen.getByText(/Connect Google Calendar/i)).toBeInTheDocument();
    });
  });

  it('shows "Google Calendar Connected" status when connected', async () => {
    renderProfile(mockProfile({ googleId: 'gid-xyz' }));
    await waitFor(() => {
      expect(screen.getByText(/Google Calendar Connected/i)).toBeInTheDocument();
    });
  });

  it('shows "Disconnect" link when Google is connected', async () => {
    renderProfile(mockProfile({ googleId: 'gid-xyz' }));
    await waitFor(() => {
      expect(screen.getByText(/Disconnect Google Calendar/i)).toBeInTheDocument();
    });
  });
});

describe('ProfilePage — Save Feedback', () => {
  it('shows "Saved!" confirmation after successful save', async () => {
    axios.put.mockResolvedValue({ data: { user: mockProfile() } });
    renderProfile();

    await waitFor(() => screen.getByText(/Save Changes/i));
    const saveBtn = screen.getByText(/Save Changes/i);
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(screen.getByText(/Saved!/i)).toBeInTheDocument();
    });
  });
});
