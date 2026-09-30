// Servidor estático de desenvolvimento; nenhum endpoint de CRUD.
const http = require('http');
const fs = require('fs');
const path = require('path');
const root = __dirname;
const mime = {'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.txt':'text/plain; charset=utf-8'};
http.createServer((req,res)=>{
 let url;
 try { url = decodeURIComponent(new URL(req.url,'http://localhost').pathname); } catch { res.writeHead(400); return res.end('Bad request'); }
 if (req.method !== 'GET' && req.method !== 'HEAD') {res.writeHead(405);return res.end();}
 if (url === '/admin') {res.writeHead(302,{Location:'/admin/'});return res.end();}
 if (url === '/') url='/index.html';
 if (url === '/admin/') url='/admin/index.html';
 const allowed = url === '/index.html' || url === '/admin/index.html' || url === '/robots.txt' || url.startsWith('/assets/');
 const file = path.resolve(root,'.'+url);
 if(!allowed || !file.startsWith(root+path.sep) || url.includes('/.')) {res.writeHead(404);return res.end('Not found');}
 fs.readFile(file,(error,data)=>{if(error){res.writeHead(404);return res.end('Not found');}res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','X-Content-Type-Options':'nosniff','Cache-Control':'no-cache'});res.end(req.method==='HEAD'?undefined:data);});
}).listen(process.env.PORT||8080,()=>console.log('Domorelli em http://localhost:'+(process.env.PORT||8080)));
