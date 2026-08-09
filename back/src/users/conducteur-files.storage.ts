import { existsSync, mkdirSync } from 'fs';
import { extname, join } from 'path';
import { diskStorage } from 'multer';

export const CONDUCTEUR_UPLOADS_DIR = join(
  process.cwd(),
  'uploads',
  'conducteur',
);

if (!existsSync(CONDUCTEUR_UPLOADS_DIR)) {
  mkdirSync(CONDUCTEUR_UPLOADS_DIR, { recursive: true });
}

export const conducteurFilesStorage = diskStorage({
  destination: CONDUCTEUR_UPLOADS_DIR,
  filename: (req, file, callback) => {
    const userId = (req as unknown as { user?: { userId?: string } }).user
      ?.userId;
    const unique = `${userId ?? 'anon'}-${file.fieldname}-${Date.now()}${extname(file.originalname)}`;
    callback(null, unique);
  },
});
