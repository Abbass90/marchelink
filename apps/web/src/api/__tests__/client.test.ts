import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  apiFetch,
  ApiError,
  authRegister,
  authLogin,
  authLogout,
  authRefresh,
  authMe,
} from '../client.js';
import type { UserProfile } from '../client.js';

/* ── Mock global fetch ───────────────────────────────── */

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

/* ── Helpers ─────────────────────────────────────────── */

function jsonResponse(status: number, body: unknown) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: () => Promise.resolve(body),
  } as Response);
}

/* ── apiFetch ────────────────────────────────────────── */

describe('apiFetch', () => {
  it('sends request with credentials: include', async () => {
    mockFetch.mockReturnValueOnce(jsonResponse(200, { ok: true }));

    await apiFetch('/test');

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/test',
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('sets Content-Type: application/json by default', async () => {
    mockFetch.mockReturnValueOnce(jsonResponse(200, { ok: true }));

    await apiFetch('/test');

    const callArgs = mockFetch.mock.calls[0] as [string, RequestInit];
    const headers = callArgs[1].headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('throws ApiError on non-ok response', async () => {
    mockFetch.mockReturnValueOnce(
      jsonResponse(422, { error: 'VALIDATION_ERROR', message: 'Bad data' }),
    );

    await expect(apiFetch('/fail')).rejects.toThrow(ApiError);
    await mockFetch.mockReturnValueOnce(
      jsonResponse(422, { error: 'VALIDATION_ERROR', message: 'Bad data' }),
    );

    try {
      await apiFetch('/fail');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).status).toBe(422);
      expect((err as ApiError).code).toBe('VALIDATION_ERROR');
    }
  });
});

/* ── Auth API Functions ──────────────────────────────── */

describe('Auth API functions', () => {
  describe('authRegister', () => {
    it('sends POST /auth/register with payload', async () => {
      const payload = {
        email: 'test@marchelink.ci',
        password: 'SecurePass1!',
        first_name: 'Kouadio',
        last_name: 'Yao',
      };
      mockFetch.mockReturnValueOnce(jsonResponse(201, { id: 'uuid-1' }));

      const result = await authRegister(payload);

      expect(result.id).toBe('uuid-1');
      const callArgs = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(callArgs[0]).toBe('/api/auth/register');
      expect(callArgs[1].method).toBe('POST');
      expect(JSON.parse(callArgs[1].body as string)).toEqual(payload);
    });
  });

  describe('authLogin', () => {
    it('sends POST /auth/login with credentials', async () => {
      mockFetch.mockReturnValueOnce(jsonResponse(200, { message: 'Logged in' }));

      const result = await authLogin({ email: 'k@test.ci', password: 'Pass123!' });

      expect(result.message).toBe('Logged in');
      const callArgs = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(callArgs[0]).toBe('/api/auth/login');
      expect(callArgs[1].method).toBe('POST');
    });
  });

  describe('authLogout', () => {
    it('sends POST /auth/logout', async () => {
      mockFetch.mockReturnValueOnce(jsonResponse(200, { message: 'Logged out' }));

      const result = await authLogout();

      expect(result.message).toBe('Logged out');
      const callArgs = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(callArgs[0]).toBe('/api/auth/logout');
      expect(callArgs[1].method).toBe('POST');
    });
  });

  describe('authRefresh', () => {
    it('sends POST /auth/refresh', async () => {
      mockFetch.mockReturnValueOnce(jsonResponse(200, { message: 'Token refreshed' }));

      const result = await authRefresh();

      expect(result.message).toBe('Token refreshed');
      const callArgs = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(callArgs[0]).toBe('/api/auth/refresh');
      expect(callArgs[1].method).toBe('POST');
    });
  });

  describe('authMe', () => {
    it('sends GET /auth/me and returns user profile', async () => {
      const profile: UserProfile = {
        id: 'uuid-1',
        email: 'k@test.ci',
        role: 'buyer',
        organization_id: null,
        first_name: 'Kouadio',
        last_name: 'Yao',
        phone: '+225070000000',
        profile_photo: null,
      };
      mockFetch.mockReturnValueOnce(jsonResponse(200, profile));

      const result = await authMe();

      expect(result).toEqual(profile);
      const callArgs = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(callArgs[0]).toBe('/api/auth/me');
      // GET by default — no method override
      expect(callArgs[1].method).toBeUndefined();
    });
  });
});
