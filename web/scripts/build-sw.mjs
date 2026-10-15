import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
const files=readdirSync('dist/assets').filter(name=>/\.(js|css|woff2)$/.test(name)).map(name=>`/assets/${name}`);
const version=createHash('sha256').update(files.join(',')+readFileSync('dist/index.html')).digest('hex').slice(0,16);
const template=readFileSync('public/sw.js','utf8');
writeFileSync('dist/sw.js',template.replace("'__CACHE__'",JSON.stringify(`chudlog-static-${version}`)).replace('/*__PRECACHE__*/[]',JSON.stringify(['/','/index.html','/offline.html','/icon.svg','/manifest.webmanifest','/icons/icon-180.png','/icons/icon-192.png','/icons/icon-512.png',...files])));
