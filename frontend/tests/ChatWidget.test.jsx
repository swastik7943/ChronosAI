/**
 * Unit Tests: ChatWidget Component
 *
 * Tests: initial render, welcome message, suggested action chips,
 *        send button disabled state, input handling
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ChatWidget from '../src/components/Chat/ChatWidget.jsx';

// Mock axios to prevent actual HTTP calls
vi.mock('axios', () => ({
  default: {
    post: vi.fn()
  }
}));

// Import the mocked axios for control
import axios from 'axios';

function renderChat(onMeetingsChange = vi.fn()) {
  return render(<ChatWidget token="test-token" onMeetingsChange={onMeetingsChange} />);
}

describe('ChatWidget — Initial Render', () => {
  it('renders the Chronos AI header', () => {
    renderChat();
    expect(screen.getByText(/Chronos AI/i)).toBeInTheDocument();
  });

  it('displays the welcome message from the bot', () => {
    renderChat();
    expect(screen.getByText(/your AI scheduling assistant/i)).toBeInTheDocument();
  });

  it('renders the message input field', () => {
    renderChat();
    expect(screen.getByPlaceholderText(/Ask me anything/i)).toBeInTheDocument();
  });
});

describe('ChatWidget — Quick Action Bar', () => {
  it('renders the Schedule quick action button', () => {
    renderChat();
    expect(screen.getByText('Schedule')).toBeInTheDocument();
  });

  it('renders the My Meetings quick action button', () => {
    renderChat();
    expect(screen.getByText('My Meetings')).toBeInTheDocument();
  });

  it('renders the Free Slots quick action button', () => {
    renderChat();
    expect(screen.getByText('Free Slots')).toBeInTheDocument();
  });

  it('renders the Cancel quick action button', () => {
    renderChat();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });
});

describe('ChatWidget — Send Button State', () => {
  it('disables the send button when input is empty', () => {
    renderChat();
    const sendBtn = screen.getByRole('button', { name: '' }); // Send icon button
    // Button should be present — check submit button is disabled when input empty
    const input = screen.getByPlaceholderText(/Ask me anything/i);
    expect(input.value).toBe('');
    // The send button should have disabled attribute when input is empty
    const form = input.closest('form');
    const submitBtn = form.querySelector('button[type="submit"]');
    expect(submitBtn).toBeDisabled();
  });

  it('enables the send button when input has text', () => {
    renderChat();
    const input = screen.getByPlaceholderText(/Ask me anything/i);
    fireEvent.change(input, { target: { value: 'Schedule a meeting' } });

    const form = input.closest('form');
    const submitBtn = form.querySelector('button[type="submit"]');
    expect(submitBtn).not.toBeDisabled();
  });
});

describe('ChatWidget — Message Sending', () => {
  beforeEach(() => {
    axios.post.mockResolvedValue({
      data: {
        reply: 'Sure! With whom?',
        sessionId: 'session-abc',
        suggestedActions: ['Alice', 'Bob']
      }
    });
  });

  it('displays the user message after sending', async () => {
    renderChat();
    const input = screen.getByPlaceholderText(/Ask me anything/i);
    fireEvent.change(input, { target: { value: 'Schedule a meeting' } });

    const form = input.closest('form');
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText('Schedule a meeting')).toBeInTheDocument();
    });
  });

  it('displays bot reply after API responds', async () => {
    renderChat();
    const input = screen.getByPlaceholderText(/Ask me anything/i);
    fireEvent.change(input, { target: { value: 'Hi' } });
    const form = input.closest('form');
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText('Sure! With whom?')).toBeInTheDocument();
    });
  });

  it('clears the input field after sending', async () => {
    renderChat();
    const input = screen.getByPlaceholderText(/Ask me anything/i);
    fireEvent.change(input, { target: { value: 'Test message' } });
    const form = input.closest('form');
    fireEvent.submit(form);

    await waitFor(() => {
      expect(input.value).toBe('');
    });
  });

  it('shows suggested action chips from bot reply', async () => {
    renderChat();
    const input = screen.getByPlaceholderText(/Ask me anything/i);
    fireEvent.change(input, { target: { value: 'Schedule' } });
    const form = input.closest('form');
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('Bob')).toBeInTheDocument();
    });
  });

  it('shows error message on API failure', async () => {
    axios.post.mockRejectedValue(new Error('Network error'));

    renderChat();
    const input = screen.getByPlaceholderText(/Ask me anything/i);
    fireEvent.change(input, { target: { value: 'Fail message' } });
    const form = input.closest('form');
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText(/Sorry, I encountered an error/i)).toBeInTheDocument();
    });
  });
});
