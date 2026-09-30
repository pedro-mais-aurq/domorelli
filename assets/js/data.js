(function () {
  const config = window.DOMORELLI_CONFIG;
  let client;
  function getClient() {
    if (!config.supabaseUrl || !config.supabasePublishableKey) throw new Error('Configure o Supabase em assets/js/config.js.');
    if (!config.supabasePublishableKey.startsWith('sb_publishable_')) throw new Error('Use uma chave pública sb_publishable_.');
    if (!window.supabase) throw new Error('Não foi possível carregar o cliente Supabase.');
    return client ||= window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey);
  }
  function parsePrice(value) {
    const text = value.trim();
    if (!text) return null;
    if (!/^\d+(?:[.,]\d{1,2})?$/.test(text)) throw new Error('Preço inválido. Use 25,90, sem separador de milhar.');
    const [whole, decimal = ''] = text.split(/[.,]/);
    const result = Number(whole) * 100 + Number(decimal.padEnd(2, '0'));
    if (!Number.isSafeInteger(result) || result > 2147483647) throw new Error('Preço fora do limite permitido.');
    return result;
  }
  const formatPrice = value => value === null ? 'Sob consulta' : new Intl.NumberFormat('pt-BR', { style:'currency', currency:'BRL' }).format(value / 100);
  const imageUrl = path => path ? getClient().storage.from(config.imageBucket).getPublicUrl(path).data.publicUrl : '';
  async function listProducts() {
    const rows = [];
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await getClient().from('products').select('*').order('category').order('position').order('id').range(offset, offset + 999);
      if (error) throw error;
      rows.push(...data);
      if (data.length < 1000) return rows;
    }
  }
  window.Domorelli = { getClient, parsePrice, formatPrice, imageUrl, listProducts };
})();
