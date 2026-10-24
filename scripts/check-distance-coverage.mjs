// 校验每个世界都有 endpointNotes 注记与距离锚点，防止新增世界时距离计算再崩
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const worldSrc = fs.readFileSync(path.join(root, 'js/world.js'), 'utf8');
const worldIds = [...worldSrc.matchAll(/id: '(\w+)', name:/g)].map((m) => m[1]);

const notesSrc = fs.readFileSync(path.join(root, 'js/distanceNarratives.js'), 'utf8');
const noteIds = new Set([...notesSrc.matchAll(/^  (\w+): \{ departure:/gm)].map((m) => m[1]));

const atlasSrc = fs.readFileSync(path.join(root, 'js/atlas.js'), 'utf8');
const anchorBlock = atlasSrc.slice(atlasSrc.indexOf('const distanceAnchorByWorld'), atlasSrc.indexOf(']);', atlasSrc.indexOf('const distanceAnchorByWorld')));
const anchorIds = new Set([...anchorBlock.matchAll(/\['(\w+)', new THREE\.Vector3/g)].map((m) => m[1]));

const solar = new Set(['mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune']);
// 星系级锚点兜底：systemDefinitions 里的 distanceLy 会经 distanceAnchorBySystem 覆盖同星系全部世界
const systemBlock = atlasSrc.slice(atlasSrc.indexOf('const systemDefinitions'), atlasSrc.indexOf('];', atlasSrc.indexOf('const systemDefinitions')));
const sysNames = new Set([...systemBlock.matchAll(/name: '([^']+)'/g)].map((m) => m[1]));

const worldSystemById = new Map([...worldSrc.matchAll(/id: '(\w+)', name: '[^']+',[\s\S]*?system: '([^']+)'/g)].map((m) => [m[1], m[2]]));

const missing = [];
for (const id of worldIds) {
  if (solar.has(id)) continue;
  if (!noteIds.has(id)) missing.push(`${id}: 缺 endpointNotes（会直接导致距离计算崩溃）`);
  const hasAnchor = anchorIds.has(id) || sysNames.has(worldSystemById.get(id));
  if (!hasAnchor) missing.push(`${id}: 无显式 distanceAnchor 且星系 ${worldSystemById.get(id)} 未定义`);
}
if (missing.length) {
  console.error('FAIL:\n' + missing.join('\n'));
  process.exit(1);
}
console.log(`OK: ${worldIds.length} 个世界（太阳系 ${solar.size} 个由星历接管），endpointNotes 全覆盖；距离锚点显式 ${anchorIds.size} 条 + 星系兜底`);
