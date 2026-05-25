import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Login from '../Login.js';

/* ── Mock useAuth ────────────────────────────────────── */

const mockLogin = vi.fn();
const mockUseAuth = vi.fn();

vi.mock('../../hooks/useAuth.js', () => ({
  useAuth: () => mockUseAuth(),
}));

/* ── Mock ApiError ───────────────────────────────────── */

vi.mock('../../api/client.js', () => ({
  ApiError: class ApiError extends Error {
    status: number;
    code: string;
    constructor(status: number, code: string, message: string) {
      super(message);
      this.status = status;
      this.code = code;
      this.name = 'ApiError';
    }
  },
}));

/* ── Helpers ─────────────────────────────────────────── */

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <Login />
    </MemoryRouter>,
  );
}

/* ── Setup ───────────────────────────────────────────── */

beforeEach(() => {
  vi.clearAllMocks();
  mockUseAuth.mockReturnValue({
    user: null,
    loading: false,
    error: null,
    isAuthenticated: false,
    login: mockLogin,
    register: vi.fn(),
    logout: vi.fn(),
  });
});

/* ── Tests ───────────────────────────────────────────── */

describe('Login Page', () => {
  it('renders the login form with all fields', () => {
    renderLogin();

    expect(screen.getByTestId('login-page')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Mot de passe')).toBeInTheDocument();
    expect(screen.getByTestId('submit-btn')).toBeInTheDocument();
    expect(screen.getByText('Connexion')).toBeInTheDocument();
  });

  it('renders brand and navigation links', () => {
    renderLogin();

    expect(screen.getByText('MarchéLink')).toBeInTheDocument();
    expect(screen.getByText('Créer un compte')).toBeInTheDocument();
  });

  it('shows validation errors on blur with empty fields', async () => {
    renderLogin();
    const user = userEvent.setup();

    const emailInput = screen.getByLabelText('Email');
    await user.click(emailInput);
    await user.tab();

    await waitFor(() => {
      expect(screen.getByTestId('error-email').textContent).not.toBe('');
    });
  });

  it('shows Zod validation errors on submit with invalid data', async () => {
    renderLogin();
    const user = userEvent.setup();

    await user.click(screen.getByTestId('submit-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('error-email').textContent).not.toBe('');
      expect(screen.getByTestId('error-password').textContent).not.toBe('');
    });

    // login should NOT be called
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('calls login with valid data and disables button during submission', async () => {
    mockLogin.mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 100)),
    );

    renderLogin();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Email'), 'kouadio@test.ci');
    await user.type(screen.getByLabelText('Mot de passe'), 'SecurePass1!');
    await user.click(screen.getByTestId('submit-btn'));

    // Button should be disabled during loading
    await waitFor(() => {
      expect(screen.getByTestId('submit-btn')).toBeDisabled();
    });

    expect(mockLogin).toHaveBeenCalledWith({
      email: 'kouadio@test.ci',
      password: 'SecurePass1!',
    });
  });

  it('displays API error message on login failure', async () => {
    const { ApiError } = await import('../../api/client.js');
    mockLogin.mockRejectedValueOnce(
      new ApiError(404, 'NOT_FOUND', 'Invalid credentials'),
    );

    renderLogin();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Email'), 'bad@test.ci');
    await user.type(screen.getByLabelText('Mot de passe'), 'WrongPass1!');
    await user.click(screen.getByTestId('submit-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('api-error')).toBeInTheDocument();
      expect(screen.getByTestId('api-error').textContent).toContain('Invalid credentials');
    });
  });

  it('re-enables submit button after error', async () => {
    const { ApiError } = await import('../../api/client.js');
    mockLogin.mockRejectedValueOnce(
      new ApiError(404, 'NOT_FOUND', 'Invalid credentials'),
    );

    renderLogin();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Email'), 'bad@test.ci');
    await user.type(screen.getByLabelText('Mot de passe'), 'WrongPass1!');
    await user.click(screen.getByTestId('submit-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('submit-btn')).not.toBeDisabled();
    });
  });
});
