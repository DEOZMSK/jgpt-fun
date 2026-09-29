import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const receipt=JSON.parse(await readFile(path.join(root,'data/geonames.json'),'utf8'));
const directory=path.join(root,'.generated/chat-places');await mkdir(directory,{recursive:true});
for(const name of ['cities500.txt.gz','admin1CodesASCII.txt.gz']) {
 const bytes=await readFile(path.join(root,'data',name));
 if(createHash('sha256').update(bytes).digest('hex')!==receipt.assets[name])throw Error('GeoNames asset checksum mismatch: '+name);
 const raw=gunzipSync(bytes,{maxOutputLength:96*1024*1024});
 if(createHash('sha256').update(raw).digest('hex')!==receipt.files[name.slice(0,-3)].sha256)throw Error('GeoNames source checksum mismatch');
 await writeFile(path.join(directory,name),bytes);
}
console.log('Verified and installed pinned GeoNames assets. No live catalog update.');
