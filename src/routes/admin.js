import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { v2 as cloudinary } from 'cloudinary';
import jwt from 'jsonwebtoken';
import { rateLimit } from 'express-rate-limit';
import { config } from '../config.js';
import { requireAdmin } from '../middleware/adminAuth.js';
import { Wish } from '../models/Wish.js';

const router = Router();

const loginLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again later.' },
});

async function removeCloudinaryVideo(publicId) {
  const result = await cloudinary.uploader.destroy(publicId, {
    resource_type: 'video',
    invalidate: true,
  });
  if (result.result !== 'ok' && result.result !== 'not found') {
    throw new Error(`Cloudinary did not remove the video (${result.result}).`);
  }
}

router.post('/login', loginLimit, async (req, res) => {
  const { username, password } = req.body || {};
  if (typeof username !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Enter your admin username and password.' });
  }

  const passwordMatches = await bcrypt.compare(password, config.adminPasswordHash);
  if (username !== config.adminUsername || !passwordMatches) {
    return res.status(401).json({ error: 'Invalid admin username or password.' });
  }

  const token = jwt.sign(
    { type: 'admin', sub: config.adminUsername },
    config.jwtSecret,
    { expiresIn: '2h' }
  );
  res.json({ token });
});

router.get('/wishes', requireAdmin, async (_req, res) => {
  const wishes = await Wish.find()
    .select('name message videoUrl durationSeconds status createdAt')
    .sort({ createdAt: -1 })
    .lean();
  res.json({ wishes });
});

router.patch('/wishes/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const status = req.body?.status;

  if (!/^[a-f\d]{24}$/i.test(id)) {
    return res.status(400).json({ error: 'Invalid video-wish ID.' });
  }
  if (status !== 'approved' && status !== 'rejected') {
    return res.status(400).json({ error: 'Choose approve or reject.' });
  }

  const wish = await Wish.findOne({ _id: id, status: 'pending' }).select('+publicId');
  if (!wish) {
    return res.status(404).json({ error: 'Pending video wish not found.' });
  }

  if (status === 'rejected') {
    await removeCloudinaryVideo(wish.publicId);
  }

  wish.status = status;
  wish.approvedAt = status === 'approved' ? new Date() : null;
  if (status === 'rejected') {
    wish.videoUrl = '';
  }
  await wish.save();

  return res.json({
    message: status === 'approved' ? 'Video wish approved.' : 'Video wish rejected.',
  });
});

router.delete('/wishes/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  if (!/^[a-f\d]{24}$/i.test(id)) {
    return res.status(400).json({ error: 'Invalid video-wish ID.' });
  }

  const wish = await Wish.findById(id).select('+publicId');
  if (!wish) {
    return res.status(404).json({ error: 'Video wish not found.' });
  }

  await removeCloudinaryVideo(wish.publicId);
  await wish.deleteOne();
  return res.json({ message: 'Video wish permanently deleted.' });
});

export default router;
