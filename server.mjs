import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root=resolve(fileURLToPath(new URL('.',import.meta.url)));
const contentTypes={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8'};
const port=Number(process.env.PORT||3000);

const server=createServer(async(request,response)=>{
  if(!['GET','HEAD'].includes(request.method||'')){
    response.writeHead(405,{'content-type':'text/plain; charset=utf-8','allow':'GET, HEAD'});response.end('Method not allowed');return;
  }
  let pathname;
  try{pathname=decodeURIComponent(new URL(request.url||'/',`http://${request.headers.host||'localhost'}`).pathname);}
  catch{response.writeHead(400);response.end('Bad request');return;}
  const relative=pathname==='/'?'index.html':pathname.replace(/^[/\\]+/,'');
  const filename=resolve(root,relative);
  if(filename!==root&&!filename.startsWith(root+sep)){
    response.writeHead(404);response.end('Not found');return;
  }
  const type=contentTypes[extname(filename)];
  if(!type){response.writeHead(404);response.end('Not found');return;}
  try{
    const body=await readFile(filename);
    response.writeHead(200,{'content-type':type,'cache-control':'no-store'});
    response.end(request.method==='HEAD'?undefined:body);
  }catch{
    response.writeHead(404,{'content-type':'text/plain; charset=utf-8'});response.end('Not found');
  }
});

server.listen(port,'0.0.0.0',()=>process.stdout.write(`Frame local server ready at http://localhost:${port}\n`));
