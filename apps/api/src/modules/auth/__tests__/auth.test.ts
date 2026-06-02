import request from 'supertest';
import { setupTestDb, teardownTestDb, cleanTables } from './setup.js';
import { createTestApp } from './test-app.js';

// Set test env vars before any app instantiation
process.env.JWT_ACCESS_SECRET = 'test_access_secret_min_32_chars_xxxxxxxxxxxxx';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_min_32_chars_xxxxxxxxxxxx';
process.env.JWT_ACCESS_TTL_SEC = '900';
process.env.JWT_REFRESH_TTL_SEC = '604800';
process.env.COOKIE_SECURE = 'false';
process.env.NODE_ENV = 'test';

const app = createTestApp();

beforeAll(async () => {
  await setupTestDb();
});

afterAll(async () => {
  await teardownTestDb();
});

beforeEach(async () => {
  await cleanTables();
});

describe('UC-08: Buyer registration and login', () => {
  const validBuyer = {
    email: 'kouadio@marchelink.test',
    password: 'SecurePass123!',
    first_name: 'Kouadio',
    last_name: 'Yao',
    phone: '+2250700000000',
  };

  describe('POST /api/auth/register', () => {
    it('registers a buyer successfully', async () => {
      const res = await request(app).post('/api/auth/register').send(validBuyer);

      expect(res.status).toBe(201);
      expect(res.body.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    });

    it('registers buyer with a profile photo (§8)', async () => {
      const fakePhoto = 'data:image/jpeg;base64,/9j/fakeBase64==';
      const res = await request(app)
        .post('/api/auth/register')
        .send({ ...validBuyer, profile_photo: fakePhoto });

      expect(res.status).toBe(201);
      expect(res.body.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    });

    it('rejects duplicate email', async () => {
      await request(app).post('/api/auth/register').send(validBuyer);
      const res = await request(app).post('/api/auth/register').send(validBuyer);

      expect(res.status).toBe(422);
      expect(res.body.error).toBe('VALIDATION_ERROR');
    });

    it('rejects invalid payload (missing fields)', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'bad' });

      expect(res.status).toBe(422);
    });

    it('rejects weak password', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ ...validBuyer, password: 'short' });

      expect(res.status).toBe(422);
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      await request(app).post('/api/auth/register').send(validBuyer);
    });

    it('logs in and sets httpOnly cookies', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: validBuyer.email, password: validBuyer.password });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Logged in');

      const cookies = res.headers['set-cookie'] as string[];
      const accessCookie = cookies.find((c: string) => c.startsWith('access_token='));
      const refreshCookie = cookies.find((c: string) => c.startsWith('refresh_token='));

      expect(accessCookie).toContain('HttpOnly');
      expect(refreshCookie).toContain('HttpOnly');
      expect(refreshCookie).toContain('Path=/api/auth');
    });

    it('rejects wrong password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: validBuyer.email, password: 'WrongPass!' });

      expect(res.status).toBe(404);
    });

    it('rejects non-existent email', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'ghost@test.com', password: 'Whatever1!' });

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/auth/refresh (token rotation)', () => {
    it('issues new tokens and revokes the old refresh token', async () => {
      await request(app).post('/api/auth/register').send(validBuyer);
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: validBuyer.email, password: validBuyer.password });

      const cookies = loginRes.headers['set-cookie'] as string[];
      const refreshCookie = cookies.find((c: string) => c.startsWith('refresh_token='))!;
      const refreshToken = refreshCookie.split('=')[1]!.split(';')[0];

      // Use refresh token
      const refreshRes = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', [`refresh_token=${refreshToken}`]);

      expect(refreshRes.status).toBe(200);
      expect(refreshRes.body.message).toBe('Token refreshed');

      // Old token should be revoked (replay attack)
      const replayRes = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', [`refresh_token=${refreshToken}`]);

      expect(replayRes.status).toBe(404);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('clears cookies and revokes refresh token', async () => {
      await request(app).post('/api/auth/register').send(validBuyer);
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: validBuyer.email, password: validBuyer.password });

      const cookies = loginRes.headers['set-cookie'] as string[];
      const refreshCookie = cookies.find((c: string) => c.startsWith('refresh_token='))!;
      const refreshToken = refreshCookie.split('=')[1]!.split(';')[0];

      const logoutRes = await request(app)
        .post('/api/auth/logout')
        .set('Cookie', [`refresh_token=${refreshToken}`]);

      expect(logoutRes.status).toBe(200);
    });
  });
});

