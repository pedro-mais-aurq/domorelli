# Domorelli — P1 + P2

Esta entrega inclui catálogo público, fotos, destaques, carrinho local e pedido por WhatsApp. Consulte **[RELATORIO-P2.md](RELATORIO-P2.md)** para o contrato, arquivos, testes e limitações da P2.

A configuração do Supabase permanece pendente. Abaixo está a documentação original da P1, preservada como referência de instalação; as menções históricas a ausência de carrinho foram superadas pela P2.

---

# Domorelli — Parte 1: cardápio administrável

HTML, CSS e JavaScript vanilla. Supabase fornece PostgreSQL, Auth e Storage. `server.js` serve somente arquivos estáticos. Não há backend de CRUD, carrinho ou gestão de pedidos.

## Configurar e executar

1. Use um projeto Supabase **dedicado à Domorelli**. Todos os usuários não anônimos desse projeto terão permissão administrativa; não compartilhe esse projeto com contas de clientes ou outros sites.
2. Em Authentication, desative **Allow new users to sign up** e **Anonymous sign-ins**. Mantenha login por e-mail/senha. Faça isso ANTES de publicar as políticas. Não há cadastro no site, mas esconder cadastro não desativa a API de signup.
3. No SQL Editor, execute `supabase/migrations/20260929174557_products.sql` uma única vez.
4. Execute `supabase/menu-seed.sql` no SQL Editor. A importação exige tabela vazia, usa transação e bloqueio, e recusa uma segunda execução para não sobrescrever alterações administrativas. Se houver dados, não apague a tabela para contornar a proteção.
5. Em Authentication → Users, crie manualmente o administrador com e-mail e senha forte e confirme o e-mail. Não grave credenciais no código.
6. Preencha `supabaseUrl` e `supabasePublishableKey` em `assets/js/config.js`. Use a chave `sb_publishable_...` do projeto. Nunca use `service_role` ou `sb_secret_...`.
7. Execute `npm ci` e `npm run dev`. Abra `http://localhost:8080` e `http://localhost:8080/admin`.
8. Para hospedagem estática, publique `index.html`, `admin/`, `assets/` e `robots.txt`. O host deve resolver `/admin/` para `admin/index.html` e redirecionar `/admin` para `/admin/`. Não publique `node_modules`, scripts, testes ou arquivos SQL. Use HTTPS.

O site agora consulta o banco: sem configuração ele abre, mas exibe indisponibilidade do cardápio. Não existe fallback com preços antigos. O SDK 2.117.2 foi incluído localmente em `assets/js/vendor/`, dispensando CDN no navegador; sua licença está junto. `npm ci` é necessário apenas para ferramentas/testes; `node server.js` já serve a entrega.

## Resultado da importação

- 200 itens `.menu__item` no HTML original; mais 4 apresentações de destaques.
- 210 registros gerados no SQL e carregados em PostgreSQL local de teste (PGlite).
- **0 registros migrados em banco remoto nesta execução.** Não foi fornecido/identificado um projeto Supabase da Domorelli; os projetos conectados pertencem a outros trabalhos.
- 7 itens com tamanhos foram desdobrados em 17 registros: quatro carnes (200 g/400 g) e três acompanhamentos (P/M/G). Acréscimo líquido de 10 registros.
- 4 itens “Sob consulta” mantidos sem inventar preço: Filé de frango, Industrializados — 1 L, Outros sabores e Whisky.
- 4 destaques vinculados aos registros de Refeições, sem cópias adicionais.
- Nenhuma foto de produto existia no cardápio. `image_path` começa nulo.
- Os centavos são extraídos de strings, com conferência entre `data[value]` e preço visível. Não há preço persistido como float.

Para reproduzir a extração, extraia o `index.html` do ZIP **original** para um caminho fora do site e execute:

```sh
npm ci
node scripts/import-current-menu.mjs /caminho/index-original.html /caminho/menu-seed.sql
```

O `index.html` final não contém produtos estáticos e não pode ser usado como entrada. O SQL gerado é um artefato de migração, não uma segunda fonte de dados em runtime. O relatório detalhado está em `supabase/menu-seed.sql.report.json`.

