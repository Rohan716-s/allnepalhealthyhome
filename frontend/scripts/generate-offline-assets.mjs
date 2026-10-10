import { readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const assets = [];
async function collect(directory, recursive) {
  for (const item of await readdir(path.join(root, ".next/static", directory), { withFileTypes: true })) {
    const relative = `${directory}/${item.name}`;
    if (item.isDirectory() && recursive) await collect(relative, true);
    else if (item.isFile() && /\.(js|css|woff2?)$/.test(item.name)) assets.push(`/_next/static/${relative}`);
  }
}
// Shared chunks contain dynamically loaded providers/widgets that may first
// render on an offline reload. Page chunks are cached with visited documents.
await collect("chunks", false);
await collect("css", true);
await collect("media", true);
await writeFile(path.join(root, "public/offline-assets.json"), JSON.stringify(assets.sort()));
console.log(`Prepared ${assets.length} shared offline assets.`);
