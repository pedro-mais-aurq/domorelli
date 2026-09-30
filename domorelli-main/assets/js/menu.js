'use strict';
(async function () {
  const config = window.DOMORELLI_CONFIG, api = window.Domorelli;
  const root = document.getElementById('products');
  const message = document.getElementById('menu-status');
  const retry = document.getElementById('menu-retry');
  const nav = document.querySelector('.menu__categories ul');
  const signatures = document.querySelector('.signature__list');
  const section = document.querySelector('.signature');
  let products = [], state = 'loading', pending = false;
  const make = (tag, className, text) => {
    const el = document.createElement(tag); el.className = className;
    if (text != null) el.textContent = text;
    return el;
  };
  const whatsappUrl = text => `https://wa.me/${config.whatsapp}?text=${encodeURIComponent(text)}`;
  // One product list, shared by reference through lookups. Cart persists only IDs and quantities.
  window.DomorelliCatalog = Object.freeze({
    getProduct: id => products.find(product => product.id === id),
    getState: () => state,
    whatsappUrl
  });
  for (const link of document.querySelectorAll('[data-whatsapp]')) {
    link.href = whatsappUrl('Olá, vim pelo site da Domorelli Steakhouse e gostaria de fazer um pedido.');
  }
  for (const node of document.querySelectorAll('[data-phone]')) {
    node.textContent = config.whatsapp.replace(/^55(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
  }
  const schema = document.querySelector('script[type="application/ld+json"]');
  if (schema) {
    const data = JSON.parse(schema.textContent); data.telephone = '+' + config.whatsapp;
    schema.textContent = JSON.stringify(data);
  }
  function photo(product) {
    if (!product.image_path) return null;
    const img = make('img', 'product-image');
    img.src = api.imageUrl(product.image_path); img.alt = product.name;
    img.loading = 'lazy'; img.width = 320; img.height = 240;
    // A missing/deleted photo must not prevent ordering the product.
    img.addEventListener('error', () => { img.hidden = true; }, { once: true });
    return img;
  }
  function action(product) {
    const button = make('button', 'btn product-action ' + (product.price_cents === null ? 'btn--outline' : 'btn--ember'),
      product.price_cents === null ? 'Consultar pelo WhatsApp' : 'Adicionar');
    button.type = 'button'; button.dataset.productId = String(product.id);
    button.dataset.productAction = product.price_cents === null ? 'consult' : 'add';
    button.setAttribute('aria-label', (product.price_cents === null ? 'Consultar preço de ' : 'Adicionar ') + product.name);
    return button;
  }
  function productElement(product, featured = false) {
    const item = make('li', featured ? 'signature__item' : 'menu__item');
    item.dataset.productId = String(product.id);
    const img = photo(product); if (img) item.append(img);
    const body = make('div', 'product-content');
    const head = make('div', featured ? 'product-featured-head' : 'menu__item-head');
    head.append(make('p', featured ? 'signature__name' : 'menu__item-name', product.name));
    head.append(make('span', featured ? 'signature__price' : 'menu__item-price', api.formatPrice(product.price_cents)));
    body.append(head);
    if (product.description) body.append(make('p', featured ? 'signature__desc' : 'menu__item-desc', product.description));
    if (product.featured && !featured) body.append(make('span', 'badge', 'destaque'));
    body.append(action(product)); item.append(body);
    return item;
  }
  function render() {
    const fragment = document.createDocumentFragment();
    const links = document.createDocumentFragment();
    const featured = document.createDocumentFragment();
    const categories = [...new Set([...config.categories, ...products.map(p => p.category)])];
    for (const [index, category] of categories.entries()) {
      const list = products.filter(p => p.category === category).sort((a, b) => a.position - b.position || a.id - b.id);
      if (!list.length) continue;
      const block = make('div', 'menu__category'); block.id = `categoria-${index}`;
      block.append(make('h3', 'menu__category-title', category));
      const ul = make('ul', 'menu__list');
      for (const product of list) {
        ul.append(productElement(product));
        if (product.featured) featured.append(productElement(product, true));
      }
      block.append(ul); fragment.append(block);
      const li = make('li', ''), a = make('a', '', category); a.href = `#${block.id}`;
      li.append(a); links.append(li);
    }
    root.replaceChildren(fragment); nav.replaceChildren(links); signatures.replaceChildren(featured);
    section.hidden = !products.some(p => p.featured);
    message.textContent = products.length ? '' : 'Cardápio em atualização. Consulte a casa pelo WhatsApp.';
  }
  async function load() {
    if (pending) return;
    pending = true; state = 'loading'; products = [];
    root.replaceChildren(); nav.replaceChildren(); signatures.replaceChildren(); section.hidden = true;
    message.textContent = 'Carregando cardápio…'; retry.hidden = true; root.setAttribute('aria-busy', 'true');
    document.dispatchEvent(new CustomEvent('domorelli:catalog'));
    try {
      products = await api.listProducts();
      render(); state = 'ready';
    } catch {
      products = []; root.replaceChildren(); nav.replaceChildren(); signatures.replaceChildren(); section.hidden = true;
      state = 'error'; message.textContent = 'Não foi possível carregar o cardápio. Tente novamente.'; retry.hidden = false;
    } finally {
      pending = false; root.setAttribute('aria-busy', 'false');
      document.dispatchEvent(new CustomEvent('domorelli:catalog'));
    }
  }
  // Registered once; rendering and retries never duplicate listeners.
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-product-action]');
    if (!button || state !== 'ready') return;
    const product = window.DomorelliCatalog.getProduct(Number(button.dataset.productId));
    if (!product) return;
    if (product.price_cents === null) {
      window.open(whatsappUrl(`Olá! Gostaria de consultar o preço de ${product.name} na Domorelli Steakhouse.`), '_blank', 'noopener,noreferrer');
    } else if (window.DomorelliCart) window.DomorelliCart.add(product.id);
  });
  retry.addEventListener('click', load);
  await load();
})();
