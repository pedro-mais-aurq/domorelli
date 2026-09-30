'use strict';
(function () {
  const api = window.Domorelli, catalog = window.DomorelliCatalog;
  const KEY = 'domorelli_cart_v1', MAX_QUANTITY = 999;
  const $ = id => document.getElementById(id);
  const dialog = $('cart-dialog'), list = $('cart-items'), launcher = $('cart-open');
  let items = [], storageUnavailable = false;
  function normalize(value) {
    if (!Array.isArray(value)) return [];
    const merged = new Map();
    for (const item of value) {
      if (!item || !Number.isSafeInteger(item.productId) || item.productId < 1 ||
          !Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > MAX_QUANTITY) continue;
      merged.set(item.productId, Math.min(MAX_QUANTITY, (merged.get(item.productId) || 0) + item.quantity));
    }
    return [...merged].map(([productId, quantity]) => ({ productId, quantity }));
  }
  try { items = normalize(JSON.parse(localStorage.getItem(KEY) || '[]')); }
  catch { items = []; }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(items)); }
    catch { storageUnavailable = true; }
    $('cart-storage').hidden = !storageUnavailable;
  }
  const priced = product => product && Number.isSafeInteger(product.price_cents) && product.price_cents >= 0;
  function reconcile() {
    if (catalog.getState() !== 'ready') return;
    const before = items.length;
    items = items.filter(item => priced(catalog.getProduct(item.productId)));
    // Integer arithmetic stays exact, even if localStorage was edited manually.
    let total = 0;
    items = items.filter(item => {
      const next = total + catalog.getProduct(item.productId).price_cents * item.quantity;
      if (!Number.isSafeInteger(next)) return false;
      total = next; return true;
    });
    if (items.length !== before) announce('Itens indisponíveis ou sem preço definido foram removidos do pedido.');
    save();
  }
  function announce(text) {
    $('cart-status').textContent = text;
    $('cart-feedback').textContent = text;
  }
  const getQuantity = () => items.reduce((sum, item) => sum + item.quantity, 0);
  const getTotal = () => items.reduce((sum, item) => sum + catalog.getProduct(item.productId).price_cents * item.quantity, 0);
  function button(text, label, action, productId) {
    const el = document.createElement('button'); el.type = 'button'; el.textContent = text;
    el.className = 'cart-control'; el.setAttribute('aria-label', label);
    el.dataset.cartAction = action; el.dataset.productId = String(productId); return el;
  }
  function render() {
    const ready = catalog.getState() === 'ready';
    const active = document.activeElement;
    const focus = list.contains(active) ? { id: active.dataset.productId, action: active.dataset.cartAction } : null;
    list.replaceChildren();
    $('cart-count').textContent = String(getQuantity());
    launcher.setAttribute('aria-label', `Carrinho (${getQuantity()})`);
    $('cart-empty').hidden = ready && items.length > 0;
    $('cart-empty').textContent = !ready ? (catalog.getState() === 'error' ?
      'O pedido está guardado. Tente carregar o cardápio novamente para revisar os valores.' :
      'Aguarde o carregamento do cardápio para revisar seu pedido.') : 'Seu carrinho está vazio.';
    $('cart-total').textContent = ready ? api.formatPrice(getTotal()) : '—';
    $('cart-checkout').disabled = !ready;
    $('cart-clear').disabled = items.length === 0;
    $('cart-storage').hidden = !storageUnavailable;
    if (!ready) return;
    for (const item of items) {
      const product = catalog.getProduct(item.productId);
      const li = document.createElement('li'); li.className = 'cart-item';
      const name = document.createElement('p'); name.className = 'cart-item__name'; name.textContent = product.name;
      const price = document.createElement('p'); price.className = 'cart-item__price';
      price.textContent = `${api.formatPrice(product.price_cents)} cada · ${api.formatPrice(product.price_cents * item.quantity)}`;
      const controls = document.createElement('div'); controls.className = 'cart-item__controls';
      const quantity = document.createElement('span'); quantity.textContent = String(item.quantity);
      quantity.setAttribute('aria-label', `Quantidade: ${item.quantity}`);
      controls.append(button('−', 'Diminuir quantidade de ' + product.name, 'decrement', product.id), quantity,
        button('+', 'Aumentar quantidade de ' + product.name, 'increment', product.id),
        button('Remover', 'Remover ' + product.name, 'remove', product.id));
      li.append(name, price, controls); list.append(li);
    }
    if (focus) {
      const target = [...list.querySelectorAll('button')].find(b => b.dataset.productId === focus.id && b.dataset.cartAction === focus.action);
      (target || list.querySelector('button') || $('cart-close')).focus();
    }
  }
  function change(productId, delta) {
    if (catalog.getState() !== 'ready' || !priced(catalog.getProduct(productId))) return;
    const item = items.find(row => row.productId === productId);
    const quantity = (item?.quantity || 0) + delta;
    if (quantity > MAX_QUANTITY) { announce(`O limite é ${MAX_QUANTITY} unidades por produto.`); return; }
    const nextTotal = getTotal() + catalog.getProduct(productId).price_cents * delta;
    if (!Number.isSafeInteger(nextTotal)) { announce('Quantidade acima do limite permitido.'); return; }
    if (quantity <= 0) items = items.filter(row => row.productId !== productId);
    else if (item) item.quantity = quantity;
    else items.push({ productId, quantity });
    save(); render(); announce(delta > 0 ? 'Item adicionado ao pedido.' : 'Quantidade atualizada.');
  }
  function remove(productId) {
    items = items.filter(row => row.productId !== productId); save(); render(); announce('Item removido do pedido.');
  }
  function clear() {
    items = []; $('cart-notes').value = ''; save(); render(); announce('Carrinho limpo.');
  }
  function checkout() {
    if (catalog.getState() !== 'ready') { announce('Carregue o cardápio antes de finalizar.'); return; }
    reconcile(); render();
    if (!items.length) { announce('Adicione pelo menos um item ao pedido.'); return; }
    const lines = ['Olá! Gostaria de fazer este pedido na Domorelli Steakhouse:', ''];
    for (const item of items) {
      const product = catalog.getProduct(item.productId);
      lines.push(`${item.quantity}x ${product.name}`, item.quantity === 1 ? api.formatPrice(product.price_cents) :
        `${api.formatPrice(product.price_cents)} cada — ${api.formatPrice(product.price_cents * item.quantity)}`, '');
    }
    lines.push(`Total: ${api.formatPrice(getTotal())}`);
    const notes = $('cart-notes').value.trim().slice(0, 1000);
    if (notes) lines.push('', 'Observações:', notes);
    window.open(catalog.whatsappUrl(lines.join('\n')), '_blank', 'noopener,noreferrer');
    announce('Confira e envie a mensagem no WhatsApp. Seu carrinho foi mantido.');
  }
  launcher.addEventListener('click', () => { render(); dialog.showModal(); launcher.setAttribute('aria-expanded', 'true'); $('cart-close').focus(); });
  $('cart-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const controls = [...dialog.querySelectorAll('button:not(:disabled), textarea')];
    const first = controls[0], last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  dialog.addEventListener('close', () => { launcher.setAttribute('aria-expanded', 'false'); launcher.focus(); });
  list.addEventListener('click', event => {
    const control = event.target.closest('[data-cart-action]'); if (!control) return;
    const id = Number(control.dataset.productId);
    if (control.dataset.cartAction === 'remove') remove(id);
    else change(id, control.dataset.cartAction === 'increment' ? 1 : -1);
  });
  $('cart-clear').addEventListener('click', clear);
  $('cart-checkout').addEventListener('click', checkout);
  document.addEventListener('domorelli:catalog', () => { reconcile(); render(); });
  window.DomorelliCart = Object.freeze({ add: id => change(id, 1) });
  reconcile(); render(); launcher.hidden = false;
})();
