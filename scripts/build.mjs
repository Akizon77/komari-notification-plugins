import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { deflateRawSync } from "node:zlib";

const root = resolve(import.meta.dirname, "..");
const dist = join(root, "dist");
const pluginNames = [
  "bark-notification-plugin",
  "email-notification-plugin",
  "serverchan3-notification-plugin",
  "serverchanturbo-notification-plugin",
  "telegram-notification-plugin",
];

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function u16(value) {
  const buffer = Buffer.alloc(2);
  buffer.writeUInt16LE(value);
  return buffer;
}

function u32(value) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32LE(value >>> 0);
  return buffer;
}

function createZip(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const data = entry.data;
    const compressed = deflateRawSync(data, { level: 9 });
    const checksum = crc32(data);
    const local = Buffer.concat([
      u32(0x04034b50), u16(20), u16(0x0800), u16(8), u16(0), u16(0),
      u32(checksum), u32(compressed.length), u32(data.length), u16(name.length), u16(0),
      name, compressed,
    ]);
    localParts.push(local);
    centralParts.push(Buffer.concat([
      u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(8), u16(0), u16(0),
      u32(checksum), u32(compressed.length), u32(data.length), u16(name.length),
      u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), name,
    ]));
    offset += local.length;
  }
  const localData = Buffer.concat(localParts);
  const centralData = Buffer.concat(centralParts);
  const end = Buffer.concat([
    u32(0x06054b50), u16(0), u16(0), u16(entries.length), u16(entries.length),
    u32(centralData.length), u32(localData.length), u16(0),
  ]);
  return Buffer.concat([localData, centralData, end]);
}

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

const checksums = [];
for (const name of pluginNames) {
  const sourceDir = join(root, name);
  const files = (await readdir(sourceDir)).sort();
  const manifest = JSON.parse(await readFile(join(sourceDir, "komari-plugin.json"), "utf8"));
  if (manifest.version !== "1.0.0" || manifest.komari !== ">=1.6.0") {
    throw new Error(`${name}: expected version 1.0.0 and komari >=1.6.0`);
  }
  const syntax = spawnSync(process.execPath, ["--check", join(sourceDir, manifest.entry)], {
    encoding: "utf8",
  });
  if (syntax.status !== 0) throw new Error(syntax.stderr || `${name}: script syntax check failed`);

  const entries = [];
  for (const filename of ["komari-plugin.json", "script.js", "icon.webp"]) {
    if (!files.includes(filename)) throw new Error(`${name}: missing ${filename}`);
    entries.push({ name: filename, data: await readFile(join(sourceDir, filename)) });
  }
  const zip = createZip(entries);
  const output = join(dist, `${name}.zip`);
  await writeFile(output, zip);
  checksums.push(`${createHash("sha256").update(zip).digest("hex")}  ${basename(output)}`);
  console.log(`built ${basename(output)} (${zip.length} bytes)`);
}

await writeFile(join(dist, "SHA256SUMS.txt"), checksums.join("\n") + "\n");
