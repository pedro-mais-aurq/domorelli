# Domorelli Steakhouse — landing page

Site institucional de página única para a Domorelli Steakhouse (Varzelândia — MG), construído **exclusivamente com HTML5, CSS3 e JavaScript nativo**, sem frameworks, bundlers, dependências de build ou chamadas a CDN.

## Estrutura de arquivos

```text
/
  index.html              conteúdo, metadados, JSON-LD e cardápio completo
  README.md                este arquivo
  robots.txt               diretivas de rastreamento genéricas
  assets/
    css/styles.css         tokens, reset, layout, componentes e media queries
    js/main.js              vinheta, navegação móvel, ano do rodapé
    images/
      logo-original.jpeg    logo original enviada, sem alterações
      logo-domorelli.png    wordmark extraído com fundo transparente
    fonts/                  reservado para WOFF2 locais (vazio por enquanto)
```

## Como visualizar localmente

Este projeto não tem processo de build. Para visualizar, sirva a pasta com qualquer servidor HTTP simples e abra `index.html` no navegador:

```bash
# a partir da raiz do projeto
python3 -m http.server 8000
# depois acesse http://localhost:8000/
```

Qualquer servidor estático equivalente (por exemplo `npx serve`, apenas para desenvolvimento, sem afetar a stack final) também funciona.

## Como publicar

O projeto é um site estático puro. Basta copiar todos os arquivos e pastas para qualquer hospedagem de arquivos estáticos (por exemplo, Netlify, Vercel — modo estático —, GitHub Pages, ou qualquer servidor com Apache/Nginx). Não é necessário instalar dependências nem rodar `npm install`.

## Onde alterar o conteúdo

### Cardápio
Todo o cardápio está em `index.html`, dentro do bloco demarcado por:

```html
<!-- MENU DEMONSTRATIVO: INÍCIO -->
...
<!-- MENU DEMONSTRATIVO: FIM -->
```

Cada item usa `<data value="XX.00">R$ XX,00</data>` para o preço — atualize tanto o `value` (numérico) quanto o texto visível. As categorias (Entradas, Cortes, Sanduíches, Acompanhamentos, Sobremesas, Bebidas) já têm âncoras (`id`) usadas pelo menu de navegação do cardápio.

### Destaques / "Cortes da casa"
A seção `Cortes da casa` repete 3–4 itens do cardápio como vitrine. Se os preços ou nomes mudarem no bloco do cardápio, atualize manualmente também nesta seção (não há duplicação automática por JavaScript, propositalmente, para manter o HTML como fonte única de verdade).

### Telefone / WhatsApp
O número aparece em três formatos ao longo do arquivo:
- Link `wa.me` completo (usado nos botões de CTA e no botão flutuante): procure por `https://wa.me/5538991276369...` e substitua o número em todas as ocorrências.
- Telefone formatado para exibição: `(38) 99127-6369`.
- JSON-LD (`telephone`): `+55 38 99127-6369`.

### Instagram
Procure por `https://www.instagram.com/domorellisteakhouse/` e `@domorellisteakhouse`.

### Domínio (`canonical`, `og:url`, `sitemap`)
O domínio real ainda não foi informado. Há comentários `TODO` no `<head>` de `index.html` indicando exatamente onde adicionar `<link rel="canonical">` e `og:url` assim que o domínio for definido. Não crie um `sitemap.xml` nem adicione uma linha `Sitemap:` em `robots.txt` até lá.

### Endereço e horários
Não foram informados endereço completo (rua/número) nem horário de funcionamento. O site usa a formulação neutra "Endereço e horários: confirme pelo WhatsApp" na seção de localização. Assim que esses dados forem confirmados, atualize o texto da seção `#localizacao` em `index.html`.

### Logo
- `assets/images/logo-original.jpeg`: arquivo enviado pelo cliente, preservado sem alterações.
- `assets/images/logo-domorelli.png`: extração automatizada (por limiar de luminância com suavização de borda) do wordmark "DOMORELLI" e do subtítulo "steakhouse" sobre fundo transparente, a partir do JPEG original. O símbolo superior (chifres) que aparece cortado no arquivo original **não foi reconstruído**, conforme instrução do briefing.
- **TODO:** a marca deve fornecer, assim que possível, um arquivo vetorial (SVG) ou um PNG transparente em alta resolução e com o símbolo completo, para substituir `logo-domorelli.png`.

### Fontes
Não há arquivos de fonte locais neste momento. O CSS usa apenas pilhas de fontes do sistema (nenhuma chamada a Google Fonts ou outro CDN). Caso arquivos `.woff2` com licença compatível (por exemplo, Barlow Condensed para títulos e Manrope para o corpo do texto, citados como referência no briefing) sejam disponibilizados, adicione-os em `assets/fonts/` e declare-os com `@font-face` no topo de `assets/css/styles.css`, atualizando as variáveis `--font-display` e `--font-body`.

