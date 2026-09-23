# Gustavo Steferson — portfólio

Portfólio pessoal de **Gustavo Steferson de Souza Rocha**: técnico em Eletrotécnica e estudante de Análise e Desenvolvimento de Sistemas.

Página única feita com **HTML, CSS e JavaScript puros**, mais **Three.js** para o avatar 3D. Não tem etapa de build.

## Destaques

- **Avatar 3D na tela inicial:** um avatar com o rosto do Gustavo, camisa preta e branca com tentáculos, calça jeans preta e tênis brancos, girando sobre uma **plataforma elevatória** (mecanismo de tesoura que sobe ao carregar). Dá para girar arrastando e pausar a animação.
- Layout "bento" com cartões de vidro, tema **claro/escuro** e brilho que segue o mouse.
- Seções: Sobre mim, Experiência, Projetos, Habilidades (com filtro), Formação, Competências e Contato.
- Responsivo e acessível, respeita `prefers-reduced-motion` e pausa o 3D quando sai da tela.

## Estrutura

```
index.html, 404.html
assets/
├── css/main.css
├── js/app.js          # tema, menu, filtros, formulário
├── js/avatar.js       # cena 3D (avatar, plataforma, luzes)
├── img/avatar/        # face.webp (rosto) e shirt.webp (estampa da camisa)
└── vendor/three/      # Three.js r170 (licença MIT)
```

## Rodar localmente

O 3D usa módulos ES, então sirva a pasta (abrir o arquivo direto não funciona):

```bash
python3 -m http.server 8000
# http://localhost:8000
```

## Usar um avatar 3D ainda mais realista (opcional)

O avatar padrão é montado em código. Para trocar por um modelo realista feito a partir de fotos:

1. Gere um modelo `.glb` do seu corpo e rosto em um gerador de avatar 3D a partir de selfie (por exemplo, o Avaturn), ou num app de escaneamento 3D para celular.
2. Salve o arquivo como `assets/models/avatar.glb`.
3. Em `index.html`, troque `data-model=""` por `data-model="assets/models/avatar.glb"` na `<div class="stage">`.

O site ajusta a escala sozinho e coloca o modelo girando sobre a plataforma.

## Publicar no GitHub Pages

Settings → Pages → *Deploy from a branch* → escolha a branch e a pasta `/ (root)`.
