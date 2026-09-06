// Render every icon size from the same vector artwork (Windows and WSL).
const fs = require("node:fs");
const path = require("node:path");
const { Resvg } = require("@resvg/resvg-js");
const sizes = [16, 20, 24, 32, 40, 48, 64, 128, 256];
const svg = fs.readFileSync(path.join(__dirname, "app-icon.svg"), "utf8");
const pngs = sizes.map(size => new Resvg(svg, { fitTo: { mode: "width", value: size } }).render().asPng());
const header = Buffer.alloc(6 + sizes.length * 16);
header.writeUInt16LE(1, 2); header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
sizes.forEach((size, i) => {
  const at = 6 + 16 * i;
  header[at] = header[at + 1] = size === 256 ? 0 : size;
  header.writeUInt16LE(1, at + 4); header.writeUInt16LE(32, at + 6);
  header.writeUInt32LE(pngs[i].length, at + 8); header.writeUInt32LE(offset, at + 12);
  offset += pngs[i].length;
});
fs.writeFileSync(path.join(__dirname, "LucentWeather.ico"), Buffer.concat([header, ...pngs]));
console.log(`Built LucentWeather.ico: ${sizes.join(", ")} px from app-icon.svg`);
