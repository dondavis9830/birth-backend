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
const videoExtensions = [
  '.mp4', '.m4v', '.mov', '.3gp', '.3gpp', '.3g2', '.webm', '.avi', '.mkv', '.wmv',
  '.flv', '.mpeg', '.mpg', '.m2ts', '.ts', '.mts', '.mxf', '.dv', '.f4v', '.m2v', '.vob',
  '.ogv', '.divx', '.xvid'
];

const upload = multer({
  storage: multer.diskStorage({
    destination: os.tmpdir(),
    filename: (_req, _file, callback) => callback(null, randomUUID()),
  }),
  limits: { fileSize: config.maxVideoBytes, files: 1 },
  fileFilter(_req, file, callback) {
    const mimeType = file.mimetype?.split(';', 1)[0]?.trim().toLowerCase();
    const fileName = (file.originalname || '').toLowerCase();
    const hasValidExtension = videoExtensions.some((ext) => fileName.endsWith(ext));
    const isVideoMime = mimeType?.startsWith('video/');

    if (isVideoMime || hasValidExtension) {
      callback(null, true);
      return;
    }

    callback(new Error('Choose a valid video file.'));
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

async function removeCloudinaryVideo(publicId) {
  const result = await cloudinary.uploader.destroy(publicId, {
    resource_type: 'video',
    invalidate: true,
  });

  if (result.result !== 'ok' && result.result !== 'not found') {
    throw new Error(`Cloudinary did not remove the video (${result.result}).`);
  }
}

async function uploadVideo(filePath) {
  const commonOptions = {
    folder: 'birthday-wishes',
    resource_type: 'video',
    use_filename: false,
    unique_filename: true,
    quality: 'auto:good',
    fetch_format: 'auto',
  };

  try {
    return await cloudinary.uploader.upload(filePath, {
      ...commonOptions,
      transformation: [
        {
          width: 720,
          height: 1280,
          crop: 'limit',
          quality: 'auto:good',
          fetch_format: 'auto',
          video_codec: 'h264',
          audio_codec: 'aac',
        },
      ],
    });
  } catch (transcodeError) {
    const message = String(transcodeError?.message || '').toLowerCase();
    const isFormatIssue = [
      'unsupported',
      'not a valid',
      'codec',
      'video format',
      'invalid video',
      'file type',
    ].some((errorText) => message.includes(errorText));

    if (isFormatIssue) {
      return cloudinary.uploader.upload(filePath, commonOptions);
    }

    throw transcodeError;
  }
}

router.get('/', requirePageAccess('birthday'), async (_req, res) => {
  const wishes = await Wish.find({
    status: 'approved',
    deletedAt: null,
    videoUrl: { $ne: '' },
  })
    .select('name message videoUrl durationSeconds createdAt')
    .sort({ createdAt: -1 })
    .lean();
  res.json({ wishes });
});

router.post(
  '/',
  submissionLimit,
  requirePageAccess('wish'),
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

      const detail = error?.message || 'The video upload failed.';
      const normalized = String(detail).trim();
      const friendlyMessage = normalized.toLowerCase().includes('unsupported') || normalized.toLowerCase().includes('codec') || normalized.toLowerCase().includes('not a valid') || normalized.toLowerCase().includes('video format')
        ? 'This video format is not supported. Please upload a standard MP4/MOV video under 22 seconds and try again.'
        : normalized || 'The video upload could not be completed. Please try a different video file.';

      return res.status(400).json({ error: friendlyMessage });
    } finally {
      if (filePath) {
        await fs.rm(filePath, { force: true });
      }
    }
  }
);

export default router;
