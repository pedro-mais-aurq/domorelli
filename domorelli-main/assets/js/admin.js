'use strict';
(async function () {
 const $ = id => document.getElementById(id), api = window.Domorelli;
 const form = $('product-form'), field = name => form.elements.namedItem(name);
 let client, products = [], current = null, busy = false;
 const status = message => { $('status').textContent = message; };
 const option = value => { const el = document.createElement('option'); el.value = value; el.textContent = value; return el; };
 window.DOMORELLI_CONFIG.categories.forEach(c => { $('filter').append(option(c)); field('category').append(option(c)); });
 const errorText = error => error?.message || 'Não foi possível concluir a operação.';
 function render() {
  const term = $('search').value.toLocaleLowerCase('pt-BR'), category = $('filter').value;
  $('rows').replaceChildren();
  const visible = products.filter(p => p.name.toLocaleLowerCase('pt-BR').includes(term) && (!category || p.category === category));
  for (const p of visible) {
   const row = document.createElement('tr');
   for (const value of ['', p.name + (p.featured ? ' ★' : ''), p.category, api.formatPrice(p.price_cents)]) { const td = document.createElement('td'); td.textContent = value; row.append(td); }
   if (p.image_path) { const img = document.createElement('img'); img.src = api.imageUrl(p.image_path); img.alt = p.name; row.firstChild.append(img); }
   else row.firstChild.textContent = '—';
   const actions = document.createElement('td');
   for (const [label, handler] of [['Editar', () => open(p)], ['Excluir', () => remove(p)]]) { const btn = document.createElement('button'); btn.textContent = label; btn.onclick = handler; actions.append(btn); }
   row.append(actions); $('rows').append(row);
  }
  $('empty').hidden = visible.length !== 0;
 }
 async function refresh() { products = await api.listProducts(); render(); }
 function open(product = null) {
  if (busy) return;
  current = product; form.reset(); $('form-status').textContent = '';
  $('editor-title').textContent = product ? 'Editar produto' : 'Novo produto';
  field('name').value = product?.name || ''; field('description').value = product?.description || '';
  const category = product?.category || window.DOMORELLI_CONFIG.categories[0];
  if (![...field('category').options].some(o => o.value === category)) field('category').append(option(category));
  field('category').value = category;
  const price = product?.price_cents;
  field('price').value = price == null ? '' : `${Math.floor(price / 100)},${String(price % 100).padStart(2, '0')}`;
  field('featured').checked = product?.featured || false;
  $('preview').hidden = !product?.image_path;
  if (product?.image_path) $('preview').src = api.imageUrl(product.image_path); else $('preview').removeAttribute('src');
  field('removePhoto').disabled = !product?.image_path;
  $('delete').hidden = !product;
  $('editor').showModal(); field('name').focus();
 }
 function lock(value) {
  busy = value;
  document.querySelectorAll('button').forEach(b => { b.disabled = value; });
 }
 async function cleanImage(path) {
  if (!path) return '';
  try { const { error } = await client.storage.from(window.DOMORELLI_CONFIG.imageBucket).remove([path]); if (error) throw error; return ''; }
  catch (e) { return `O arquivo de foto não pôde ser excluído (${path}): ${errorText(e)}. Remova-a no Storage.`; }
 }
 async function remove(product) {
  if (busy || !confirm(`Excluir “${product.name}”? Esta ação não pode ser desfeita.`)) return;
  lock(true);
  try {
   const { error } = await client.from('products').delete().eq('id',product.id).select('id').single();
   if (error) throw error;
   const warning = await cleanImage(product.image_path);
   $('editor').close(); await refresh(); status(warning ? 'Produto excluído. '+warning : 'Produto excluído.');
  } catch (e) { ($('editor').open ? $('form-status') : $('status')).textContent = errorText(e); }
  finally { lock(false); }
 }
 form.onsubmit = async event => {
  event.preventDefault(); if (busy) return;
  let uploadedPath = null, committed = false, oldPath = null;
  lock(true); $('form-status').textContent = 'Salvando…';
  try {
   const payload = { name:field('name').value.trim(), description:field('description').value.trim() || null, category:field('category').value, price_cents:api.parsePrice(field('price').value), featured:field('featured').checked };
   if (!payload.name) throw new Error('Informe o nome.');
   const file = field('photo').files[0];
   const extensions = { 'image/jpeg':'jpg','image/png':'png','image/webp':'webp' };
   if (file && (!extensions[file.type] || file.size > 5242880 || !file.size)) throw new Error('Escolha JPEG, PNG ou WebP com até 5 MB.');
   if (file && field('removePhoto').checked) throw new Error('Escolha entre enviar uma foto ou remover a atual.');
   if (!current) {
    const {data,error} = await client.from('products').insert({...payload,position:products.reduce((max,p)=>Math.max(max,p.position),-1)+1}).select('*').single();
    if (error) throw error;
    current = data; // Retry after upload failure edits this same row, never duplicates it.
    $('delete').hidden = false;
   }
   oldPath = current.image_path;
   if (file) {
    // Unique revision permits rollback and prevents stale CDN images; only one active image per row.
    uploadedPath = `products/${current.id}/${crypto.randomUUID()}.${extensions[file.type]}`;
    const {error} = await client.storage.from(window.DOMORELLI_CONFIG.imageBucket).upload(uploadedPath,file,{contentType:file.type,upsert:false});
    if (error) throw error;
    payload.image_path = uploadedPath;
   } else if (field('removePhoto').checked) payload.image_path = null;
   const {data,error} = await client.from('products').update(payload).eq('id',current.id).eq('updated_at',current.updated_at).select('*').single();
   if (error) throw new Error(`Não foi possível salvar. O produto pode ter sido alterado em outra sessão. ${errorText(error)}`);
   committed = true; current = data;
   const warning = oldPath && oldPath !== data.image_path ? await cleanImage(oldPath) : '';
   $('editor').close(); await refresh(); status(warning ? 'Produto salvo. '+warning : 'Produto salvo.');
  } catch(e) {
   let warning = '';
   if (uploadedPath && !committed) {
    // A failed response does not prove that the database rejected the update.
    // Check the current reference before removing a potentially active image.
    try {
     const {data:latest,error:readError} = await client.from('products').select('*').eq('id',current.id).maybeSingle();
     if (readError) throw readError;
     if (latest?.image_path === uploadedPath) {
      committed = true; current = latest;
      warning = oldPath && oldPath !== uploadedPath ? await cleanImage(oldPath) : '';
      $('editor').close();
      await refresh(); status(warning || 'Produto salvo. A confirmação foi recuperada após falha de conexão.');
      return;
     }
     warning = await cleanImage(uploadedPath);
    } catch (readError) {
     warning = `Não foi possível confirmar o estado da foto. O arquivo ${uploadedPath} foi preservado para não apagar uma imagem em uso. Recarregue o produto antes de tentar novamente.`;
    }
   }
   ($('editor').open ? $('form-status') : $('status')).textContent = errorText(e) + (current ? '\nO registro existente foi mantido; você pode tentar novamente ou cancelar.' : '') + (warning ? '\n'+warning : '');
  } finally { lock(false); }
 };
 $('cancel').onclick = async () => { if (!busy) { $('editor').close(); try { await refresh(); } catch(e) { status(errorText(e)); } } };
 $('editor').addEventListener('cancel', event => { if (busy) event.preventDefault(); else setTimeout(() => refresh().catch(e=>status(errorText(e))),0); });
 $('delete').onclick = () => remove(current);
 $('new').onclick = () => open(); $('search').oninput = render; $('filter').onchange = render;
 async function sessionView(session) {
  const signedIn = !!session && !session.user.is_anonymous;
  $('login').hidden = signedIn; $('panel').hidden = !signedIn; $('logout').hidden = !signedIn;
  if (!signedIn) { $('editor').close(); products=[]; $('rows').replaceChildren(); }
  else { try { await refresh(); } catch(e) { status(errorText(e)); } }
 }
 $('login-form').onsubmit = async event => {
  event.preventDefault(); lock(true); status('Entrando…');
  try { const f = event.target.elements; const {data,error} = await client.auth.signInWithPassword({email:f.email.value.trim(),password:f.password.value}); if(error) throw error; f.password.value=''; status(''); await sessionView(data.session); }
  catch(e) { status(errorText(e)); } finally { lock(false); }
 };
 $('logout').onclick = async () => { lock(true); try { const {error}=await client.auth.signOut(); if(error) throw error; status('Sessão encerrada.'); await sessionView(null); } catch(e) { status(errorText(e)); } finally {lock(false);} };
 try {
  client = api.getClient();
  const {data,error} = await client.auth.getSession(); if(error) throw error;
  await sessionView(data.session);
  client.auth.onAuthStateChange((event,session)=> { if(event==='SIGNED_OUT' || event==='TOKEN_REFRESHED') setTimeout(()=>sessionView(session),0); });
 } catch(e) { status(errorText(e)); $('login-form').querySelector('button').disabled=true; }
})();
