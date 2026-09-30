# Domorelli — entrega da P2

A P2 implementa o catálogo público, o carrinho local e a montagem de pedidos por WhatsApp. O banco continua sendo a fonte única dos produtos. Não foram alterados schema, migrations, seed, Auth, RLS, Storage, importador, painel administrativo, configuração ou `data.js`.

## Arquivos e fronteira com a P1

Criados:
- `assets/js/cart.js`: estado e interface do carrinho, persistência e finalização.
- `tests/p2-browser.cjs`: cenários de aceitação da P2 usando Chromium, SDK Supabase real e respostas HTTP de teste.
- `RELATORIO-P2.md`: este relatório.

Modificados:
- `assets/js/menu.js`: evolução do renderer público já existente.
- `index.html`: botão de nova tentativa, botão do carrinho, dialog e carregamento de cart.js.
- `assets/css/styles.css`: somente bloco de estilos específicos da P2 acrescentado ao final.
- `package.json`: comando `test:p2`; nenhuma dependência nova.
- `tests/public.mjs`: disponibiliza `CustomEvent` no DOM de teste para a comunicação entre catálogo e carrinho.
- `README.md`: indicação da P2 e ligação para este relatório; documentação histórica da P1 preservada.

**Renderer único:** `menu.js` foi mantido e evoluído. Não existe `catalog.js` concorrente. `cart.js` não consulta nem renderiza o catálogo; apenas mostra os itens do pedido usando os produtos atuais fornecidos por `DomorelliCatalog.getProduct(id)`.

## Catálogo, categorias, destaques e fotos

`menu.js` chama `window.Domorelli.listProducts()` uma única vez por carregamento bem-sucedido, compartilhando uma lista `products` em memória entre catálogo, destaques e carrinho. A paginação interna continua pertencendo a `data.js`. Nova tentativa após erro executa uma nova carga, sem acumular elementos ou listeners. O carrinho não faz consulta independente.

A ordem das categorias segue `DOMORELLI_CONFIG.categories`; categorias vazias não aparecem. Caso um produto contenha categoria fora da configuração, ela aparece ao final, sem sumir com o produto. Dentro de cada categoria: `position ASC`, depois `id ASC`.

Produtos com `featured=true` são apresentados na seção existente de destaques, usando o mesmo registro, inclusive nome, descrição, foto e preço. Quando nenhum produto é destaque, a seção fica oculta.

Fotos são resolvidas exclusivamente por `window.Domorelli.imageUrl(image_path)`. Usam `loading=lazy`, `alt`, dimensões, proporção 4:3 e `object-fit:cover`. Se não houver foto, a área não é criada. Se a foto falhar ao carregar, ela é ocultada sem bloquear o produto. Não existem imagens genéricas externas.

O catálogo mantém a composição em lista. Foram adicionados foto e botão ao produto, preservando hero, navbar, animação, tipografia, cores, demais seções e rodapé. O novo botão flutuante do carrinho fica acima do botão de contato do WhatsApp.

## Preços e carrinho

`price_cents=null` continua significando **Sob consulta**. Esses produtos recebem o botão “Consultar pelo WhatsApp” e nunca entram no pedido monetário. Preço zero explícito continua sendo um preço válido, distinto de NULL.

Chave única do carrinho: `domorelli_cart_v1`.

Formato persistido:

```json
[{"productId":14,"quantity":2},{"productId":31,"quantity":1}]
```

Nenhum nome, preço, descrição, imagem ou categoria é persistido como fonte de verdade. A quantidade total de unidades aparece no botão “Carrinho (N)”. É possível adicionar, incrementar, decrementar, remover e limpar. Ao decrementar uma unidade, o item é removido. A ação “Limpar carrinho” também limpa as observações.

Quantidades são inteiros positivos. Entradas inválidas (incluindo IDs inválidos, quantidades nulas/negativas/fracionadas ou além do limite) são descartadas. Há limite de 999 unidades por produto; entradas duplicadas do mesmo ID são unificadas dentro desse limite. Esse limite protege contra conteúdo manipulado e operações acidentais, sem criar regra de estoque. O cálculo também recusa resultados fora do intervalo de inteiros seguros do JavaScript.

JSON inválido ou formato incompatível recupera para carrinho vazio. Se localStorage estiver bloqueado, o pedido continua funcionando em memória e a interface informa que não poderá conservá-lo após sair da página.

As observações são opcionais, limitadas a 1.000 caracteres e mantidas **somente na página atual**; não são enviadas ao banco nem persistidas. Essa escolha é explicitada abaixo do campo. O contrato permite, mas não exige, persistência de observações.

O total é calculado apenas com centavos inteiros:

```js
sum(product.price_cents * item.quantity)
```

A apresentação usa o `formatPrice` existente, sem formatador paralelo.

Ao carregar o catálogo com sucesso:
- ID inexistente: removido do carrinho.
- Produto que passou a NULL: removido do carrinho monetário.
- Preço alterado: o cálculo passa a usar o preço atual.
- Dados extras adulterados no localStorage: ignorados e eliminados ao salvar.

Em falha de rede, os IDs salvos são preservados. O site não apaga o pedido apenas porque não conseguiu consultar os produtos. Nesse estado, não mostra valores antigos e bloqueia a finalização até carregar o catálogo.

