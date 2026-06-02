import { render, screen, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthProvider, useAuth } from '../useAuth.js';
import type { UserProfile } from '../../api/client.js';

/* ── Mock the API client ─────────────────────────────── */

const mockAuthMe = vi.fn();
const mockAuthLogin = vi.fn();
const mockAuthRegister = vi.fn();
const mockAuthLogout = vi.fn();
const mockAuthRefresh = vi.fn();

vi.mock('../../api/client.js', () => ({
  authMe: (...args: unknown[]) => mockAuthMe(...args),
  authLogin: (...args: unknown[]) => mockAuthLogin(...args),
  authRegister: (...args: unknown[]) => mockAuthRegister(...args),
  authLogout: (...args: unknown[]) => mockAuthLogout(...args),
  authRefresh: (...args: unknown[]) => mockAuthRefresh(...args),
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

/* ── Fake user ───────────────────────────────────────── */

const fakeUser: UserProfile = {
  id: 'u-001',
  email: 'kouadio@marchelink.ci',
  role: 'buyer',
  organization_id: null,
  first_name: 'Kouadio',
  last_name: 'Yao',
  phone: '+225070000000',
  profile_photo: null,
};

/* ── Test consumer component ─────────────────────────── */

function AuthConsumer() {
  const { user, loading, error, isAuthenticated, login, register, logout } = useAuth();

  return (
    <div>
      <p data-testid="loading">{loading ? 'true' : 'false'}</p>
      <p data-testid="authenticated">{isAuthenticated ? 'true' : 'false'}</p>
      <p data-testid="error">{error ?? 'none'}</p>
      <p data-testid="user">{user ? `${user.first_name} ${user.last_name}` : 'null'}</p>
      <button onClick={() => void login({ email: 'k@test.ci', password: 'Pass1!' })}>
        Login
      </button>
      <button
        onClick={() =>
          void register({
            email: 'k@test.ci',
            password: 'Pass1!',
            first_name: 'K',
            last_name: 'Y',
          })
        }
      >
        Register
      </button>
      <button onClick={() => void logout()}>Logout</button>
    </div>
  );
}

function renderWithProvider() {
  return render(
    <AuthProvider>
      <AuthConsumer />
    </AuthProvider>,
  );
}

/* ── Tests ───────────────────────────────────────────── */

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

describe('AuthProvider — boot sequence', () => {
  it('shows loading=true then resolves to authenticated when session exists', async () => {
    mockAuthMe.mockResolvedValueOnce(fakeUser);

    renderWithProvider();

    // Initially loading
    expect(screen.getByTestId('loading').textContent).toBe('true');

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });

    expect(screen.getByTestId('authenticated').textContent).toBe('true');
    expect(screen.getByTestId('user').textContent).toBe('Kouadio Yao');
  });

  it('resolves to unauthenticated when no session cookie', async () => {
    const { ApiError } = await import('../../api/client.js');
    mockAuthMe.mockRejectedValueOnce(new ApiError(401, 'UNAUTHORIZED', 'No token'));
    mockAuthRefresh.mockRejectedValueOnce(new ApiError(401, 'UNAUTHORIZED', 'No refresh'));

    renderWithProvider();

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });

    expect(screen.getByTestId('authenticated').textContent).toBe('false');
    expect(screen.getByTestId('user').textContent).toBe('null');
  });

  it('attempts silent refresh when authMe fails with 401, then retries /me', async () => {
    const { ApiError } = await import('../../api/client.js');
    mockAuthMe
      .mockRejectedValueOnce(new ApiError(401, 'UNAUTHORIZED', 'Expired'))
      .mockResolvedValueOnce(fakeUser);
    mockAuthRefresh.mockResolvedValueOnce({ message: 'Token refreshed' });

    renderWithProvider();

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });

    expect(mockAuthRefresh).toHaveBeenCalledTimes(1);
    expect(mockAuthMe).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('authenticated').textContent).toBe('true');
  });
});

describe('AuthProvider — login', () => {
  it('calls authLogin then authMe and sets user', async () => {
    const { ApiError } = await import('../../api/client.js');
    // Boot: no session
    mockAuthMe.mockRejectedValueOnce(new ApiError(401, 'UNAUTHORIZED', 'No token'));
    mockAuthRefresh.mockRejectedValueOnce(new ApiError(401, 'UNAUTHORIZED', 'No refresh'));

    renderWithProvider();

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });

    // Now login
    mockAuthLogin.mockResolvedValueOnce({ message: 'Logged in' });
    mockAuthMe.mockResolvedValueOnce(fakeUser);

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await user.click(screen.getByText('Login'));

    await waitFor(() => {
      expect(screen.getByTestId('authenticated').textContent).toBe('true');
    });

    expect(mockAuthLogin).toHaveBeenCalledWith({ email: 'k@test.ci', password: 'Pass1!' });
    expect(screen.getByTestId('user').textContent).toBe('Kouadio Yao');
  });
});

describe('AuthProvider — register', () => {
  it('calls authRegister, then auto-login, then authMe', async () => {
    const { ApiError } = await import('../../api/client.js');
    // Boot: no session
    mockAuthMe.mockRejectedValueOnce(new ApiError(401, 'UNAUTHORIZED', 'No token'));
    mockAuthRefresh.mockRejectedValueOnce(new ApiError(401, 'UNAUTHORIZED', 'No refresh'));

    renderWithProvider();

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });

    // Register
    mockAuthRegister.mockResolvedValueOnce({ id: 'uuid-new' });
    mockAuthLogin.mockResolvedValueOnce({ message: 'Logged in' });
    mockAuthMe.mockResolvedValueOnce(fakeUser);

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await user.click(screen.getByText('Register'));

    await waitFor(() => {
      expect(screen.getByTestId('authenticated').textContent).toBe('true');
    });

    expect(mockAuthRegister).toHaveBeenCalledTimes(1);
    expect(mockAuthLogin).toHaveBeenCalledTimes(1);
  });
});

describe('AuthProvider — logout', () => {
  it('clears user state and calls authLogout', async () => {
    // Boot: session exists
    mockAuthMe.mockResolvedValueOnce(fakeUser);

    renderWithProvider();

    await waitFor(() => {
      expect(screen.getByTestId('authenticated').textContent).toBe('true');
    });

    mockAuthLogout.mockResolvedValueOnce({ message: 'Logged out' });

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await user.click(screen.getByText('Logout'));

    await waitFor(() => {
      expect(screen.getByTestId('authenticated').textContent).toBe('false');
    });

    expect(screen.getByTestId('user').textContent).toBe('null');
  });
});

describe('useAuth — outside provider', () => {
  it('throws when used without AuthProvider', () => {
    function Naked() {
      useAuth();
      return null;
    }

    expect(() => render(<Naked />)).toThrow('useAuth must be used within an <AuthProvider>');
  });
});
