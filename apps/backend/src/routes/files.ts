import { Router, Request, Response, NextFunction } from 'express';
import { readBrandingFile, BRANDING_KEY_RE } from '../services/storage';

// Public: receipt logos and signatures are printed on documents given to customers, and
// each file name carries 64 random bits, so it can't be guessed or listed.
const router = Router();

const CONTENT_TYPES = { png: 'image/png', jpg: 'image/jpeg' } as const;

router.get('/branding/:key', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const key = req.params['key']!;
    if (!BRANDING_KEY_RE.test(key)) { res.status(404).json({ error: 'NOT_FOUND', message: 'File not found' }); return; }
    const file = await readBrandingFile(key);
    if (!file) { res.status(404).json({ error: 'NOT_FOUND', message: 'File not found' }); return; }

    const ext = key.slice(key.lastIndexOf('.') + 1) as keyof typeof CONTENT_TYPES;
    res.setHeader('Content-Type', CONTENT_TYPES[ext]);
    // Every upload gets a new name, so a given URL's content never changes.
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.send(file);
  } catch (err) { next(err); }
});

export default router;
