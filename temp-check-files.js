const fs = require('fs');
const path = require('path');

function findFiles(dir, pattern, files = []) {
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      findFiles(fullPath, pattern, files);
    } else if (pattern.test(item)) {
      files.push(fullPath);
    }
  }
  return files;
}

const files = findFiles('src/app/[locale]/api', /route\.ts$/);
const missing = [];
const hasActivity = [];

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  const hasUpdate = content.includes('updateUserLastActivity') || content.includes('setLastUpdated');
  if (hasUpdate) {
    hasActivity.push(file);
  } else {
    missing.push(file);
  }
}

console.log('=== FILES WITH ACTIVITY UPDATE ===');
hasActivity.forEach(f => console.log(f));
console.log('');
console.log('=== FILES MISSING ACTIVITY UPDATE ===');
missing.forEach(f => console.log(f));
console.log('');
console.log('Total:', files.length, 'Has:', hasActivity.length, 'Missing:', missing.length);

