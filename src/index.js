import dotenv from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

dotenv.config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../.env') });

const [{ createApp }, { config }, { connectDatabase }, { v2: cloudinary }, { default: mongoose }] =
  await Promise.all([
    import('./app.js'),
    import('./config.js'),
    import('./db.js'),
    import('cloudinary'),
    import('mongoose'),
  ]);

cloudinary.config({
  cloud_name: config.cloudinary.cloudName,
  api_key: config.cloudinary.apiKey,
  api_secret: config.cloudinary.apiSecret,
  secure: true,
});

await connectDatabase();

const server = createApp().listen(config.port, () => {
  console.info(`Birthday wish API listening on port ${config.port}.`);
});

async function shutdown(signal) {
  console.info(`${signal} received; closing the API server.`);
  server.close(async (error) => {
    if (error) {
      console.error('Failed to close the API server cleanly:', error);
      process.exitCode = 1;
    }
    await mongoose.disconnect();
    process.exit();
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
