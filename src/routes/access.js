import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { rateLimit } from 'express-rate-limit';
import { config } from '../config.js';

const router = Router();

const passwordLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many password attempts. Please try again later.' },
});

router.post('/verify', passwordLimit, async (req, res) => {
  const { page, password } = req.body || {};
  if (
    (page !== undefined && page !== 'birthday' && page !== 'wish') ||
    typeof password !== 'string' ||
    password.length > 256
  ) {
    return res.status(400).json({ error: 'Enter a valid password.' });
  }

  const pages = page ? [page] : ['birthday', 'wish'];
  const matches = await Promise.all(
    pages.map(async (candidate) => ({
      page: candidate,
      matches: await bcrypt.compare(password, config.pagePasswordHashes[candidate]),
    }))
  );
  const destination = matches.find((result) => result.matches)?.page;
  if (!destination) {
    return res.status(401).json({ error: 'That password is not correct.' });
  }

  const token = jwt.sign(
    { type: 'page-access', page: destination },
    config.jwtSecret,
    { expiresIn: '8h' }
  );
  res.json({ token, page: destination });
});

export default router;
