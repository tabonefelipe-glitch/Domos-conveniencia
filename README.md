# DOMUS CONVENIÊNCIA

Landing page institucional estática para apresentar a Domus Conveniência, suas categorias ilustrativas, localização e canais oficiais.

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
- `instagram`: perfil oficial
- `coordinates`: latitude e longitude usadas pelo mapa e pelo botão de rota
- `whatsappNumber`: número internacional apenas com dígitos; vazio mantém o link de WhatsApp oculto

Não foram incluídos telefone, endereço detalhado, horários, preços, promoções, estoque ou avaliações não confirmados. As categorias são ilustrativas; confirme o mix de produtos antes de atualizar os textos.

## Imagens

As imagens de demonstração ficam em `assets/images/`. Substitua cada arquivo mantendo o mesmo nome e formato para atualizar as fotografias sem alterar os caminhos no HTML. Confirme que há autorização de uso das fotografias publicadas.