## Categorias preservadas

Entradas; Hambúrgueres Artesanais; Beirutes; Pratos Individuais; Refeições — Serve de 2 a 3 pessoas; Carnes; Acompanhamentos; Sucos Naturais; Caipirinhas; Drinks; Vinhos; Chopp e Cervejas; Bebidas alcoólicas e whisky; Lanches Tradicionais; Refrigerantes.

Subdivisões existentes preservadas no valor de categoria como `pai / subdivisão`: Hambúrgueres Artesanais / Acréscimos; Chopp e Cervejas / Chopp; Chopp e Cervejas / 600ml; Chopp e Cervejas / Long Neck; Chopp e Cervejas / Long Neck Zero. Isso evita perder volume/tipo de cervejas com nomes iguais sem criar tabela ou campo extra. A configuração mantém 20 títulos; o pai Chopp e Cervejas não contém produtos diretos e não gera seção vazia. Os vínculos antigos para categorias inexistentes foram substituídos pelos títulos reais.

## Contrato com a Parte 2

`products`: id (number), name (string), description (string|null), category (string), **price_cents (number|null)**, image_path (string|null), featured (boolean), position (number). Também contém created_at/updated_at. A única diferença necessária do contrato proposto é o preço nulo: **NULL significa “Sob consulta”, não zero/grátis**. A Parte 2 deve tratar esse caso explicitamente antes de somar pedidos.

`window.Domorelli`: getClient(), listProducts(), parsePrice(text), formatPrice(cents), imageUrl(path). `listProducts()` pagina de 1.000 em 1.000 e ordena category/position/id. `DOMORELLI_CONFIG` centraliza projeto, chave, categorias, telefone e bucket. A ordem visual de categorias segue a configuração; posição preserva a ordem de origem dentro da categoria. Novos produtos entram ao final. A tela não oferece campo de ordenação, conforme escopo mínimo.

`menu.js` é a ponte mínima pública para que alterações administrativas apareçam sem edição de HTML. Preserva classes CSS e `main.js` (animações, header e navegação). A Parte 2 pode estender esse arquivo para carrinho/WhatsApp; nada disso foi implementado nesta parte.

## Fotos e consistência

Bucket público `product-images`, limite 5 MB por arquivo, MIME JPEG/PNG/WebP. Caminho: `products/<productId>/<uuid>.<jpg|png|webp>`.

O UUID por revisão é uma adaptação deliberada de `image.ext`: evita cache antigo e permite enviar a nova foto antes de trocar a referência no banco. Há no máximo uma referência ativa por produto. Após salvar, a imagem anterior é removida; se houver falha ao salvar, o painel consulta novamente o registro antes da limpeza. Se a referência já aponta para a nova imagem, recupera a confirmação e preserva o arquivo. Se não conseguir confirmar o estado do banco, mantém o arquivo e avisa o administrador, evitando apagar uma foto ativa. Remover uma foto limpa primeiro a referência; excluir um produto remove primeiro o registro e depois tenta remover o arquivo. Falhas de limpeza são exibidas com o caminho, sem desfazer ou corromper os dados salvos.

Banco e Storage não compartilham transação. Interrupção do navegador/rede entre operações pode deixar arquivo órfão; o painel tenta compensar e avisa falhas conhecidas, sem prometer atomicidade. Um produto novo é criado antes do upload para obter ID; se o upload falhar, fica salvo sem foto e a nova tentativa reutiliza o registro. Atualizações usam `updated_at` para detectar edição concorrente; feche e reabra o formulário para recarregar após conflito.

## RLS e segurança

- products: anon/authenticated podem SELECT; só authenticated com auth.uid válido e `is_anonymous != true` podem INSERT/UPDATE/DELETE.
- Storage: bucket público para leitura; INSERT/UPDATE/DELETE limitados ao bucket e usuários autenticados não anônimos. Upload exige caminho válido e produto existente; não se permite inserir em outro bucket. Exclusão permite limpar arquivo de produto já removido.
- Todos os usuários de Auth são administradores por contrato, sem perfis ou RBAC. A restrição operacional de cadastro fechado é obrigatória.
- Frontend usa chave publishable; autorização está nas políticas e grants.
- Conteúdo do banco vai para textContent, nunca innerHTML. Imagens aceitas não incluem SVG/HTML.
- Servidor local limita arquivos a rotas públicas e trata query strings e `/admin`.

