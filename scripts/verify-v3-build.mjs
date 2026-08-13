import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { gzipSync } from "node:zlib";

const root = process.cwd();
const distDir = join(root, "dist");
const assetsDir = join(distDir, "assets");
const maxChatGzipBytes = 100 * 1024;
const maxCharacterAssetBytes = 1024 * 1024;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function listFiles(directory) {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });
}

assert(existsSync(distDir), "缺少 dist，请先运行 npm run build。");
assert(existsSync(assetsDir), "构建产物缺少 dist/assets。");

const assetFiles = listFiles(assetsDir);
const chatChunks = assetFiles.filter((path) => /[\\/]ChatPage-[^\\/]+\.js$/.test(path));
assert(chatChunks.length === 1, `预期 1 个 ChatPage 独立 chunk，实际 ${chatChunks.length} 个。`);

const chatGzipBytes = gzipSync(readFileSync(chatChunks[0])).byteLength;
assert(
  chatGzipBytes <= maxChatGzipBytes,
  `ChatPage gzip ${chatGzipBytes} B，超过 ${maxChatGzipBytes} B 上限。`,
);

const characterAssetFiles = [
  ...assetFiles.filter((path) => /(?:fox|mascot)/i.test(basename(path))),
  join(distDir, "icon.svg"),
].filter((path, index, paths) => existsSync(path) && paths.indexOf(path) === index);
const characterAssetBytes = characterAssetFiles.reduce(
  (total, path) => total + statSync(path).size,
  0,
);
assert(
  characterAssetBytes <= maxCharacterAssetBytes,
  `狐狐外部资源 ${characterAssetBytes} B，超过 ${maxCharacterAssetBytes} B 上限。`,
);

const manifestPath = join(distDir, "manifest.webmanifest");
assert(existsSync(manifestPath), "缺少 PWA manifest.webmanifest。");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
assert(manifest.display === "standalone", "PWA manifest display 必须为 standalone。");
assert(manifest.start_url === "/" && manifest.scope === "/", "PWA start_url/scope 异常。");
assert(Array.isArray(manifest.icons) && manifest.icons.length > 0, "PWA manifest 缺少图标。");

const serviceWorkerPath = join(distDir, "sw.js");
assert(existsSync(serviceWorkerPath), "缺少 Workbox sw.js。");
const serviceWorker = readFileSync(serviceWorkerPath, "utf8");
assert(serviceWorker.includes("NetworkOnly"), "sw.js 缺少显式 NetworkOnly 策略。");
assert(
  serviceWorker.includes("foxledger-local-images") &&
    serviceWorker.includes('"image"===') &&
    serviceWorker.includes("location.origin"),
  "本地图片 CacheFirst 边界异常。",
);

const viteConfig = readFileSync(join(root, "vite.config.ts"), "utf8");
for (const marker of [
  "/auth\\/v1",
  "/functions\\/v1",
  "/rest\\/v1",
  "/storage\\/v1",
  'handler: "NetworkOnly"',
]) {
  assert(viteConfig.includes(marker), `vite.config.ts 缺少敏感缓存边界：${marker}`);
}

console.log(
  `V3 构建验收通过：ChatPage gzip ${chatGzipBytes} B；狐狐外部资源 ${characterAssetBytes} B；PWA NetworkOnly/本地图片边界正常。`,
);
