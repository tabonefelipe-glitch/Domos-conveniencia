# DOMUS CONVENIÊNCIA

Loja virtual e site institucional da Domus Conveniência. O catálogo e as categorias são gerenciados pelo painel administrativo; os pedidos são revisados no site e enviados pelo cliente ao WhatsApp da loja. O site não processa pagamentos.

## Tecnologias

- HTML5, CSS3 e JavaScript sem etapa de build
- Node.js e Express
- SQLite local (`data/domus.db`) ou PostgreSQL quando `DATABASE_URL` estiver configurada
- Sessões administrativas com `express-session` e senhas armazenadas com bcrypt
- Upload de imagens do catálogo para `uploads/`

## Executar localmente

Requer Node.js compatível com `process.loadEnvFile` (Node.js 20.12 ou mais recente).

```sh
npm install
npm start
```

O servidor usa a porta `3000` por padrão. Para desenvolvimento com reinício automático, use `npm run dev`.

## Configuração

Defina as variáveis de ambiente no provedor de hospedagem ou em um arquivo `.env` local, que não deve ser publicado:

- `PORT`: porta HTTP (padrão `3000`)
- `SESSION_SECRET`: segredo longo e aleatório para assinar sessões
- `ADMIN_EMAIL` e `ADMIN_PASSWORD`: credenciais iniciais do painel
- `DATABASE_URL`: URL PostgreSQL; quando ausente, o servidor usa SQLite
- `WHATSAPP_NUMBER`: telefone da loja no formato internacional, apenas dígitos
- `STORE_NAME`: nome público da loja

Em produção, `SESSION_SECRET` e `ADMIN_PASSWORD` são obrigatórios. As credenciais administrativas não são entregues ao navegador. A conta administrativa inicial só é criada quando não existe uma conta com o e-mail configurado.

## Rotas principais

- `/`: site institucional
- `/shop.html` ou `/loja`: catálogo, carrinho e checkout
- `/admin`: painel protegido para produtos, categorias e configurações
- `/api/products` e `/api/categories`: catálogo público
- `/api/orders/validate`: valida disponibilidade, estoque e preços atuais antes do pedido
- `/api/health`: verificação de saúde do serviço

O carrinho é armazenado no navegador. A validação do pedido usa os dados atuais do banco; a loja confirma pelo WhatsApp a disponibilidade final e eventual taxa de entrega. Nenhum pagamento é simulado ou aprovado pelo site.

## Publicação

Publique como serviço Node.js usando `npm install` na instalação e `npm start` no comando de início. Configure os segredos e `DATABASE_URL` no ambiente do provedor. Preserve o armazenamento persistente do banco SQLite e da pasta `uploads/` se optar por SQLite; em ambientes efêmeros, prefira PostgreSQL e armazenamento persistente de imagens.# DOMUS CONVENIÊNCIA

Landing page institucional estática da DOMUS CONVENIÊNCIA em Campinas, São José - SC, com fotografias locais, localização e canais oficiais.

## Tecnologias

- HTML5 semântico
- CSS3 responsivo com Grid e Flexbox
- JavaScript puro, sem processo de build ou dependência de backend
- Imagens locais em `assets/images/`

## Estrutura

```text
.
├── index.html
├── favicon.svg
├── css/
│   └── style.css
├── js/
│   └── script.js
└── assets/
    └── images/
```

## Executar localmente

Abra `index.html` no navegador. O site não exige instalação de pacotes nem servidor de aplicação. Para testar no celular pela rede local, sirva a pasta raiz com qualquer servidor HTTP estático.

## Publicar no Render

Crie um **Static Site** conectado ao repositório GitHub e use a raiz do projeto como diretório publicado (`.`). Não há comando de build. Cada atualização enviada à branch principal pode ser publicada automaticamente pelo Render.

O site também pode ser hospedado em qualquer serviço que sirva arquivos estáticos, incluindo a pasta `public_html` da Hostinger.

## Configurações

As informações editáveis ficam no objeto `DOMUS_CONFIG`, no início de `js/script.js`:

- `companyName`: nome da empresa
- `businessLabel` e `locationLabel`: identificação da empresa e localidade
- `siteUrl`: domínio público usado pelo canonical e Open Graph
- `instagramUrl`: perfil oficial
- `whatsappNumber`: telefone oficial no formato internacional com DDI e DDD; vazio mantém os links ocultos
- `whatsappMessage`: mensagem inicial codificada nos links do WhatsApp
- `coordinates`: latitude e longitude usadas pelo mapa e pelo botão de rota
- `locationUrl`: perfil do Google Maps usado nos links de localização e avaliações
- `address`: endereço exibido na seção de contato
- `businessHours`, `delivery`, `pickup` e `paymentMethods`: dados comerciais opcionais; vazios por padrão e ocultos até confirmação
- `googleRating` e `googleReviewCount`: nota média e total de avaliações do Maps

O número e a mensagem oficial de WhatsApp estão configurados no JavaScript. O endereço e os dados de reputação foram confirmados na ficha pública do Google Maps; horários, preços, promoções e estoque não são declarados pelo site. As categorias refletem as fotografias disponíveis; consulte a loja sobre disponibilidade atual.

## Imagens

A logo horizontal oficial e as fotografias reais ficam em `assets/images/`. O cabeçalho, o rodapé e o favicon usam `logo-domus-horizontal.png`; os arquivos anteriores foram preservados. Preserve os nomes e caminhos referenciados no HTML ao substituir uma fotografia. Confirme que há autorização de uso comercial das fotografias publicadas.

A logo horizontal disponível tem 2172 × 724 px e é exibida com `object-fit: contain`, sem esticar ou filtrar o arquivo.