import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';

const rootDir = process.cwd();
const zip = new JSZip();

const IGNORE_PATTERNS = [
  'node_modules',
  'dist',
  '.git',
  '.env',
  'chbd-project.zip',
  '.aistudio',
  '.cache'
];

function shouldInclude(filePath) {
  const rel = path.relative(rootDir, filePath);
  for (const ign of IGNORE_PATTERNS) {
    if (rel === ign || rel.startsWith(ign + path.sep) || rel.includes(path.sep + ign + path.sep)) {
      return false;
    }
  }
  return true;
}

function addDirectoryToZip(dirPath, zipFolder) {
  const items = fs.readdirSync(dirPath);
  for (const item of items) {
    const fullPath = path.join(dirPath, item);
    if (!shouldInclude(fullPath)) continue;

    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      const subFolder = zipFolder.folder(item);
      addDirectoryToZip(fullPath, subFolder);
    } else {
      const content = fs.readFileSync(fullPath);
      zipFolder.file(item, content);
    }
  }
}

async function main() {
  console.log('Packaging project into public/chbd-project.zip...');
  addDirectoryToZip(rootDir, zip);

  const publicDir = path.join(rootDir, 'public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  const outputPath = path.join(publicDir, 'chbd-project.zip');
  const buffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 }
  });

  fs.writeFileSync(outputPath, buffer);
  console.log(`Successfully created ${outputPath} (${(buffer.length / 1024 / 1024).toFixed(2)} MB)`);
}

main().catch(console.error);
