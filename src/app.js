import cors from 'cors';
import express from 'express';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import multer from 'multer';
import { config } from './config.js';
import accessRoutes from './routes/access.js';
import adminRoutes from './routes/admin.js';
import wishRoutes from './routes/wishes.js';

export function createApp() {
  const app = express();
  app.set('trust proxy', config.trustProxy);

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin) {
          callback(null, true);
          return;
        }

        const isExactMatch = config.clientOrigins.includes(origin);
        const isVercelPreview = /^(https?:\/\/)[a-z0-9-]+\.vercel\.app$/i.test(origin);
        const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);

        if (isExactMatch || isVercelPreview || isLocalhost) {
          callback(null, true);
          return;
        }

        callback(new Error('Origin is not allowed by CORS.'));
      },
    })
  );
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          ...helmet.contentSecurityPolicy.getDefaultDirectives(),
          'media-src': ["'self'", 'https://res.cloudinary.com'],
        },
      },
    })
  );
  app.use(express.json({ limit: '10kb' }));
  app.use(
    '/api',
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 120,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
    })
  );

  app.get('/', (_req, res) => {
    res.json({
      status: 'ok',
      message: 'Birthday wish API is running. Use the /api routes for the application endpoints.',
    });
  });

  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
  app.use('/api/access', accessRoutes);
  app.use('/api/wishes', wishRoutes);
  app.use('/api/admin', adminRoutes);

  app.use('/api', (req, res) => {
    res.status(404).json({ error: `API route not found: ${req.method} ${req.originalUrl}` });
  });

  app.use((error, _req, res, _next) => {
    console.error('API request failed:', error);
    if (error instanceof multer.MulterError) {
      const status = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
      const message =
        error.code === 'LIMIT_FILE_SIZE'
          ? 'The video exceeds the maximum upload size.'
          : 'The video upload could not be processed.';
      return res.status(status).json({ error: message });
    }
    if (error.message === 'Choose an MP4, WebM, or MOV video.') {
      return res.status(400).json({ error: error.message });
    }
    if (error.message === 'Origin is not allowed by CORS.') {
      return res.status(403).json({ error: error.message });
    }
    return res.status(500).json({ error: 'The request could not be completed.' });
  });

  return app;
}
