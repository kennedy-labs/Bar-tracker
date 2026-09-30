import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';

const rootDir = process.cwd();
const publicDir = path.join(rootDir, 'public');

if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

const zip = new JSZip();

const excludeList = [
  'node_modules',
  'dist',
  '.git',
  '.aistudio',
  'bun.lock',
  'public',
];

function addDirToZip(currentDir, relativePath = '') {
  const items = fs.readdirSync(currentDir);
  for (const item of items) {
    if (excludeList.includes(item)) continue;

    const fullPath = path.join(currentDir, item);
    const itemRelative = relativePath ? `${relativePath}/${item}` : item;
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      addDirToZip(fullPath, itemRelative);
    } else {
      const content = fs.readFileSync(fullPath);
      zip.file(itemRelative, content);
    }
  }
}

addDirToZip(rootDir);

const zipOutputPath = path.join(publicDir, 'bar-track-source.zip');
zip.generateNodeStream({ type: 'nodebuffer', streamFiles: true })
  .pipe(fs.createWriteStream(zipOutputPath))
  .on('finish', () => {
    const sizeMb = (fs.statSync(zipOutputPath).size / 1024).toFixed(1);
    console.log(`Successfully created ${zipOutputPath} (${sizeMb} KB)`);
  });
