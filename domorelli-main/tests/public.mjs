import {parseHTML} from 'linkedom';import vm from 'node:vm';import fs from 'node:fs';import assert from 'node:assert/strict';import {spawn} from 'node:child_process';
const {window,document}=parseHTML(fs.readFileSync('index.html','utf8'));
const rows=[{id:1,name:'<img onerror=alert(1)>',description:'Descrição',category:'Entradas',price_cents:1300,featured:true,image_path:null}];
window.DOMORELLI_CONFIG={categories:['Entradas'],whatsapp:'5538991276369'};
window.Domorelli={listProducts:async()=>rows,formatPrice:()=> 'R$ 13,00',imageUrl:()=>''};
await vm.runInNewContext(fs.readFileSync('assets/js/menu.js','utf8'),{window,document,encodeURIComponent,CustomEvent:window.CustomEvent});
assert.equal(document.querySelectorAll('#cardapio').length,1);assert.equal(document.querySelectorAll('.menu__item').length,1);assert.equal(document.querySelectorAll('.signature__item').length,1);assert.equal(document.querySelector('.menu__item-name').textContent,rows[0].name);assert.equal(document.querySelectorAll('.menu__item-name img').length,0);assert.match(document.querySelector('[data-whatsapp]').href,/wa.me\/5538991276369/);
const server=spawn(process.execPath,['server.js'],{env:{...process.env,PORT:'8182'}});
try{await new Promise(r=>server.stdout.once('data',r));for(const [path,status] of [['/',200],['/admin',302],['/admin/',200],['/admin/index.html?x=1',200],['/assets/js/admin.js',200],['/supabase/menu-seed.sql',404],['/package.json',404]])assert.equal((await fetch('http://localhost:8182'+path,{redirect:'manual'})).status,status);}finally{server.kill();}
console.log('PASS: public DOM rendering, XSS text, unique IDs, highlights, WhatsApp configuration and HTTP routes.');
