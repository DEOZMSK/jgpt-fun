/** Same-origin browser requests only. Never trust a client-supplied destination. */
export function allowedLabRequest(request: Request, readOnly=false): boolean {
 const hosts=new Set(['jgpt.fun','www.jgpt.fun','jgpt-fun.vercel.app']);
 for(const key of ['VERCEL_URL','VERCEL_PROJECT_PRODUCTION_URL']) {const host=process.env[key];if(host&&/^[a-z0-9-]+\.vercel\.app$/.test(host))hosts.add(host);}
 if(process.env.NODE_ENV!=='production'||!process.env.VERCEL)hosts.add('127.0.0.1:3110');
 const url=new URL(request.url),host=request.headers.get('host')||url.host;
 if(!hosts.has(host))return false;
 const origin=request.headers.get('origin'),site=request.headers.get('sec-fetch-site');
 const expected=`${host==='127.0.0.1:3110'?'http':'https'}://${host}`;
 return (origin===expected||(readOnly&&origin===null&&site==='same-origin'))&&(site===null||site==='same-origin');
}
// Bounded per-instance admission control. This supplements platform abuse protection;
// it is deliberately not advertised as a global distributed quota.
const clients=new Map<string,{until:number;count:number}>();let inflight=0;
export function acquireCalculation(request: Request): (()=>void)|null {
 const now=Date.now();for(const [key,value]of clients)if(value.until<=now)clients.delete(key);
 const key=request.headers.get('x-vercel-forwarded-for')?.split(',')[0]||'shared';
 const entry=clients.get(key)||{until:now+60_000,count:0};
 if(inflight>=2||entry.count>=30||(!clients.has(key)&&clients.size>=2000))return null;
 entry.count++;clients.set(key,entry);inflight++;let released=false;
 return ()=>{if(!released){released=true;inflight--;}};
}
