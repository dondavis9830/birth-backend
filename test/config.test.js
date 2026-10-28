import test from 'node:test';
import assert from 'node:assert/strict';

const originalEnv = { ...process.env };

test('normalizeClientOrigins strips trailing slashes and keeps valid origins', async () => {
  process.env.JWT_SECRET = '1234567890abcdef1234567890abcdef';
  process.env.MONGODB_URI = 'mongodb://localhost:27017/test';
  process.env.CLOUDINARY_CLOUD_NAME = 'demo';
  process.env.CLOUDINARY_API_KEY = 'demo';
  process.env.CLOUDINARY_API_SECRET = 'demo';
  process.env.BIRTHDAY_PAGE_PASSWORD_HASH = '$2b$12$EGvm.RTxX/iSZJ4FDppwcO9p.hrIY3H1M4SObDKtP8NMx/EYFPXuO';
  process.env.WISH_PAGE_PASSWORD_HASH = '$2b$12$1tlAzA1uXum4qDhRrS9cMuE9VKCSs9tOMDV9iPHXkDXkhYKW5A6iK';
  process.env.ADMIN_USERNAME = 'admin';
  process.env.ADMIN_PASSWORD_HASH = '$2b$12$teICTe2St3GpAUQgWPFEDOxxxq9yGQaO1kcVXmFYadSmZFumvz.Gi';

  const { normalizeClientOrigins } = await import('../src/config.js?x=' + Date.now());

  assert.deepEqual(
    normalizeClientOrigins('https://frontend-birth.vercel.app/ , https://app.example.com/ , http://localhost:5173'),
    ['https://frontend-birth.vercel.app', 'https://app.example.com', 'http://localhost:5173']
  );

  process.env = { ...originalEnv };
});
