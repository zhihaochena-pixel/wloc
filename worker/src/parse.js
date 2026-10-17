// Stateless map parser. Only known map hosts may be fetched, including every redirect.
const hosts = new Set(['maps.apple.com','maps.google.com','www.google.com','maps.app.goo.gl','goo.gl','uri.amap.com','surl.amap.com','www.amap.com','amap.com','ditu.amap.com','map.baidu.com','j.map.baidu.com']);
const valid = (lon,lat) => Number.isFinite(lon)&&Number.isFinite(lat)&&Math.abs(lon)<=180&&Math.abs(lat)<=90;
export function gcjToWgs(lon,lat) {
 if(lon<72.004||lon>137.8347||lat<0.8293||lat>55.8271) return [lon,lat];
 const x=lon-105,y=lat-35,pi=Math.PI;
 let a=-100+2*x+3*y+.2*y*y+.1*x*y+.2*Math.sqrt(Math.abs(x));
 let b=300+x+2*y+.1*x*x+.1*x*y+.1*Math.sqrt(Math.abs(x));
 a+=(20*Math.sin(6*x*pi)+20*Math.sin(2*x*pi))*2/3;
 b+=(20*Math.sin(6*x*pi)+20*Math.sin(2*x*pi))*2/3;
 a+=(20*Math.sin(y*pi)+40*Math.sin(y*pi/3))*2/3+(160*Math.sin(y*pi/12)+320*Math.sin(y*pi/30))*2/3;
 b+=(20*Math.sin(x*pi)+40*Math.sin(x*pi/3))*2/3+(150*Math.sin(x*pi/12)+300*Math.sin(x*pi/30))*2/3;
 const rad=lat/180*pi,magic=1-.00669342162296594323*Math.sin(rad)**2,sqrt=Math.sqrt(magic);
 return [lon-b*180/(6378245/sqrt*Math.cos(rad)*pi),lat-a*180/((6378245*(1-.00669342162296594323))/(magic*sqrt)*pi)];
}
function coords(url) {
 const q=url.searchParams;
 if(url.hostname.includes('amap.com') && q.has('p')) { const hit=extractFromString(url.href); if(hit) return [hit.lon,hit.lat]; }
 for(const key of ['coordinate','ll','sll','q','query','center','location','lnglat']) {
  const m=(q.get(key)||'').match(/^(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)(?:,|$)/);
  if(m) { const reverse=['location','lnglat'].includes(key); return reverse?[+m[1],+m[2]]:[+m[2],+m[1]]; }
 }
 const p=q.get('p')?.match(/(?:^|,)(-?\d+\.\d+),(-?\d+\.\d+)(?:,|$)/);
 if(p) return [+p[1],+p[2]];
 const m=url.pathname.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
 return m?[+m[2],+m[1]]:null;
}
export async function parseMap(text, fetcher=fetch, cs="") {
 if(typeof text!=='string'||text.length>4096) throw new Error('Expected map URL or latitude,longitude (max 4096 characters)');
 const raw=text.trim().match(/^(-?\d+(?:\.\d+)?)[,\s]+(-?\d+(?:\.\d+)?)$/);
 let pair,source='coordinates';
 if(raw) pair=[+raw[2],+raw[1]];
 else {
  const match=text.match(/https?:\/\/[^\s<>"，。]+/i); if(!match) throw new Error('No supported map URL');
  let url=new URL(match[0]);
  for(let i=0;i<6;i++) {
   if(url.protocol!=='https:'||!hosts.has(url.hostname)||url.port||url.username||url.password) throw new Error('Unsupported map host');
   source=url.hostname; pair=coords(url); if(pair) break;
   const response=await fetcher(url.href,{redirect:'manual',signal:AbortSignal.timeout(8000)});
   const next=response.headers.get('location');
   if(response.status<300||response.status>=400||!next) {
    if(!response.body) throw new Error('No coordinates in map URL');
    const reader=response.body.getReader();let html='';
    try { while(true) { const {done,value}=await reader.read();if(done) break;html+=new TextDecoder().decode(value);if(html.length>262144) throw new Error('Map response too large'); } } finally {await reader.cancel();}
    const hit=extractFromString(html);if(hit) {pair=[hit.lon,hit.lat];break;}
    throw new Error('No coordinates in map URL');
   }
   if(response.body) await response.body.cancel();
   url=new URL(next,url);
  }
 }
 if(!pair||!valid(...pair)) throw new Error('Invalid or missing coordinates');
 if(source.includes('baidu.com')) {
  const x=pair[0]-.0065,y=pair[1]-.006,z=Math.sqrt(x*x+y*y)-.00002*Math.sin(y*Math.PI*3000/180),theta=Math.atan2(y,x)-.000003*Math.cos(x*Math.PI*3000/180);
  pair=gcjToWgs(z*Math.cos(theta),z*Math.sin(theta));
 } else if(cs==='gcj'||(cs!=='none'&&(source.includes('amap.com')||source==='maps.apple.com'))) { const v=gcj02ToWgs84(pair[1],pair[0]);pair=[v.lon,v.lat]; }
 return {success:true,longitude:pair[0],latitude:pair[1],lon:pair[0],lat:pair[1],name:typeof text==='string' ? (()=>{try{return new URL(text.match(/https?:\/\/[^\s]+/)?.[0]).searchParams.get('name')||'';}catch{return '';}})():'',source,coordinateSystem:'WGS84'};
}

// Coordinate parsing: accepts a map link (Apple Maps / Amap, including short links) and extracts the longitude, latitude and name.
// Amap uses GCJ-02; Apple Maps is also GCJ-02 in mainland China. Both are converted to WGS84 before being fed to wloc;
// gcj02ToWgs84 has a built-in out_of_china check and returns coordinates outside China unchanged (no-op).

export function safeDecode(s) {
  if (!s) return "";
  try {
    return decodeURIComponent(String(s).replace(/\+/g, " "));
  } catch (e) {
    return String(s);
  }
}

// Extract longitude, latitude and name from a string. Handles:
//  Apple Maps coordinate=/ll=/sll=lat,lon  (name in name=...)
//  Amap ?p=POIID,lat,lon,name,city  (comma or %2C)
//  Amap ?q=lat,lon,name             (newer share links, comma or %2C)
//  Plain text lat,lon
export function extractFromString(s) {
  if (!s) return null;
  const str = String(s);
  let m;
  m = str.match(/(?:coordinate|ll|sll)=(-?\d{1,3}\.\d+)(?:,|%2C)(-?\d{1,3}\.\d+)/i);
  if (m) {
    const nm = str.match(/[?&]name=([^&]+)/i);
    return { lat: +m[1], lon: +m[2], name: nm ? safeDecode(nm[1]) : "", src: "apple" };
  }
  m = str.match(
    /[?&]p=[^,&%]*(?:,|%2C)(-?\d{1,3}\.\d+)(?:,|%2C)(-?\d{1,3}\.\d+)(?:(?:,|%2C)((?:(?!,|%2C|&).)+))?/i
  );
  if (m) return { lat: +m[1], lon: +m[2], name: m[3] ? safeDecode(m[3]) : "", src: "amap" };
  m = str.match(
    /[?&]q=(-?\d{1,3}\.\d+)(?:,|%2C)(-?\d{1,3}\.\d+)(?:(?:,|%2C)((?:(?!,|%2C|&).)+))?/i
  );
  if (m) return { lat: +m[1], lon: +m[2], name: m[3] ? safeDecode(m[3]) : "", src: "amap" };
  m = str.match(/(-?\d{1,3}\.\d{4,})\s*(?:,|%2C)\s*(-?\d{1,3}\.\d{4,})/);
  if (m) return { lat: +m[1], lon: +m[2], name: "", src: "text" };
  return null;
}

export function round6(n) {
  return Math.round(Number(n) * 1e6) / 1e6;
}

const GCJ_A = 6378245.0;
const GCJ_EE = 0.00669342162296594323;

function gcjOutOfChina(lng, la) {
  return lng < 72.004 || lng > 137.8347 || la < 0.8293 || la > 55.8271;
}

function gcjDeltaLat(x, y) {
  let r = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
  r += ((20.0 * Math.sin(6.0 * x * Math.PI) + 20.0 * Math.sin(2.0 * x * Math.PI)) * 2.0) / 3.0;
  r += ((20.0 * Math.sin(y * Math.PI) + 40.0 * Math.sin((y / 3.0) * Math.PI)) * 2.0) / 3.0;
  r += ((160.0 * Math.sin((y / 12.0) * Math.PI) + 320 * Math.sin((y * Math.PI) / 30.0)) * 2.0) / 3.0;
  return r;
}

function gcjDeltaLon(x, y) {
  let r = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
  r += ((20.0 * Math.sin(6.0 * x * Math.PI) + 20.0 * Math.sin(2.0 * x * Math.PI)) * 2.0) / 3.0;
  r += ((20.0 * Math.sin(x * Math.PI) + 40.0 * Math.sin((x / 3.0) * Math.PI)) * 2.0) / 3.0;
  r += ((150.0 * Math.sin((x / 12.0) * Math.PI) + 300.0 * Math.sin((x / 30.0) * Math.PI)) * 2.0) / 3.0;
  return r;
}

// WGS84 -> GCJ-02 (forward offset), matching the offset used by Amap / Apple in China.
export function wgs84ToGcj02(lat, lon) {
  if (gcjOutOfChina(lon, lat)) return { lat, lon };
  let dLat = gcjDeltaLat(lon - 105.0, lat - 35.0);
  let dLon = gcjDeltaLon(lon - 105.0, lat - 35.0);
  const radLat = (lat / 180.0) * Math.PI;
  let magic = Math.sin(radLat);
  magic = 1 - GCJ_EE * magic * magic;
  const sqrtMagic = Math.sqrt(magic);
  dLat = (dLat * 180.0) / (((GCJ_A * (1 - GCJ_EE)) / (magic * sqrtMagic)) * Math.PI);
  dLon = (dLon * 180.0) / ((GCJ_A / sqrtMagic) * Math.cos(radLat) * Math.PI);
  return { lat: lat + dLat, lon: lon + dLon };
}

// GCJ-02 -> WGS84 (iterative inverse, sub-meter accuracy).
// A single-pass inverse leaves a 1~2m residual in areas with a steep offset gradient; here a fixed-point
// iteration converges to <0.1m, aligning strictly with Amap's own WGS84->GCJ inverse and removing round-trip residuals.
export function gcj02ToWgs84(lat, lon) {
  if (gcjOutOfChina(lon, lat)) return { lat, lon };
  let wgsLat = lat;
  let wgsLon = lon;
  for (let i = 0; i < 6; i++) {
    const g = wgs84ToGcj02(wgsLat, wgsLon);
    const errLat = g.lat - lat;
    const errLon = g.lon - lon;
    if (Math.abs(errLat) < 1e-9 && Math.abs(errLon) < 1e-9) break;
    wgsLat -= errLat;
    wgsLon -= errLon;
  }
  return { lat: wgsLat, lon: wgsLon };
}
