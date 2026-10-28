import { Router } from 'express';
import { v2 as cloudinary } from 'cloudinary';
import { rateLimit } from 'express-rate-limit';
import fs from 'node:fs/promises';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import { config } from '../config.js';
import { Wish } from '../models/Wish.js';

const router = Router();
const allowedVideoTypes = new Set(['video/mp4', 'video/webm', 'video/quicktime']);
const upload = multer({
  storage: multer.diskStorage({
    destination: os.tmpdir(),
    filename: (_req, _file, callback) => callback(null, randomUUID()),
  }),
  limits: { fileSize: config.maxVideoBytes, files: 1 },
  fileFilter(_req, file, callback) {
    if (!allowedVideoTypes.has(file.mimetype)) {
      callback(new Error('Choose an MP4, WebM, or MOV video.'));
      return;
    }
    callback(null, true);
  },
});

const submissionLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many upload attempts. Please try again later.' },
});

function requirePageAccess(page) {
  return (req, res, next) => {
    const [scheme, token] = req.get('authorization')?.split(' ') || [];
    if (scheme !== 'Bearer' || !token) {
      return res.status(401).json({ error: `Enter the ${page} page password to continue.` });
    }

    try {
      const payload = jwt.verify(token, config.jwtSecret);
      if (payload.type !== 'page-access' || payload.page !== page) {
        return res.status(403).json({ error: 'This password does not grant access to this page.' });
      }
      return next();
    } catch {
      return res.status(401).json({ error: 'Page access expired. Enter the password again.' });
    }
  };
}

function uploadVideo(filePath) {
  return cloudinary.uploader.upload(filePath, {
    folder: 'birthday-wishes',
    resource_type: 'video',
    use_filename: false,
    unique_filename: true,
  });
}

router.get('/', requirePageAccess('birthday'), async (_req, res) => {
  const wishes = await Wish.find({ status: 'approved' })
    .select('name message videoUrl durationSeconds createdAt')
    .sort({ createdAt: -1 })
    .lean();
  res.json({ wishes });
});

router.post(
  '/',
  requirePageAccess('wish'),
  submissionLimit,
  upload.single('video'),
  async (req, res) => {
    const filePath = req.file?.path;
    let uploadedVideo;
    let savedWish;

    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Choose a video to upload.' });
      }

      const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
      const message = typeof req.body.message === 'string' ? req.body.message.trim() : '';
      if (!name || name.length > 60 || !message || message.length > 300) {
        return res.status(400).json({
          error: 'Add a name (up to 60 characters) and a message (up to 300 characters).',
        });
      }

      uploadedVideo = await uploadVideo(filePath);
      if (
        typeof uploadedVideo.duration !== 'number' ||
        uploadedVideo.duration <= 0 ||
        uploadedVideo.duration > config.maxVideoSeconds
      ) {
        await removeCloudinaryVideo(uploadedVideo.public_id);
        uploadedVideo = undefined;
        return res.status(400).json({
          error: `Videos must be no longer than ${config.maxVideoSeconds} seconds.`,
        });
      }

      savedWish = await Wish.create({
        name,
        message,
        publicId: uploadedVideo.public_id,
        videoUrl: uploadedVideo.secure_url,
        durationSeconds: uploadedVideo.duration,
      });

      return res.status(201).json({
        message: 'Your video wish was submitted for approval. Thank you!',
        id: savedWish.id,
      });
    } catch (error) {
      if (uploadedVideo && !savedWish) {
        try {
          await removeCloudinaryVideo(uploadedVideo.public_id);
        } catch (cleanupError) {
          console.error('Failed to clean up an unlinked Cloudinary upload:', cleanupError);
        }
      }
      throw error;
    } finally {
      if (filePath) {
        await fs.rm(filePath, { force: true });
      }
    }
  }
);

export default router;