## Ambiguidades e diferenças documentadas

- “Churrasco de Picanha 400g” e “Churrasco de Alcatra 400g” nos destaques correspondem a “Picanha 400g” e “Alcatra 400g” em Refeições, com preços iguais. Os nomes do cardápio têm precedência.
- O destaque de Picanha traz **descrição de Alcatra** no original. Foi preservada, sem adivinhar correção. Revise no painel.
- Quando há duas descrições para o mesmo destaque, prevalece a do cardápio; as duas versões de origem estão documentadas no relatório JSON. Quando só há descrição no destaque, ela é aproveitada.
- “Alcatra ou Colchão Mole” foi preservado literalmente, inclusive grafia.
- Os preços por tamanho passam para registros com o tamanho no nome; as descrições que continham somente esses preços deixam de repeti-los.
- O HTML original tinha seção cardápio duplicada/aninhada, IDs repetidos e links para categorias ausentes. Corrigidos somente nessa região ao substituir os dados fixos por leitura pública.

## Testes

```sh
npm ci
npm test
npx playwright install chromium
npm run test:browser
```

`tests/database.mjs` executa a migration e o seed em PGlite (PostgreSQL local), com schemas Auth/Storage simulados: contagem, bloqueio de reimportação, grants/RLS anon, CRUD autenticado, políticas de Storage, bloqueio de Auth anônimo e preço negativo. `tests/money.cjs` verifica centavos, nulo e entradas inválidas.

`tests/public.mjs` passou: renderização pública em DOM local, destaques sem duplicação, XSS como texto, telefone centralizado e rotas HTTP reais (incluindo /admin e bloqueio de arquivos internos).

A suíte `tests/browser.cjs` foi executada com Chromium 153 e cliente Supabase simulado: roteamento, configuração ausente, login/logout, CRUD, upload/troca/remoção, retry de upload sem duplicação, rejeição de atualização no banco, perda de resposta após gravação confirmada, falha de limpeza, busca, conteúdo XSS como texto, layout mobile e carregamento público. **Resultado: testes de navegador aprovados**, com inspeção visual do painel em desktop (1440 × 900) e celular (390 × 844), incluindo o formulário de edição. Login/logout e arquivos foram simulados; isso não valida disponibilidade, credenciais ou configuração do serviço remoto. Os testes locais de PostgreSQL/DOM/navegador não substituem homologação com Auth/Storage remotos. O download padrão do Playwright falhou; usamos um executável Chromium obtido em distribuição alternativa apenas no ambiente de testes, sem acrescentá-lo ao projeto. Para usar um Chromium já instalado: `CHROMIUM_EXECUTABLE=/caminho/chromium npm run test:browser`.

Após configurar o projeto, valide com uma sessão sem login e outra administrativa: leitura pública, login/logout reais, CRUD e fotos reais. Confirme que `signUp` e sign-in anônimo estão desativados, e que requisições sem sessão não escrevem produtos/objetos. Não foi possível executar essa homologação remota sem um projeto Domorelli.

## Arquivos

Criados: admin/index.html; assets/css/admin.css; assets/js/config.js, data.js, admin.js, menu.js; assets/js/vendor/supabase.js e SUPABASE-LICENSE; scripts/import-current-menu.mjs; supabase/migrations/20260929174557_products.sql; supabase/menu-seed.sql e relatório JSON; tests/database.mjs, money.cjs, public.mjs e browser.cjs.

Modificados: index.html (produtos dinâmicos e telefone central); assets/css/styles.css (foto); assets/js/main.js (comentário de responsabilidade); server.js (rotas estáticas); package.json/package-lock.json (dependências fixadas e scripts); README.md (este relatório). As imagens e a identidade visual originais foram mantidas.
