import {getPageHtml} from './page.js';
import { parseMap } from './parse.js';
const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type'};
export default {
 async fetch(request) {
  const url=new URL(request.url);
  if(request.method==='OPTIONS') return new Response(null,{headers});
  if(url.pathname==='/api/parse') {
   if(!['GET','POST'].includes(request.method)) return Response.json({success:false,error:'Method not allowed'},{status:405,headers});
   try {
    if(Number(request.headers.get('content-length'))>8192) throw new Error('Input too large');
    let input=url.searchParams.get('u')||url.searchParams.get('url')||url.searchParams.get('text');
    if(request.method==='POST') {const body=await request.text();if(body.length>8192) throw new Error('Input too large');const data=JSON.parse(body);input=data.url||data.text;}
    const data=await parseMap(input,fetch,url.searchParams.get('cs'));
    if(url.searchParams.has('u')&&url.searchParams.get('format')!=='json') return new Response(`lat=${data.lat}&lon=${data.lon}`,{headers:{...headers,'Content-Type':'text/plain; charset=utf-8'}});
    return Response.json(data,{headers});
   } catch(error) {return Response.json({success:false,error:error.message},{status:400,headers});}
  }
  if(url.pathname!=='/') return new Response('Not found',{status:404});
  if(request.method!=='GET') return new Response('Method not allowed',{status:405});
  return new Response(getPageHtml(),{headers:{'Content-Type':'text/html; charset=utf-8'}});
 }
};
