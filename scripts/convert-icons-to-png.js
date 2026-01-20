const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// Generate PNG icons from SVG
const generatePngIcons = async () => {
  const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
  const iconsDir = path.join(__dirname, '..', 'public', 'icons');
  const masterSvg = path.join(iconsDir, 'icon.svg');

  if (!fs.existsSync(masterSvg)) {
    console.error('Master icon.svg not found. Run generate-pwa-icons.js first.');
    process.exit(1);
  }

  console.log('Converting SVG icons to PNG...\n');

  for (const size of sizes) {
    const svgPath = path.join(iconsDir, `icon-${size}x${size}.svg`);
    const pngPath = path.join(iconsDir, `icon-${size}x${size}.png`);

    try {
      await sharp(svgPath)
        .resize(size, size)
        .png()
        .toFile(pngPath);
      
      console.log(`✓ Generated icon-${size}x${size}.png`);
    } catch (error) {
      console.error(`✗ Error generating icon-${size}x${size}.png:`, error.message);
    }
  }

  // Also create favicon.ico
  try {
    await sharp(path.join(iconsDir, 'icon-192x192.svg'))
      .resize(32, 32)
      .png()
      .toFile(path.join(__dirname, '..', 'public', 'favicon.png'));
    
    console.log('✓ Generated favicon.png');
  } catch (error) {
    console.error('✗ Error generating favicon.png:', error.message);
  }

  console.log('\n✓ All PNG icons generated successfully!');
};

generatePngIcons().catch(console.error);
