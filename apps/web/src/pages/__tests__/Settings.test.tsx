import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Settings from '../Settings.js';

/* ── Mocks ───────────────────────────────────────────── */

const mockReloadUser = vi.fn();
const mockUpdateProfile = vi.fn();
const mockChangePassword = vi.fn();

vi.mock('../../hooks/useAuth.js', () => ({
  useAuth: () => ({
    user: {
      id: 'user-1',
      email: 'kouadio@test.ci',
      role: 'buyer',
      organization_id: null,
      first_name: 'Kouadio',
      last_name: 'Brou',
      phone: '+2250700000001',
    },
    loading: false,
    error: null,
    isAuthenticated: true,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    reloadUser: mockReloadUser,
  }),
}));

vi.mock('../../api/client.js', () => ({
  updateProfile: (...args: unknown[]) => mockUpdateProfile(...args),
  changePassword: (...args: unknown[]) => mockChangePassword(...args),
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

function renderSettings() {
  return render(
    <MemoryRouter>
      <Settings />
    </MemoryRouter>,
  );
}

/* ── Setup ───────────────────────────────────────────── */

beforeEach(() => {
  vi.clearAllMocks();
  mockReloadUser.mockResolvedValue(undefined);
});

/* ── Tests ───────────────────────────────────────────── */

describe('Settings Page — F2: Gestion du Profil', () => {
  describe('Profile section', () => {
    it('pre-fills form with current user data', () => {
      renderSettings();

      expect((screen.getByTestId('st-first-name') as HTMLInputElement).value).toBe('Kouadio');
      expect((screen.getByTestId('st-last-name') as HTMLInputElement).value).toBe('Brou');
      expect((screen.getByTestId('st-email') as HTMLInputElement).value).toBe('kouadio@test.ci');
      expect((screen.getByTestId('st-phone') as HTMLInputElement).value).toBe('+2250700000001');
    });

    it('renders both section headings', () => {
      renderSettings();

      expect(screen.getByText('Informations personnelles')).toBeInTheDocument();
      expect(screen.getByText('Changer le mot de passe')).toBeInTheDocument();
    });

    it('calls updateProfile and reloadUser on submit', async () => {
      mockUpdateProfile.mockResolvedValue({
        id: 'user-1', email: 'kouadio@test.ci', role: 'buyer',
        organization_id: null, first_name: 'Nouveau', last_name: 'Brou', phone: null,
      });
      renderSettings();
      const user = userEvent.setup();

      await user.clear(screen.getByTestId('st-first-name'));
      await user.type(screen.getByTestId('st-first-name'), 'Nouveau');
      await user.click(screen.getByTestId('st-prof-submit'));

      await waitFor(() => {
        expect(screen.getByTestId('st-prof-success')).toBeInTheDocument();
      });
      expect(mockUpdateProfile).toHaveBeenCalledOnce();
      expect(mockReloadUser).toHaveBeenCalledOnce();
    });

    it('disables submit button while loading', async () => {
      mockUpdateProfile.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100)),
      );
      renderSettings();
      const user = userEvent.setup();

      await user.click(screen.getByTestId('st-prof-submit'));

      await waitFor(() => {
        expect(screen.getByTestId('st-prof-submit')).toBeDisabled();
      });
    });

    it('shows API error message on profile update failure', async () => {
      const { ApiError } = await import('../../api/client.js');
      mockUpdateProfile.mockRejectedValueOnce(
        new ApiError(422, 'VALIDATION_ERROR', 'Email already in use'),
      );
      renderSettings();
      const user = userEvent.setup();

      await user.click(screen.getByTestId('st-prof-submit'));

      await waitFor(() => {
        expect(screen.getByTestId('st-prof-error').textContent).toContain('Email already in use');
      });
    });
  });

  describe('Password section', () => {
    it('calls changePassword with form values', async () => {
      mockChangePassword.mockResolvedValue({ message: 'Password updated' });
      renderSettings();
      const user = userEvent.setup();

      await user.type(screen.getByTestId('st-old-pwd'), 'OldPass123!');
      await user.type(screen.getByTestId('st-new-pwd'), 'NewPass456!');
      await user.click(screen.getByTestId('st-pwd-submit'));

      await waitFor(() => {
        expect(screen.getByTestId('st-pwd-success')).toBeInTheDocument();
      });
      expect(mockChangePassword).toHaveBeenCalledWith({
        old_password: 'OldPass123!',
        new_password: 'NewPass456!',
      });
    });

    it('clears password fields after successful change', async () => {
      mockChangePassword.mockResolvedValue({ message: 'Password updated' });
      renderSettings();
      const user = userEvent.setup();

      await user.type(screen.getByTestId('st-old-pwd'), 'OldPass123!');
      await user.type(screen.getByTestId('st-new-pwd'), 'NewPass456!');
      await user.click(screen.getByTestId('st-pwd-submit'));

      await waitFor(() => {
        expect((screen.getByTestId('st-old-pwd') as HTMLInputElement).value).toBe('');
        expect((screen.getByTestId('st-new-pwd') as HTMLInputElement).value).toBe('');
      });
    });

    it('shows client-side error when new_password is too short', async () => {
      renderSettings();
      const user = userEvent.setup();

      await user.type(screen.getByTestId('st-old-pwd'), 'OldPass123!');
      await user.type(screen.getByTestId('st-new-pwd'), 'short');
      await user.click(screen.getByTestId('st-pwd-submit'));

      await waitFor(() => {
        expect(screen.getByTestId('st-pwd-error')).toBeInTheDocument();
      });
      expect(mockChangePassword).not.toHaveBeenCalled();
    });

    it('shows API error message on wrong old password', async () => {
      const { ApiError } = await import('../../api/client.js');
      mockChangePassword.mockRejectedValueOnce(
        new ApiError(422, 'VALIDATION_ERROR', 'Mot de passe actuel incorrect'),
      );
      renderSettings();
      const user = userEvent.setup();

      await user.type(screen.getByTestId('st-old-pwd'), 'WrongOld!');
      await user.type(screen.getByTestId('st-new-pwd'), 'NewPass456!');
      await user.click(screen.getByTestId('st-pwd-submit'));

      await waitFor(() => {
        expect(screen.getByTestId('st-pwd-error').textContent).toContain('Mot de passe actuel incorrect');
      });
    });

    it('disables submit button while loading', async () => {
      mockChangePassword.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100)),
      );
      renderSettings();
      const user = userEvent.setup();

      await user.type(screen.getByTestId('st-new-pwd'), 'NewPass456!');
      await user.click(screen.getByTestId('st-pwd-submit'));

      await waitFor(() => {
        expect(screen.getByTestId('st-pwd-submit')).toBeDisabled();
      });
    });
  });
});
