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
- `instagramUrl`: perfil oficial
- `whatsappNumber`: telefone oficial no formato internacional com DDI e DDD; vazio mantém os links ocultos
- `coordinates`: latitude e longitude usadas pelo mapa e pelo botão de rota
- `locationUrl` e `address`: link de rota e endereço, ambos opcionais
- `googleReviewsUrl`, `googleRating` e `googleReviewCount`: avaliação do Google; só são mostrados quando configurados com valores válidos

Não foram incluídos telefone, endereço detalhado, horários, preços, promoções, estoque, nota ou quantidade de avaliações não confirmados. A disponibilidade dos produtos pode variar.

## Imagens

As fotografias da loja ficam em `assets/images/` e são usadas localmente pelo site. Preserve os nomes e caminhos atuais ao substituir uma fotografia. Confirme que há autorização de uso comercial das fotografias publicadas.