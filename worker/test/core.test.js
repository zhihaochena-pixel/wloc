import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import worker from '../src/index.js';
import {parseMap,gcjToWgs} from '../src/parse.js';
test('routes and input errors',async()=>{
 for(const input of ['', 'garbage','91,181','https://evil.example/?ll=1,2']) {
 const r=await worker.fetch(new Request('https://local/api/parse?url='+encodeURIComponent(input)));assert.equal(r.status,400);assert.equal((await r.json()).success,false);
 }
 const r=await worker.fetch(new Request('https://local/')); assert.equal(r.status,200);const html=await r.text();assert.match(html,/localStorage/);assert.match(html,/\/api\/parse/);assert.match(html,/gs-loc.apple.com/);
 const script=html.match(/<script>([\s\S]*?)<\/script>/);assert.ok(script);new vm.Script(script[1]);
 assert.equal((await worker.fetch(new Request('https://local/missing'))).status,404);
});
test('coordinates, Apple, Amap, Google, Baidu and conversion',async()=>{
 assert.equal((await parseMap('0,0')).longitude,0);
 assert.equal((await parseMap('https://maps.apple.com/?coordinate=40.7,-74')).longitude,-74);
 assert.equal((await parseMap('https://www.google.com/maps/@40.7,-74,15z')).latitude,40.7);
 const r=await parseMap('https://uri.amap.com/marker?position=1,2&location=116.4,39.9');assert.ok(r.longitude<116.4);
 assert.deepEqual(gcjToWgs(-74,40.7),[-74,40.7]);
 assert.ok((await parseMap('https://map.baidu.com/?location=116.4,39.9')).success);
});
test('shortlinks and redirect host validation',async()=>{
 const result=await parseMap('分享 https://surl.amap.com/abc',async()=>new Response(null,{status:302,headers:{location:'https://uri.amap.com/?location=116.4,39.9'}}));assert.ok(result.success);
 await assert.rejects(()=>parseMap('https://surl.amap.com/abc',async()=>new Response(null,{status:302,headers:{location:'https://127.0.0.1/?ll=1,2'}})));
});
test('unchanged proxy settings save/query/clear for five clients',()=>{
 const code=fs.readFileSync('../dist/wloc-settings.js','utf8');
 for(const client of ['Surge','Quantumult X','Loon','Stash','Shadowrocket']) {
 const store=new Map();
 const run=(query)=>{
 let result;
 const env={console:{log(){}},$request:{url:'https://gs-loc.apple.com/wloc-settings/save?'+query},$script:{startTime:Date.now()},$done:r=>result=r,$persistentStore:{read:k=>store.get(k),write:(v,k)=>(store.set(k,v),true)},$prefs:{valueForKey:k=>store.get(k),setValueForKey:(v,k)=>(store.set(k,v),true)}};
 if(client==='Quantumult X')env.$task={};else if(client==='Loon')env.$loon={};else if(client==='Shadowrocket')env.$rocket={};else env.$environment={[client.toLowerCase()+'-version']:'1'};
 vm.runInNewContext(code,env);return JSON.parse((result.response||result).body);
 };
 assert.equal(run('lon=116.4&lat=39.9').success,true);assert.ok(store.has('wloc_settings'));assert.equal(run('action=query').longitude,116.4);assert.equal(run('action=clear').success,true);assert.equal(run('action=query').success,false);
 }
});

test('legacy Shortcut API and Amap POI order',async()=>{
 const r=await worker.fetch(new Request('https://local/api/parse?u='+encodeURIComponent('https://maps.apple.com/?ll=39.9,116.4')+'&cs=none'));assert.equal(await r.text(),'lat=39.9&lon=116.4');
 const a=await parseMap('https://uri.amap.com/?p=ABC,39.9,116.4,Test,city');assert.ok(Math.abs(a.latitude-39.9)<.01);assert.ok(Math.abs(a.longitude-116.4)<.01);
});
