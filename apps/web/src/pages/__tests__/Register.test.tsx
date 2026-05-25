import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Register from '../Register.js';

/* ── Mock useAuth ────────────────────────────────────── */

const mockRegister = vi.fn();
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

function renderRegister() {
  return render(
    <MemoryRouter initialEntries={['/register']}>
      <Register />
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
    login: vi.fn(),
    register: mockRegister,
    logout: vi.fn(),
  });
});

/* ── Tests ───────────────────────────────────────────── */

describe('Register Page', () => {
  it('renders the registration form with all fields', () => {
    renderRegister();

    expect(screen.getByTestId('register-page')).toBeInTheDocument();
    expect(screen.getByLabelText('Prénom')).toBeInTheDocument();
    expect(screen.getByLabelText('Nom')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Mot de passe')).toBeInTheDocument();
    expect(screen.getByLabelText(/Téléphone/)).toBeInTheDocument();
    expect(screen.getByTestId('submit-btn')).toBeInTheDocument();
  });

  it('renders brand and login link', () => {
    renderRegister();

    expect(screen.getByText('MarchéLink')).toBeInTheDocument();
    expect(screen.getByText('Se connecter')).toBeInTheDocument();
  });

  it('shows validation errors on blur with empty required fields', async () => {
    renderRegister();
    const user = userEvent.setup();

    const firstNameInput = screen.getByLabelText('Prénom');
    await user.click(firstNameInput);
    await user.tab();

    await waitFor(() => {
      expect(screen.getByTestId('error-first_name').textContent).not.toBe('');
    });
  });

  it('shows Zod errors on submit with incomplete form', async () => {
    renderRegister();
    const user = userEvent.setup();

    await user.click(screen.getByTestId('submit-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('error-first_name').textContent).not.toBe('');
      expect(screen.getByTestId('error-last_name').textContent).not.toBe('');
      expect(screen.getByTestId('error-email').textContent).not.toBe('');
      expect(screen.getByTestId('error-password').textContent).not.toBe('');
    });

    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('shows password min-length error for short password', async () => {
    renderRegister();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Mot de passe'), 'short');
    await user.tab();

    await waitFor(() => {
      expect(screen.getByTestId('error-password').textContent).toContain('8 caractères');
    });
  });

  it('calls register with valid data and disables button', async () => {
    mockRegister.mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 100)),
    );

    renderRegister();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Prénom'), 'Kouadio');
    await user.type(screen.getByLabelText('Nom'), 'Yao');
    await user.type(screen.getByLabelText('Email'), 'k@marchelink.ci');
    await user.type(screen.getByLabelText('Mot de passe'), 'SecurePass1!');
    await user.click(screen.getByTestId('submit-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('submit-btn')).toBeDisabled();
    });

    expect(mockRegister).toHaveBeenCalledWith({
      first_name: 'Kouadio',
      last_name: 'Yao',
      email: 'k@marchelink.ci',
      password: 'SecurePass1!',
      phone: '',
    });
  });

  it('displays API error on registration failure', async () => {
    const { ApiError } = await import('../../api/client.js');
    mockRegister.mockRejectedValueOnce(
      new ApiError(422, 'VALIDATION_ERROR', 'Email already registered'),
    );

    renderRegister();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Prénom'), 'Kouadio');
    await user.type(screen.getByLabelText('Nom'), 'Yao');
    await user.type(screen.getByLabelText('Email'), 'dup@test.ci');
    await user.type(screen.getByLabelText('Mot de passe'), 'SecurePass1!');
    await user.click(screen.getByTestId('submit-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('api-error')).toBeInTheDocument();
      expect(screen.getByTestId('api-error').textContent).toContain('Email already registered');
    });
  });

  it('re-enables submit button after error', async () => {
    const { ApiError } = await import('../../api/client.js');
    mockRegister.mockRejectedValueOnce(
      new ApiError(422, 'VALIDATION_ERROR', 'Email already registered'),
    );

    renderRegister();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Prénom'), 'Kouadio');
    await user.type(screen.getByLabelText('Nom'), 'Yao');
    await user.type(screen.getByLabelText('Email'), 'dup@test.ci');
    await user.type(screen.getByLabelText('Mot de passe'), 'SecurePass1!');
    await user.click(screen.getByTestId('submit-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('submit-btn')).not.toBeDisabled();
    });
  });

  it('does not validate optional phone when empty on blur', async () => {
    renderRegister();
    const user = userEvent.setup();

    const phoneInput = screen.getByLabelText(/Téléphone/);
    await user.click(phoneInput);
    await user.tab();

    // No error should appear for optional empty phone
    expect(screen.getByTestId('error-phone').textContent).toBe('');
  });
});
