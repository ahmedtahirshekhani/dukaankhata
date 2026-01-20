const fs = require('fs');
const path = require('path');

// Simple SVG icon generator
const generateIcon = (size) => {
  const svg = `
<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#3b82f6;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#1d4ed8;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${size * 0.15}" fill="url(#grad)"/>
  <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="${size * 0.35}" font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="central">DK</text>
</svg>`.trim();
  
  return svg;
};

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const iconsDir = path.join(__dirname, '..', 'public', 'icons');

// Ensure icons directory exists
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Generate SVG icons
sizes.forEach(size => {
  const svg = generateIcon(size);
  const filename = `icon-${size}x${size}.svg`;
  const filepath = path.join(iconsDir, filename);
  
  fs.writeFileSync(filepath, svg);
  console.log(`Generated ${filename}`);
});

// Create a master icon.svg
const masterIcon = generateIcon(512);
fs.writeFileSync(path.join(iconsDir, 'icon.svg'), masterIcon);
console.log('Generated master icon.svg');

console.log('\n✓ All SVG icons generated successfully!');
console.log('Note: For production, convert these SVGs to PNG using an image converter or design tool.');
console.log('You can use online tools like https://cloudconvert.com/svg-to-png or image processing libraries.');
