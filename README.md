# // GUSTAVO.DEV

Portfólio pessoal de **Gustavo Steferson de Souza Rocha**: estudante de Análise e Desenvolvimento de Sistemas e Técnico em Eletrotécnica.

Feito com **HTML, CSS e JavaScript puros**, sem frameworks nem etapa de build. Estética brutalista escura, com grade de bordas, tipografia display condensada, rótulos monoespaçados e um acento elétrico que pode ser trocado entre **azul** e **ouro** (a identidade preto e dourado do portfólio anterior).

## Páginas

| Arquivo | Conteúdo |
|---|---|
| `index.html` | Hero com texto digitado, globo 3D de pontos em canvas, painel "SYSTEM" com relógio ao vivo, marquee, índice e números |
| `sobre.html` | Bio, ficha técnica e perfil profissional |
| `habilidades.html` | Cards de stack com inclinação 3D + spotlight e barras de proficiência segmentadas |
| `formacao.html` | Linha do tempo e "save slots" com a trajetória acadêmica |
| `contato.html` | Título gigante, adesivo animado, canais numerados, faixa de disponibilidade e formulário |
| `404.html` | Página de erro |

## Efeitos

- Loader "boot sequence" (mais curto a partir da segunda página da sessão)
- Canvas animado (globo de pontos e terreno em onda) que reage ao mouse e pausa fora da tela
- Revelação ao rolar, glitch nos títulos, texto embaralhado no hover do menu
- Cursor personalizado, barra de progresso de rolagem, grão de filme
- Troca de cor de destaque (azul/ouro), salva no navegador
- Botão "copiar e-mail" e formulário que abre o e-mail já preenchido
- Responsivo, acessível (skip link, foco visível, ARIA) e com `prefers-reduced-motion` respeitado

## Estrutura

```
├── index.html, sobre.html, habilidades.html, formacao.html, contato.html, 404.html
└── assets/
    ├── css/style.css   # tokens, layout e animações
    ├── js/main.js      # loader, canvas, interações
    └── img/favicon.svg
```

## Rodar localmente

Abra `index.html` no navegador, ou sirva a pasta:

```bash
python3 -m http.server 8000
# http://localhost:8000
```

## Publicar no GitHub Pages

Settings → Pages → *Deploy from a branch* → escolha a branch e a pasta `/ (root)`.

## Personalizar

- **Cores:** variáveis no topo de `assets/css/style.css` (`--accent`, `--accent-bright`, `--accent-glow`).
- **Fontes:** Anton, Inter e JetBrains Mono (Google Fonts), carregadas no `<head>` de cada página.

Layout inspirado na estrutura de [joaofortes.dev](https://joaofortes.dev/contact). Todo o código e os elementos visuais são originais.
