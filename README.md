# DOMUS CONVENIÊNCIA

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