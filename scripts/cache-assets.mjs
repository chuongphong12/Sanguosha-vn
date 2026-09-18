import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const publicAssetsDir = path.join(rootDir, 'public', 'assets');
const cacheDir = path.join(rootDir, 'node_modules', '.cache', 'assetpack-outputs');

const action = process.argv[2]; // 'save' or 'restore'

function copyDirectory(src, dest) {
  if (!fs.existsSync(src)) return;
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (let entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirectory(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

if (action === 'restore') {
  if (fs.existsSync(cacheDir)) {
    console.log(`[Cache-Assets] Restoring from ${cacheDir} to ${publicAssetsDir}`);
    copyDirectory(cacheDir, publicAssetsDir);
  } else {
    console.log(`[Cache-Assets] No cache found at ${cacheDir}`);
  }
} else if (action === 'save') {
  if (fs.existsSync(publicAssetsDir)) {
    console.log(`[Cache-Assets] Saving from ${publicAssetsDir} to ${cacheDir}`);
    copyDirectory(publicAssetsDir, cacheDir);
  } else {
    console.log(`[Cache-Assets] No assets found at ${publicAssetsDir}`);
  }
} else {
  console.error("Usage: node cache-assets.mjs <save|restore>");
  process.exit(1);
}
