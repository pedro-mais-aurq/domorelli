import { readFileSync, writeFileSync } from 'node:fs';
import { parseHTML } from 'linkedom';
// Run against the ORIGINAL HTML from the supplied archive, before its replacement.
const [input, output = 'supabase/menu-seed.sql'] = process.argv.slice(2);
if (!input) throw new Error('Uso: node scripts/import-current-menu.mjs /caminho/index-original.html [saida.sql]');
const { document } = parseHTML(readFileSync(input, 'utf8'));
const clean = node => node?.textContent.replace(/\s+/g, ' ').trim() || null;
const cents = value => { if (!/^\d+[.,]\d{2}$/.test(value)) throw new Error(`Preço inválido: ${value}`); return Number(value.replace(/[.,]/, '')); };
const products = [], categories = [], notes = [];
const items = [...document.querySelectorAll('.menu__item')];
if (!items.length) throw new Error('HTML sem produtos estáticos. Use o index.html ORIGINAL, não o site já migrado.');
for (const block of document.querySelectorAll('.menu__category')) {
  const parent = clean(block.querySelector('h3'));
  let category = parent;
  categories.push(parent);
  for (const node of block.querySelectorAll('h4, .menu__item')) {
    if (node.tagName === 'H4') { category = `${parent} / ${clean(node)}`; categories.push(category); continue; }
    const name = clean(node.querySelector('.menu__item-name'));
    const description = clean(node.querySelector('.menu__item-desc'));
    const price = node.querySelector('.menu__item-price');
    const base = { name, description, category, featured: !!node.querySelector('.badge'), position: products.length };
    if (!name) throw new Error('Produto sem nome');
    if (price?.tagName === 'DATA') {
      const value = cents(price.getAttribute('value'));
      const shown = clean(price).replace(/^R\$\s*/, '');
      if (value !== cents(shown)) throw new Error(`Preço divergente: ${name}`);
      products.push({ ...base, price_cents: value });
    } else if (clean(price) === 'Sob consulta') {
      products.push({ ...base, price_cents: null });
      notes.push(`${name}: sob consulta (NULL, nunca zero).`);
    } else {
      const variants = description?.split('|').map(s => s.trim());
      if (!variants?.every(s => /^.+?\s*—\s*R\$\s*\d+,\d{2}$/.test(s))) throw new Error(`Formato não reconhecido: ${name}`);
      for (const variant of variants) {
        const [, label, value] = variant.match(/^(.+?)\s*—\s*R\$\s*(\d+,\d{2})$/);
        products.push({ ...base, name: `${name} — ${label}`, description: null, price_cents: cents(value), position: products.length });
      }
      notes.push(`${name}: preços por tamanho desdobrados, sem duplicar preços na descrição.`);
    }
  }
}
// Explicit, auditable equivalences observed in this supplied HTML, never fuzzy matching.
const aliases = { 'Churrasco de Picanha 400g': 'Picanha 400g', 'Churrasco de Alcatra 400g': 'Alcatra 400g' };
for (const item of document.querySelectorAll('.signature__item')) {
  const name = clean(item.querySelector('.signature__name'));
  const matches = products.filter(p => p.name === (aliases[name] || name) && p.category === 'Refeições — Serve de 2 a 3 pessoas');
  if (matches.length !== 1) throw new Error(`Destaque ambíguo: ${name}`);
  const p = matches[0];
  if (p.price_cents !== cents(item.querySelector('data').getAttribute('value'))) throw new Error(`Destaque com preço divergente: ${name}`);
  p.featured = true;
  const desc = item.querySelector('.signature__desc')?.cloneNode(true);
  desc?.querySelectorAll('data').forEach(n => n.remove());
  if (!p.description) p.description = clean(desc);
  notes.push(`Destaque "${name}" → "${p.name}". Texto original: ${clean(desc)}. Descrição do cardápio tem precedência.`);
}
const quote = value => value === null ? 'NULL' : typeof value === 'string' ? `'${value.replaceAll("'", "''")}'` : String(value);
const columns = ['name','description','category','price_cents','featured','position'];
const sql = `-- Gerado do HTML original; execução ÚNICA em tabela vazia. Nunca usar como fallback do frontend.\nBEGIN;\nLOCK TABLE public.products IN EXCLUSIVE MODE;\nDO $$ BEGIN IF EXISTS (SELECT 1 FROM public.products) THEN RAISE EXCEPTION 'Importação recusada: products não está vazia'; END IF; END $$;\nINSERT INTO public.products (${columns.join(',')}) VALUES\n${products.map(p => '(' + columns.map(k => quote(p[k])).join(',') + ')').join(',\n')};\nCOMMIT;\n`;
writeFileSync(output, sql);
writeFileSync(output + '.report.json', JSON.stringify({htmlItems:items.length, signatures:4, records:products.length, categories:[...new Set(categories)], notes}, null, 2));
console.log(`${items.length} itens HTML → ${products.length} registros; 4 destaques reutilizados.`);
