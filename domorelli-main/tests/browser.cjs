const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
const server=spawn(process.execPath,['server.js'],{env:{...process.env,PORT:'8181'}});
const mock = () => {
 let session=null, serial=0;
 const state = window.testState={rows:[],files:[],failUpload:false,failDelete:false,failUpdate:false,loseUpdateResponse:false};
 const result=(data,error=null)=>Promise.resolve({data,error});
 const client={
 auth:{getSession:()=>result({session}),signInWithPassword:()=>{session={user:{is_anonymous:false}};return result({session});},signOut:()=>{session=null;return result(null);},onAuthStateChange:()=>{}},
 storage:{from:()=>({getPublicUrl:path=>({data:{publicUrl:'/assets/images/logo-domorelli.png?'+path}}),upload:path=>{if(state.failUpload)return result(null,{message:'Upload indisponível'});state.files.push(path);return result({path});},remove:paths=>{if(state.failDelete)return result(null,{message:'Storage indisponível'});state.files=state.files.filter(p=>!paths.includes(p));return result({});}})},
 from:()=>{let mode='read',payload,filters=[];const q={select:()=>q,order:()=>q,eq:(k,v)=>{filters.push([k,v]);return q;},insert:p=>{mode='insert';payload=p;return q;},update:p=>{mode='update';payload=p;return q;},delete:()=>{mode='delete';return q;},range:()=>result(state.rows.map(p=>({...p}))),maybeSingle:()=>q.single(),single:()=>{if(mode==='insert'){const row={...payload,id:++serial,image_path:null,updated_at:String(serial)};state.rows.push(row);return result({...row});}const index=state.rows.findIndex(p=>filters.every(([k,v])=>p[k]===v));if(index<0)return result(null,{message:'Conflito'});if(mode==='read')return result({...state.rows[index]});if(mode==='delete')return result(state.rows.splice(index,1)[0]);if(state.failUpdate)return result(null,{message:'Falha no banco'});Object.assign(state.rows[index],payload,{updated_at:String(++serial)});if(state.loseUpdateResponse){state.loseUpdateResponse=false;return result(null,{message:'Resposta perdida'});}return result({...state.rows[index]});}};return q;}
 };window.supabase={createClient:()=>client};
};
(async()=>{
 let browser;
 try {
  await new Promise(r=>server.stdout.once('data',r));
  const base='http://localhost:8181';
  assert.equal((await fetch(base+'/admin',{redirect:'manual'})).status,302);
  assert.equal((await fetch(base+'/supabase/menu-seed.sql')).status,404);
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE,args:['--no-sandbox','--disable-dev-shm-usage']});
  const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/admin/');await page.getByRole('status').filter({hasText:'Configure o Supabase'}).waitFor();
  await page.route('**/assets/js/vendor/supabase.js',route=>route.fulfill({contentType:'text/javascript',body:`(${mock.toString()})();`}));
  await page.route('**/assets/js/config.js',async route=>{const response=await route.fetch();let body=await response.text();body=body.replace("supabaseUrl: ''","supabaseUrl: 'https://example.supabase.co'").replace("supabasePublishableKey: ''","supabasePublishableKey: 'sb_publishable_test'");await route.fulfill({response,body});});
  await page.reload();await page.locator('[name=email]').fill('admin@example.com');await page.locator('[name=password]').fill('test-password');await page.getByRole('button',{name:'Entrar',exact:true}).click();
  await page.getByRole('button',{name:'+ Novo produto'}).click();
  await page.locator('[name=name]').fill('<img src=x onerror=alert(1)>');await page.locator('[name=price]').fill('52,90');await page.locator('[name=featured]').check();
  const photo={name:'test.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX9sAAAAASUVORK5CYII=','base64')};
  await page.locator('[name=photo]').setInputFiles(photo);await page.getByRole('button',{name:'Salvar',exact:true}).click();await page.locator('#editor').waitFor({state:'hidden'});
  assert.equal(await page.locator('#rows tr').count(),1);assert.equal(await page.evaluate(()=>testState.rows[0].price_cents),5290);assert.equal(await page.locator('#rows td:nth-child(2) img').count(),0);
  await page.getByRole('button',{name:'Editar',exact:true}).click();await page.locator('[name=name]').fill('Produto teste');await page.locator('[name=photo]').setInputFiles(photo);await page.getByRole('button',{name:'Salvar',exact:true}).click();await page.locator('#editor').waitFor({state:'hidden'});assert.equal(await page.evaluate(()=>testState.files.length),1);
  await page.getByRole('button',{name:'Editar',exact:true}).click();await page.locator('[name=removePhoto]').check();await page.getByRole('button',{name:'Salvar',exact:true}).click();await page.locator('#editor').waitFor({state:'hidden'});assert.equal(await page.evaluate(()=>testState.files.length),0);
  // Failed database update cleans the new upload; a lost response must retain the active photo.
  await page.getByRole('button',{name:'Editar',exact:true}).click();await page.locator('[name=photo]').setInputFiles(photo);await page.evaluate(()=>testState.failUpdate=true);await page.getByRole('button',{name:'Salvar',exact:true}).click();await page.locator('#form-status').filter({hasText:'Falha no banco'}).waitFor();assert.equal(await page.evaluate(()=>testState.files.length),0);
  await page.evaluate(()=>{testState.failUpdate=false;testState.loseUpdateResponse=true;});await page.getByRole('button',{name:'Salvar',exact:true}).click();await page.locator('#editor').waitFor({state:'hidden'});assert.equal(await page.evaluate(()=>testState.files.length),1);assert.equal(await page.evaluate(()=>testState.files[0]===testState.rows[0].image_path),true);
  // Partial create + failed upload must never duplicate a product on retry.
  await page.getByRole('button',{name:'+ Novo produto'}).click();await page.locator('[name=name]').fill('Retry');await page.locator('[name=photo]').setInputFiles(photo);await page.evaluate(()=>testState.failUpload=true);await page.getByRole('button',{name:'Salvar',exact:true}).click();await page.locator('#form-status').filter({hasText:'Upload indisponível'}).waitFor();assert.equal(await page.evaluate(()=>testState.rows.length),2);
  await page.evaluate(()=>testState.failUpload=false);await page.getByRole('button',{name:'Salvar',exact:true}).click();await page.locator('#editor').waitFor({state:'hidden'});assert.equal(await page.evaluate(()=>testState.rows.length),2);
  await page.locator('#search').fill('Retry');assert.equal(await page.locator('#rows tr').count(),1);
  await page.evaluate(()=>testState.failDelete=true);page.once('dialog',d=>d.accept());await page.locator('#rows').getByRole('button',{name:'Excluir',exact:true}).click();await page.locator('#status').filter({hasText:'arquivo de foto não pôde'}).waitFor();assert.equal(await page.evaluate(()=>testState.rows.length),1);
  await page.locator('#search').fill('');await page.setViewportSize({width:390,height:844});await page.screenshot({path:require('node:path').join(require('node:os').tmpdir(),'domorelli-admin-mobile.png'),fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
  await page.getByRole('button',{name:'Editar',exact:true}).click();await page.screenshot({path:require('node:path').join(require('node:os').tmpdir(),'domorelli-admin-editor.png'),fullPage:true});await page.getByRole('button',{name:'Cancelar',exact:true}).click();
  await page.setViewportSize({width:1440,height:900});await page.screenshot({path:require('node:path').join(require('node:os').tmpdir(),'domorelli-admin-desktop.png'),fullPage:true});
  await page.getByRole('button',{name:'Sair',exact:true}).click();await page.locator('#login').waitFor({state:'visible'});
  await page.goto(base+'/');await page.locator('#menu-status').filter({hasText:'Cardápio em atualização'}).waitFor();assert.equal(await page.locator('#cardapio').count(),1);
  assert.deepEqual(errors,[]);console.log('PASS: /admin; config error; login/logout; create/edit/delete; images upload/replace/remove; retry; database failure; lost update response; cleanup failure; XSS text; mobile; public empty state. Auth/Storage mocked.');
 } finally { if(browser)await browser.close();server.kill(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
