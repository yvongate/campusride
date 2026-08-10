import { existsSync, mkdirSync } from 'fs';
import { extname, join } from 'path';
import { diskStorage } from 'multer';

export const IDENTITE_UPLOADS_DIR = join(
  process.cwd(),
  'uploads',
  'identite',
);

if (!existsSync(IDENTITE_UPLOADS_DIR)) {
  mkdirSync(IDENTITE_UPLOADS_DIR, { recursive: true });
}

export const identiteFilesStorage = diskStorage({
  destination: IDENTITE_UPLOADS_DIR,
  filename: (req, file, callback) => {
    const userId = (req as unknown as { user?: { userId?: string } }).user
      ?.userId;
    const unique = `${userId ?? 'anon'}-${file.fieldname}-${Date.now()}${extname(file.originalname)}`;
    callback(null, unique);
  },
});
