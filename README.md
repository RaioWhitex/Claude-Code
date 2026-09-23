# Gustavo Steferson — portfólio

Portfólio pessoal de **Gustavo Steferson de Souza Rocha**: técnico em Eletrotécnica e estudante de Análise e Desenvolvimento de Sistemas.

Página única feita com **HTML, CSS e JavaScript puros**, mais **Three.js** para o avatar 3D. Não tem etapa de build.

## Destaques

- **Personagem 360° na tela inicial:** fotos reais do personagem (frente, lados e costas), recortadas do fundo, girando sobre uma **plataforma elevatória 3D** (mecanismo de tesoura que sobe ao carregar). A foto exibida acompanha o ângulo da plataforma, com transição suave entre as vistas. Dá para girar arrastando e pausar a animação.
- Paleta **preto, branco e dourado**, com tema claro/escuro e cartões de vidro.
- Seções: Sobre mim, Experiência, Projetos, Habilidades (com filtro), Formação, Competências e Contato.
- Responsivo e acessível, respeita `prefers-reduced-motion` e pausa o 3D quando sai da tela.

## Estrutura

```
index.html, 404.html
assets/
├── css/main.css
├── js/app.js          # tema, menu, filtros, formulário
├── js/avatar.js       # cena 3D (avatar, plataforma, luzes)
├── img/avatar/        # view-0..3.webp: frente, lado direito, costas, lado esquerdo
└── vendor/three/      # Three.js r170 (licença MIT)
```

## Rodar localmente

O 3D usa módulos ES, então sirva a pasta (abrir o arquivo direto não funciona):

```bash
python3 -m http.server 8000
# http://localhost:8000
```

## Trocar as fotos ou usar um modelo 3D de verdade (opcional)

**Fotos:** substitua `assets/img/avatar/view-0.webp` a `view-3.webp` por PNG/WebP com fundo transparente, em 640×1400 px, com a pessoa ocupando 1370 px de altura e os pés 12 px acima da borda de baixo. A ordem é frente, lado direito, costas, lado esquerdo.

**Modelo 3D (.glb):** para um giro com volume real, em vez de fotos:

1. Gere um modelo `.glb` do seu corpo e rosto em um gerador de avatar 3D a partir de selfie (por exemplo, o Avaturn), ou num app de escaneamento 3D para celular.
2. Salve o arquivo como `assets/models/avatar.glb`.
3. Em `index.html`, troque `data-model=""` por `data-model="assets/models/avatar.glb"` na `<div class="stage">`.

O site ajusta a escala sozinho e coloca o modelo girando sobre a plataforma.

## Publicar no GitHub Pages

Settings → Pages → *Deploy from a branch* → escolha a branch e a pasta `/ (root)`.
