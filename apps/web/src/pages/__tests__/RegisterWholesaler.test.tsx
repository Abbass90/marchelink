import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import RegisterWholesaler from '../RegisterWholesaler.js';

const mockRegisterWholesaler = vi.fn();
const mockUseAuth = vi.fn();

vi.mock('../../hooks/useAuth.js', () => ({
  useAuth: () => mockUseAuth(),
}));

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

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/register-wholesaler']}>
      <RegisterWholesaler />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUseAuth.mockReturnValue({
    user: null,
    loading: false,
    error: null,
    isAuthenticated: false,
    login: vi.fn(),
    register: vi.fn(),
    registerWholesaler: mockRegisterWholesaler,
    logout: vi.fn(),
  });
});

describe('RegisterWholesaler Page', () => {
  it('renders the form with organization_name field', () => {
    renderPage();

    expect(screen.getByTestId('register-wholesaler-page')).toBeInTheDocument();
    expect(screen.getByLabelText("Nom de l'entreprise")).toBeInTheDocument();
    expect(screen.getByLabelText('Prénom')).toBeInTheDocument();
    expect(screen.getByLabelText('Nom')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Mot de passe')).toBeInTheDocument();
    expect(screen.getByLabelText(/Téléphone/)).toBeInTheDocument();
    expect(screen.getByTestId('submit-btn')).toBeInTheDocument();
  });

  it('renders cross-links to buyer registration and login', () => {
    renderPage();

    expect(screen.getByText('Inscription boutiquier')).toBeInTheDocument();
    expect(screen.getByText('Se connecter')).toBeInTheDocument();
  });

  it('shows validation errors on blur with empty required fields', async () => {
    renderPage();
    const user = userEvent.setup();

    const orgInput = screen.getByLabelText("Nom de l'entreprise");
    await user.click(orgInput);
    await user.tab();

    await waitFor(() => {
      expect(screen.getByTestId('error-organization_name').textContent).not.toBe('');
    });
  });

  it('shows Zod errors on submit with incomplete form', async () => {
    renderPage();
    const user = userEvent.setup();

    await user.click(screen.getByTestId('submit-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('error-organization_name').textContent).not.toBe('');
      expect(screen.getByTestId('error-first_name').textContent).not.toBe('');
      expect(screen.getByTestId('error-email').textContent).not.toBe('');
      expect(screen.getByTestId('error-password').textContent).not.toBe('');
    });

    expect(mockRegisterWholesaler).not.toHaveBeenCalled();
  });

  it('calls registerWholesaler with valid data and disables button', async () => {
    mockRegisterWholesaler.mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 100)),
    );

    renderPage();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Nom de l'entreprise"), "Tissus d'Aya");
    await user.type(screen.getByLabelText('Prénom'), 'Aya');
    await user.type(screen.getByLabelText('Nom'), 'Koné');
    await user.type(screen.getByLabelText('Email'), 'aya@tissus.ci');
    await user.type(screen.getByLabelText('Mot de passe'), 'SecurePass1!');
    await user.type(screen.getByLabelText(/Téléphone/), '0500000000');
    await user.click(screen.getByTestId('submit-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('submit-btn')).toBeDisabled();
    });

    expect(mockRegisterWholesaler).toHaveBeenCalledWith({
      organization_name: "Tissus d'Aya",
      first_name: 'Aya',
      last_name: 'Koné',
      email: 'aya@tissus.ci',
      password: 'SecurePass1!',
      phone: '0500000000',
    });
  });

  it('displays API error on registration failure', async () => {
    const { ApiError } = await import('../../api/client.js');
    mockRegisterWholesaler.mockRejectedValueOnce(
      new ApiError(422, 'VALIDATION_ERROR', 'Email already registered'),
    );

    renderPage();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Nom de l'entreprise"), 'Test Org');
    await user.type(screen.getByLabelText('Prénom'), 'Aya');
    await user.type(screen.getByLabelText('Nom'), 'Koné');
    await user.type(screen.getByLabelText('Email'), 'dup@test.ci');
    await user.type(screen.getByLabelText('Mot de passe'), 'SecurePass1!');
    await user.type(screen.getByLabelText(/Téléphone/), '0500000000');
    await user.click(screen.getByTestId('submit-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('api-error')).toBeInTheDocument();
      expect(screen.getByTestId('api-error').textContent).toContain('Email already registered');
    });
  });

  it('re-enables submit button after error', async () => {
    const { ApiError } = await import('../../api/client.js');
    mockRegisterWholesaler.mockRejectedValueOnce(
      new ApiError(422, 'VALIDATION_ERROR', 'Email already registered'),
    );

    renderPage();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Nom de l'entreprise"), 'Test Org');
    await user.type(screen.getByLabelText('Prénom'), 'Aya');
    await user.type(screen.getByLabelText('Nom'), 'Koné');
    await user.type(screen.getByLabelText('Email'), 'dup@test.ci');
    await user.type(screen.getByLabelText('Mot de passe'), 'SecurePass1!');
    await user.type(screen.getByLabelText(/Téléphone/), '0500000000');
    await user.click(screen.getByTestId('submit-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('submit-btn')).not.toBeDisabled();
    });
  });
});
