/**
 * Unit Tests: Login / Register Component
 *
 * Tests: renders login form, renders register form, form toggle,
 *        input field handling, form submission
 *
 * NOTE: The Login component uses label text (no placeholders),
 *       so we query by role 'textbox' and label text rather than placeholder.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Login from '../src/pages/Login.jsx';

vi.mock('axios', () => ({
  default: {
    post: vi.fn()
  }
}));

import axios from 'axios';

function renderLogin(onLogin = vi.fn()) {
  return render(
    <BrowserRouter>
      <Login onLogin={onLogin} />
    </BrowserRouter>
  );
}

describe('Login — Initial Render (Sign In mode)', () => {
  it('renders the Email label', () => {
    renderLogin();
    expect(screen.getByText(/^Email$/i)).toBeInTheDocument();
  });

  it('renders the Password label', () => {
    renderLogin();
    expect(screen.getByText(/^Password$/i)).toBeInTheDocument();
  });

  it('renders the Sign In button', () => {
    renderLogin();
    expect(screen.getByRole('button', { name: /Sign In/i })).toBeInTheDocument();
  });

  it('does not show the Name label in login mode', () => {
    renderLogin();
    expect(screen.queryByText(/^Name$/)).not.toBeInTheDocument();
  });

  it('renders the "Sign up" toggle link', () => {
    renderLogin();
    expect(screen.getByRole('button', { name: /Sign up/i })).toBeInTheDocument();
  });
});

describe('Login — Toggle to Register Mode', () => {
  it('shows the Name label after switching to Register', () => {
    renderLogin();
    const signUpBtn = screen.getByRole('button', { name: /Sign up/i });
    fireEvent.click(signUpBtn);
    expect(screen.getByText(/^Name$/)).toBeInTheDocument();
  });

  it('shows a Sign Up submit button in register mode', () => {
    renderLogin();
    const toggleBtn = screen.getByRole('button', { name: /Sign up/i });
    fireEvent.click(toggleBtn);
    expect(screen.getByRole('button', { name: /Sign Up/i })).toBeInTheDocument();
  });

  it('can toggle back to login mode from register', () => {
    renderLogin();
    // Switch to register
    fireEvent.click(screen.getByRole('button', { name: /Sign up/i }));
    // Switch back to login
    const signInLink = screen.getByRole('button', { name: /Sign in/i });
    fireEvent.click(signInLink);
    // Should see Sign In mode again (no Name label)
    expect(screen.queryByText(/^Name$/)).not.toBeInTheDocument();
  });
});

describe('Login — Input Fields', () => {
  it('updates email input on user typing', () => {
    renderLogin();
    // Find email input by type
    const emailInput = screen.getByRole('textbox'); // only one textbox in login mode
    fireEvent.change(emailInput, { target: { value: 'test@email.com' } });
    expect(emailInput.value).toBe('test@email.com');
  });

  it('updates password input on user typing', () => {
    renderLogin();
    // Password input has type="password" — use querySelector
    const passwordInput = document.querySelector('input[type="password"]');
    fireEvent.change(passwordInput, { target: { value: 'mypassword' } });
    expect(passwordInput.value).toBe('mypassword');
  });
});

describe('Login — Form Submission', () => {
  it('calls the API on login form submit', async () => {
    axios.post.mockResolvedValue({ data: { name: 'Alice' } });

    renderLogin();
    const emailInput = screen.getByRole('textbox');
    const passwordInput = document.querySelector('input[type="password"]');

    fireEvent.change(emailInput, { target: { value: 'alice@test.com' } });
    fireEvent.change(passwordInput, { target: { value: 'pass123' } });
    fireEvent.click(screen.getByRole('button', { name: /Sign In/i }));

    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/api/auth/login'),
        expect.objectContaining({ email: 'alice@test.com' })
      );
    });
  });
});
