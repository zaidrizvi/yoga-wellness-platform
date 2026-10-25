import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { writeFile,mkdir } from 'node:fs/promises';
import path from 'node:path';
export default async function prepare(){
 const result=await build({configFile:false,plugins:[react()],define:{'process.env.NODE_ENV':JSON.stringify('production')},build:{write:false,minify:true,lib:{entry:path.resolve('tests/fixtures/location-browser.tsx'),formats:['iife'],name:'LocalLocationFixture'}}});
 const chunks=Array.isArray(result)?result:[result];const code=chunks.flatMap(r=>r.output).find(o=>o.type==='chunk').code;
 await mkdir('node_modules/.cache',{recursive:true});await writeFile('node_modules/.cache/location-browser.js',code);
}
