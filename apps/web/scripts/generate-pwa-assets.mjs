import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const source = path.resolve(root, "public/branding/icon.png");
const outDir = path.resolve(root, "public/icons");

if (!fs.existsSync(source)) {
  console.error(`Icone MixParty introuvable : ${source}`);
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });

const background = { r: 9, g: 7, b: 17, alpha: 1 };

async function square(size, filename) {
  await sharp(source)
    .resize(size, size, { fit: "cover" })
    .png()
    .toFile(path.join(outDir, filename));
}

async function maskable() {
  const iconSize = 360;
  const icon = await sharp(source)
    .resize(iconSize, iconSize, { fit: "cover" })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 4,
      background,
    },
  })
    .composite([{ input: icon, gravity: "centre" }])
    .png()
    .toFile(path.join(outDir, "mixparty-maskable-512.png"));
}

await square(192, "mixparty-192.png");
await square(512, "mixparty-512.png");
await square(180, "apple-touch-icon.png");
await maskable();

console.log("PWA MixParty : icones 192 / 512 / maskable / Apple generees.");
