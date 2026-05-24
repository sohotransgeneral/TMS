const sharp = require("sharp");
const path = require("path");

const svg = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">
    <rect width="512" height="512" rx="80" fill="#2563eb"/>
    <text x="256" y="355" font-family="Arial,sans-serif" font-size="280" font-weight="bold" fill="white" text-anchor="middle">T</text>
  </svg>`
);

const pub = path.join(__dirname, "..", "public");

Promise.all([
  sharp(svg).resize(192, 192).png().toFile(path.join(pub, "icon-192.png")),
  sharp(svg).resize(512, 512).png().toFile(path.join(pub, "icon-512.png")),
  sharp(svg).resize(180, 180).png().toFile(path.join(pub, "apple-touch-icon.png")),
  sharp(svg).resize(32, 32).png().toFile(path.join(pub, "favicon.png")),
])
  .then(() => {
    console.log("Icons generated successfully");
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
