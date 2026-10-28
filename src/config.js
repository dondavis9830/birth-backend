function required(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. Set it in server/.env (copy server/.env.example to start).`
    );
  }
  return value;
}

export function normalizeClientOrigins(rawOrigins) {
  return (rawOrigins || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean);
}

function positiveInteger(name, fallback) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return value;
}

function requiredBcryptHash(name) {
  const hash = required(name);
  if (!/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(hash)) {
    throw new Error(`${name} must be a valid bcrypt hash. Generate hashes with the setup scripts.`);
  }
  return hash;
}

const jwtSecret = required('JWT_SECRET');
if (jwtSecret.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters long.');
}

export const config = {
  port: positiveInteger('PORT', 4000),
  clientOrigins: normalizeClientOrigins(process.env.CLIENT_ORIGINS),
  trustProxy: process.env.TRUST_PROXY || 'loopback',
  mongoUri: required('MONGODB_URI'),
  cloudinary: {
    cloudName: required('CLOUDINARY_CLOUD_NAME'),
    apiKey: required('CLOUDINARY_API_KEY'),
    apiSecret: required('CLOUDINARY_API_SECRET'),
  },
  pagePasswordHashes: {
    birthday: requiredBcryptHash('BIRTHDAY_PAGE_PASSWORD_HASH'),
    wish: requiredBcryptHash('WISH_PAGE_PASSWORD_HASH'),
  },
  adminUsername: required('ADMIN_USERNAME'),
  adminPasswordHash: requiredBcryptHash('ADMIN_PASSWORD_HASH'),
  jwtSecret,
  maxVideoBytes: positiveInteger('MAX_VIDEO_BYTES', 100 * 1024 * 1024),
  maxVideoSeconds: 20,
};