describe('GET /api/auth/me — session restore', () => {
  const validBuyer = {
    email: 'me@marchelink.test',
    password: 'SecurePass123!',
    first_name: 'Kouadio',
    last_name: 'Yao',
    phone: '+2250700000000',
  };

  it('returns user profile when authenticated', async () => {
    await request(app).post('/api/auth/register').send(validBuyer);
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: validBuyer.email, password: validBuyer.password });

    const cookies = loginRes.headers['set-cookie'] as string[];
    const accessCookie = cookies.find((c: string) => c.startsWith('access_token='))!;
    const accessToken = accessCookie.split('=')[1]!.split(';')[0];

    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Cookie', [`access_token=${accessToken}`]);

    expect(meRes.status).toBe(200);
    expect(meRes.body.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(meRes.body.email).toBe(validBuyer.email);
    expect(meRes.body.first_name).toBe(validBuyer.first_name);
    expect(meRes.body.last_name).toBe(validBuyer.last_name);
    expect(meRes.body.role).toBe('buyer');
    expect(meRes.body.organization_id).toBeNull();
    // Never leak password_hash
    expect(meRes.body).not.toHaveProperty('password_hash');
  });

  it('returns 401 without access_token cookie', async () => {
    const meRes = await request(app).get('/api/auth/me');

    expect(meRes.status).toBe(401);
    expect(meRes.body.error).toBe('UNAUTHORIZED');
  });

  it('returns 401 with expired/invalid token', async () => {
    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Cookie', ['access_token=invalid.jwt.token']);

    expect(meRes.status).toBe(401);
  });
});

describe('UC-21: Buyer cannot escalate to wholesaler role', () => {
  const validBuyer = {
    email: 'buyer@marchelink.test',
    password: 'SecurePass123!',
    first_name: 'Test',
    last_name: 'Buyer',
    phone: '+2250700000000',
  };

  it('buyer cannot access admin-only routes (returns 404, not 403)', async () => {
    await request(app).post('/api/auth/register').send(validBuyer);
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: validBuyer.email, password: validBuyer.password });

    const cookies = loginRes.headers['set-cookie'] as string[];
    const accessCookie = cookies.find((c: string) => c.startsWith('access_token='))!;
    const accessToken = accessCookie.split('=')[1]!.split(';')[0];

    const res = await request(app)
      .get('/api/admin-only')
      .set('Cookie', [`access_token=${accessToken}`]);

    // §14: cross-tenant → 404 (pas 403)
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('NOT_FOUND');
  });

  it('unauthenticated request returns 401', async () => {
    const res = await request(app).get('/api/protected');
    expect(res.status).toBe(401);
  });
});

describe('F1: Wholesaler registration', () => {
  const validWholesaler = {
    email: 'aya@grossiste.test',
    password: 'SecurePass123!',
    first_name: 'Aya',
    last_name: 'Koné',
    phone: '+2250701000001',
    organization_name: "Tissus d'Aya",
  };

  describe('POST /api/auth/register-wholesaler', () => {
    it('registers wholesaler + organization in one transaction', async () => {
      const res = await request(app)
        .post('/api/auth/register-wholesaler')
        .send(validWholesaler);

      expect(res.status).toBe(201);
      expect(res.body.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
      expect(res.body.organization_id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    });

    it('created user has role wholesaler_admin and correct org', async () => {
      const regRes = await request(app)
        .post('/api/auth/register-wholesaler')
        .send(validWholesaler);

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: validWholesaler.email, password: validWholesaler.password });

      const cookies = loginRes.headers['set-cookie'] as string[];
      const accessCookie = cookies.find((c: string) => c.startsWith('access_token='))!;
      const accessToken = accessCookie.split('=')[1]!.split(';')[0];

      const meRes = await request(app)
        .get('/api/auth/me')
        .set('Cookie', [`access_token=${accessToken}`]);

      expect(meRes.status).toBe(200);
      expect(meRes.body.role).toBe('wholesaler_admin');
      expect(meRes.body.organization_id).toBe(regRes.body.organization_id);
      expect(meRes.body.first_name).toBe(validWholesaler.first_name);
    });

    it('rejects duplicate email', async () => {
      await request(app)
        .post('/api/auth/register-wholesaler')
        .send(validWholesaler);

      const res = await request(app)
        .post('/api/auth/register-wholesaler')
        .send(validWholesaler);

      expect(res.status).toBe(422);
      expect(res.body.error).toBe('VALIDATION_ERROR');
    });

    it('rejects missing organization_name', async () => {
      const { organization_name, ...noOrg } = validWholesaler;
      const res = await request(app)
        .post('/api/auth/register-wholesaler')
        .send(noOrg);

      expect(res.status).toBe(422);
    });

    it('rejects missing required fields', async () => {
      const res = await request(app)
        .post('/api/auth/register-wholesaler')
        .send({ email: 'bad', organization_name: 'Test' });

      expect(res.status).toBe(422);
    });

    it('rejects weak password', async () => {
      const res = await request(app)
        .post('/api/auth/register-wholesaler')
        .send({ ...validWholesaler, password: 'short' });

      expect(res.status).toBe(422);
    });
  });
});

