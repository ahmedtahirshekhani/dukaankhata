const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

/**
 * Generate PWA icons from DukaanKhataLogo.png
 * Creates properly sized icons for all PWA requirements
 */

const generatePWAIcons = async () => {
  const sourceLogo = path.join(
    __dirname,
    "..",
    "public",
    "DukaanKhataLogo.png",
  );
  const iconsDir = path.join(__dirname, "..", "public", "icons");

  // Ensure icons directory exists
  if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
  }

  // Check if source logo exists
  if (!fs.existsSync(sourceLogo)) {
    console.error(
      "❌ Error: DukaanKhataLogo.png not found in public directory",
    );
    process.exit(1);
  }

  // Get source image metadata
  const metadata = await sharp(sourceLogo).metadata();
  console.log(
    `📐 Source logo dimensions: ${metadata.width}x${metadata.height}`,
  );
  console.log(`📦 Format: ${metadata.format}`);

  // Define required icon sizes for PWA
  const sizes = [
    72, // Android Chrome minimum
    96, // Windows tile
    128, // Progressive Web App
    144, // Windows tile
    152, // iOS
    192, // Android Chrome standard
    384, // Android Chrome high-res
    512, // Splash screen and high-res displays
  ];

  console.log("\n🎨 Generating PWA icons...\n");

  for (const size of sizes) {
    try {
      const outputPath = path.join(iconsDir, `icon-${size}x${size}.png`);

      await sharp(sourceLogo)
        .resize(size, size, {
          fit: "contain",
          background: { r: 255, g: 255, b: 255, alpha: 0 }, // Transparent background
        })
        .png()
        .toFile(outputPath);

      console.log(`✅ Generated icon-${size}x${size}.png`);
    } catch (error) {
      console.error(`❌ Error generating ${size}x${size} icon:`, error.message);
    }
  }

  // Generate favicon
  try {
    const faviconPath = path.join(__dirname, "..", "public", "favicon.png");
    await sharp(sourceLogo)
      .resize(32, 32, {
        fit: "contain",
        background: { r: 255, g: 255, b: 255, alpha: 0 },
      })
      .png()
      .toFile(faviconPath);

    console.log("✅ Generated favicon.png (32x32)");
  } catch (error) {
    console.error("❌ Error generating favicon:", error.message);
  }

  // Generate apple-touch-icon
  try {
    const appleTouchPath = path.join(iconsDir, "apple-touch-icon.png");
    await sharp(sourceLogo)
      .resize(180, 180, {
        fit: "contain",
        background: { r: 255, g: 255, b: 255, alpha: 0 },
      })
      .png()
      .toFile(appleTouchPath);

    console.log("✅ Generated apple-touch-icon.png (180x180)");
  } catch (error) {
    console.error("❌ Error generating apple-touch-icon:", error.message);
  }

  console.log("\n✅ All PWA icons generated successfully!");
  console.log("\n📝 Next steps:");
  console.log("1. Update manifest.json to reference the new icon sizes");
  console.log("2. Clear browser cache and service worker");
  console.log("3. Uninstall any existing PWA installation");
  console.log("4. Reinstall the PWA to see the new icons\n");
};

generatePWAIcons().catch((error) => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});
