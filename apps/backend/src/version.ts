import { readFileSync } from 'fs';
import { join } from 'path';

let ver = '0.0.0';
try {
  const raw = readFileSync(join(process.cwd(), 'package.json'), 'utf-8');
  ver = JSON.parse(raw).version ?? ver;
} catch {
  try {
    const raw = readFileSync(join(__dirname, '..', 'package.json'), 'utf-8');
    ver = JSON.parse(raw).version ?? ver;
  } catch {
    /* fallback */
  }
}

export const APP_VERSION = ver;