## Limitações conhecidas dos assets

- A logo transparente foi gerada por extração automática de um JPEG de baixa resolução com fundo preto; não é um vetor original. Uma borda muito sutil pode ficar perceptível sobre fundos muito claros — irrelevante no site atual, que usa fundo escuro, mas relevante se a logo for reutilizada em materiais com fundo claro.
- Não há fotografias oficiais do restaurante, pratos ou ambiente. A identidade visual usa apenas tipografia, texturas de chapa/brasa em CSS puro e a logo fornecida.
- O cardápio (itens, descrições e preços) é fictício e ilustrativo, criado para preencher a estrutura — deve ser substituído pelo cardápio real antes da publicação.

## Dados que ainda precisam ser fornecidos antes da publicação

- Domínio final (para `canonical`, `og:url` e eventual `sitemap.xml`).
- Endereço completo (rua e número).
- Horário de funcionamento.
- Logo em alta resolução, com fundo transparente e símbolo completo (SVG ou PNG).
- Fotografias oficiais do ambiente e dos pratos.
- Cardápio real (produtos, descrições e preços).

## Verificações executadas nesta entrega

Testado localmente com um servidor HTTP estático e o Playwright/Chromium disponíveis neste ambiente:

- ✅ `index.html`, `styles.css`, `main.js`, `robots.txt` e as imagens respondem com HTTP 200.
- ✅ Layout verificado em 320px, 375px, 768px, 1024px e 1440px, sem overflow horizontal (`scrollWidth` = `clientWidth` do documento em todas as larguras).
- ✅ Nenhum erro de console/`pageerror` detectado nas larguras testadas.
- ✅ Hierarquia de títulos validada: exatamente um `<h1>`, quatro `<h2>`, seis `<h3>`.
- ✅ JSON-LD validado como JSON bem formado, contendo apenas nome, telefone, localidade/região/país e Instagram (sem avaliações, endereço completo ou dados fictícios).
- ✅ Contraste de cor verificado matematicamente (fórmula WCAG) para as combinações de texto/fundo usadas: todas as combinações de texto normal atingem ≥ 4.5:1 (o texto sobre os botões usa tons de brasa mais escuros, `--color-ember-btn` / `--color-ember-btn-hot`, escolhidos especificamente para isso); textos grandes/negrito ficam acima de 3:1.
- ✅ Links testados por automação: WhatsApp (URL exata do briefing, idêntica em todos os CTAs e no botão flutuante), Instagram e Google Maps abrem com `target="_blank"` e `rel="noopener noreferrer"` em todas as ocorrências.
- ✅ Com JavaScript desativado: a navegação permanece visível (não usa `display:none`), o cardápio completo continua presente e legível, e a vinheta de abertura permanece oculta (não bloqueia a página).
- ✅ Com `prefers-reduced-motion: reduce`: a vinheta não é exibida; o conteúdo aparece imediatamente.
- ✅ Menu móvel testado por automação: abre com `aria-expanded="true"`, fecha com `Escape` e devolve o foco ao botão de menu.
- ✅ Ordem de foco por teclado verificada por automação: link "Pular para o conteúdo" → (vinheta, apenas enquanto ativa) → logo do cabeçalho → itens de navegação. Após a vinheta fechar, ela sai completamente da árvore de foco (`display: none` reforçado sobre `[hidden]`, corrigindo uma sobreposição de especificidade encontrada durante o teste).
- ✅ Rolagem por âncora testada por automação: `#cardapio` e `#localizacao` ficam com o topo alinhado logo abaixo do cabeçalho sticky, sem conteúdo escondido atrás dele (`scroll-margin-top` adicionado às seções principais durante a verificação).
- ✅ Vinheta configurada para ocorrer no máximo uma vez por sessão via `sessionStorage`, com captura de falha caso o `sessionStorage` esteja indisponível.

### Não executado neste ambiente

- **Auditoria Lighthouse completa**: este ambiente não tem o Chrome DevTools/Lighthouse CLI configurado para gerar um relatório oficial de Performance/SEO/Boas Práticas/Acessibilidade. As verificações de acessibilidade e performance acima foram feitas por checagem manual e por scripts próprios (contraste, overflow, erros de console), não substituem uma auditoria Lighthouse real. Recomenda-se rodar o Lighthouse (Chrome DevTools ou `npx lighthouse`, apenas como ferramenta de auditoria, sem entrar na stack do projeto) após a publicação.
- **Teste manual de leitor de tela** (NVDA/VoiceOver/TalkBack): a estrutura semântica e os atributos ARIA foram implementados e revisados manualmente, mas não há confirmação de teste com leitor de tela real neste ambiente.
