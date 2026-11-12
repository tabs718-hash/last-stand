import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
const pkg=JSON.parse(await readFile('package.json','utf8'));
assert.match(await readFile('src/config/version.ts','utf8'),new RegExp("VERSION='"+pkg.version.replaceAll('.','\\.')+"'"));
const manifest=JSON.parse(await readFile('dist/.vite/manifest.json','utf8'));
const entry=Object.entries(manifest).find(([,v])=>v.isEntry);assert.ok(entry,'Vite entry required');
const initial=new Set();function visit(key){assert.ok(manifest[key],`Missing chunk ${key}`);if(initial.has(key))return;initial.add(key);for(const dependency of manifest[key].imports??[])visit(dependency)}visit(entry[0]);
assert.ok(![...initial].some(k=>manifest[k].file.includes('physics-vendor')),'Physics must stay outside the initial UI graph');
assert.ok(Object.values(manifest).some(v=>v.file.includes('physics-vendor')),'Deferred physics must be packaged');
let initialBytes=0,initialGzip=0,totalBytes=0,totalGzip=0;const files=new Set();
for(const [key,chunk] of Object.entries(manifest)){
 const data=await readFile('dist/'+chunk.file);assert.ok(data.length);if(files.has(chunk.file))continue;files.add(chunk.file);
 if(chunk.file.endsWith('.js')){const gz=gzipSync(data).length;totalBytes+=data.length;totalGzip+=gz;if(initial.has(key)){initialBytes+=data.length;initialGzip+=gz}}
 for(const name of [...chunk.css??[],...chunk.assets??[]])assert.ok((await readFile('dist/'+name)).length);
}
const assets=[];
for(const name of ['cowboy','revolver','volcanic','magnum','power-gun','hat','holster']){
 const path='assets/'+name+'.glb',data=await readFile('dist/'+path);assert.equal(data.toString('ascii',0,4),'glTF');assert.equal(data.readUInt32LE(8),data.length);assert.deepEqual(data,await readFile('public/'+path));
 assets.push({path,bytes:data.length,sha256:createHash('sha256').update(data).digest('hex')});
}
assert.ok((await readFile('dist/assets/CREDITS.md')).length);
const release={version:pkg.version,initialJavaScript:{bytes:initialBytes,gzipBytes:initialGzip},totalJavaScript:{bytes:totalBytes,gzipBytes:totalGzip},assets};
await writeFile('dist/release.json',JSON.stringify(release,null,2)+'\n');console.log(JSON.stringify({verified:true,...release}));