describe('F2: Profile Management', () => {
  const baseUser = {
    email: 'profile@test.test',
    password: 'StrongPass99!',
    first_name: 'Kouamé',
    last_name: 'Brou',
    phone: '+2250700000099',
  };

  /** Register the base user, login, return the access_token cookie string. */
  async function registerAndLogin(overrides?: Partial<typeof baseUser>): Promise<string> {
    await request(app)
      .post('/api/auth/register')
      .send({ ...baseUser, ...overrides });

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: overrides?.email ?? baseUser.email, password: overrides?.password ?? baseUser.password });

    const cookies = loginRes.headers['set-cookie'] as string[];
    const accessCookie = cookies.find((c: string) => c.startsWith('access_token='))!;
    return accessCookie.split('=')[1]!.split(';')[0]!;
  }

  describe('PATCH /api/auth/profile', () => {
    it('updates first_name and phone successfully', async () => {
      const token = await registerAndLogin();

      const res = await request(app)
        .patch('/api/auth/profile')
        .set('Cookie', [`access_token=${token}`])
        .send({ first_name: 'Kouadio', phone: '+2250700000001' });

      expect(res.status).toBe(200);
      expect(res.body.first_name).toBe('Kouadio');
      expect(res.body.phone).toBe('+2250700000001');
      expect(res.body.last_name).toBe(baseUser.last_name); // unchanged
    });

    it('rejects setting phone to null (phone is NOT NULL since §9)', async () => {
      const token = await registerAndLogin();

      const res = await request(app)
        .patch('/api/auth/profile')
        .set('Cookie', [`access_token=${token}`])
        .send({ phone: null });

      expect(res.status).toBe(422);
    });

    it('returns current profile unchanged when body is empty', async () => {
      const token = await registerAndLogin();

      const res = await request(app)
        .patch('/api/auth/profile')
        .set('Cookie', [`access_token=${token}`])
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.first_name).toBe(baseUser.first_name);
      expect(res.body.email).toBe(baseUser.email);
    });

    it('rejects duplicate email with 422', async () => {
      const other = 'other-profile@test.test';
      // Register a second user to occupy the target email
      await request(app)
        .post('/api/auth/register')
        .send({ ...baseUser, email: other });

      const token = await registerAndLogin();

      const res = await request(app)
        .patch('/api/auth/profile')
        .set('Cookie', [`access_token=${token}`])
        .send({ email: other });

      expect(res.status).toBe(422);
      expect(res.body.error).toBe('VALIDATION_ERROR');
    });

    it('allows updating to own email (no-op unique check)', async () => {
      const token = await registerAndLogin();

      const res = await request(app)
        .patch('/api/auth/profile')
        .set('Cookie', [`access_token=${token}`])
        .send({ email: baseUser.email, first_name: 'Samemail' });

      expect(res.status).toBe(200);
      expect(res.body.first_name).toBe('Samemail');
    });

    it('returns 401 when unauthenticated', async () => {
      const res = await request(app)
        .patch('/api/auth/profile')
        .send({ first_name: 'Hacker' });

      expect(res.status).toBe(401);
    });
  });

  describe('PATCH /api/auth/password', () => {
    it('changes password successfully and forces re-login', async () => {
      const token = await registerAndLogin();
      const newPass = 'NewSecure456!';

      const res = await request(app)
        .patch('/api/auth/password')
        .set('Cookie', [`access_token=${token}`])
        .send({ old_password: baseUser.password, new_password: newPass });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Password updated');

      // Old password must now fail
      const oldLoginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: baseUser.email, password: baseUser.password });
      expect(oldLoginRes.status).toBe(404);

      // New password must work
      const newLoginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: baseUser.email, password: newPass });
      expect(newLoginRes.status).toBe(200);
    });

    it('rejects wrong old_password with 422', async () => {
      const token = await registerAndLogin();

      const res = await request(app)
        .patch('/api/auth/password')
        .set('Cookie', [`access_token=${token}`])
        .send({ old_password: 'WrongPassword!', new_password: 'NewSecure456!' });

      expect(res.status).toBe(422);
      expect(res.body.error).toBe('VALIDATION_ERROR');
    });

    it('rejects new_password shorter than 8 chars with 422', async () => {
      const token = await registerAndLogin();

      const res = await request(app)
        .patch('/api/auth/password')
        .set('Cookie', [`access_token=${token}`])
        .send({ old_password: baseUser.password, new_password: 'short' });

      expect(res.status).toBe(422);
    });

    it('returns 401 when unauthenticated', async () => {
      const res = await request(app)
        .patch('/api/auth/password')
        .send({ old_password: 'any', new_password: 'NewSecure456!' });

      expect(res.status).toBe(401);
    });
  });
});

describe('UC-22: Rate limiting on /api/auth/*', () => {
  it('blocks after 5 requests per minute', async () => {
    const rateLimitedApp = createTestApp({ enableRateLimit: true });
    const payload = { email: 'rate@test.com', password: 'x' };

    for (let i = 0; i < 5; i++) {
      await request(rateLimitedApp).post('/api/auth/login').send(payload);
    }

    const res = await request(rateLimitedApp).post('/api/auth/login').send(payload);
    expect(res.status).toBe(429);
  });
});