A atualização de produtos/preços ocorre no carregamento da página ou na nova tentativa após erro. Não foi adicionado Realtime, polling ou consulta extra no checkout. Se o administrador alterar o preço enquanto a página já está aberta, o usuário precisa recarregá-la para obter a alteração, conforme os cenários de aceite do prompt.

## WhatsApp

Telefone utilizado: **5538991276369**, lido exclusivamente de `DOMORELLI_CONFIG.whatsapp`. O número original foi preservado. A montagem de URL fica em `DomorelliCatalog.whatsappUrl(text)`, usando `encodeURIComponent(text)`.

Mensagem de pedido:

```text
Olá! Gostaria de fazer este pedido na Domorelli Steakhouse:

2x Novo Hambúrguer
R$ 29,00 cada — R$ 58,00

Total: R$ 58,00

Observações:
Sem cebola.
```

Para uma unidade, mostra apenas o valor da linha. Para mais unidades, mostra preço unitário e subtotal. Observações só aparecem quando preenchidas. Não há IDs, JSON ou campos técnicos na mensagem.

Consulta de preço é uma mensagem independente:

```text
Olá! Gostaria de consultar o preço de Whisky na Domorelli Steakhouse.
```

Carrinho vazio não abre WhatsApp e apresenta “Adicione pelo menos um item ao pedido.”. A abertura ocorre diretamente no clique, em nova aba com `noopener,noreferrer`. O cliente ainda deve enviar a mensagem no WhatsApp. O carrinho **não é apagado automaticamente**, pois o site não pode confirmar o envio.

Nenhuma mensagem real foi enviada nos testes: a abertura de janela foi interceptada para validar a URL e seu texto.

## Acessibilidade e estados

O pedido usa `<dialog>` modal nativo, título acessível, foco no botão de fechar, ciclo de Tab/Shift+Tab e retorno ao botão de abertura. Escape fecha o painel. Quantidades têm botões com nomes acessíveis; campos têm labels; mensagens usam regiões de status. Os botões não dependem de hover.

O site exibe carregamento, catálogo vazio e erro sem vazar mensagens internas do Supabase. “Tentar novamente” reutiliza a carga existente. Textos de produto são inseridos por `textContent`; não existe interpolação de conteúdo do banco em `innerHTML`.

## Testes e limitações

Comandos:

```sh
npm ci
npm test
npx playwright install chromium
npm run test:browser
npm run test:p2
```

Para um Chromium disponível fora da instalação do Playwright, use `CHROMIUM_EXECUTABLE=/caminho/chromium` antes do comando de teste, ou a variável equivalente no seu sistema.

- `npm test`: centavos, SQL/RLS em PostgreSQL local (PGlite), 210 registros de seed, bloqueio de reimportação, renderização pública, XSS como texto e rotas HTTP.
- `test:browser`: regressão do painel da P1 — login/logout, CRUD, upload, troca/remoção de foto, destaque, retry de upload, falha de banco, perda de resposta e falha de limpeza. Cliente Auth/Storage simulado.
- `test:p2`: SDK Supabase efetivamente carregado pelo site, com HTTP interceptado para cenários reproduzíveis: categorias/ordem, fotos e ausência de foto/descrição, NULL, featured/ausência de featured, lista vazia, XSS, operações do carrinho, persistência/reload, remoção de ID indisponível, atualização de preço, produto que virou NULL, JSON inválido, localStorage bloqueado e tentativa após erro.
- Mensagens verificadas com acentos, ç, &, /, +, aspas, quebras de linha e emoji; uma/múltiplas unidades, vários produtos, com/sem observações, consulta e carrinho vazio.
- Cenário principal: 2 × R$29 = R$58; após nova carga, 2 × R$31 = R$62, inclusive na mensagem.
- Verificação de teclado, modal e larguras de 320, 375, 390 e 430 px; inspeção visual também em desktop.

Os testes usam dados fictícios **somente em arquivos de teste e interceptações HTTP**. Eles não são carregados em produção, não são fallback e não modificam o config.js entregue.

**Homologação remota pendente:** `supabaseUrl` e `supabasePublishableKey` continuam vazios no arquivo original de configuração. Preencha os dados reais conforme o README da P1. Nenhum projeto, chave ou credencial real foi inventado; nenhum banco remoto foi modificado. O código local e os testes não substituem a homologação com o projeto Supabase definitivo e o aplicativo WhatsApp do cliente.

## Problemas encontrados e decisões

- A navegação com Tab no fim do dialog podia sair do ciclo desejado em Chromium. Foi adicionado ciclo explícito de foco dentro do carrinho, sem alterar a P1.
- O teste visual inicialmente usava um seletor que correspondia tanto ao item quanto ao botão; o seletor do teste foi corrigido, sem alteração de comportamento da aplicação.
- Produtos antigos não são usados em caso de falha de carregamento. O pedido mantém apenas as referências até uma leitura válida.
- Nenhuma modificação na camada congelada foi necessária. Comparação byte a byte com o ZIP recebido confirmou a preservação de `admin/`, `admin.js`, `admin.css`, `config.js`, `data.js`, migrations, seed, importador, servidor, SDK e lockfile.

Não foram adicionados tabelas, pedidos no banco, usuários clientes, entrega, pagamento, estoque, busca pública, frameworks, serviços, dependências ou APIs de WhatsApp.
