# Gustavo Steferson — portfólio

Portfólio pessoal de **Gustavo Steferson de Souza Rocha**: Auxiliar de TI, técnico em Eletrotécnica e estudante de Análise e Desenvolvimento de Sistemas.

Página única feita com **HTML, CSS e JavaScript puros**, mais **Three.js** para o palco 3D. Não tem etapa de build.

## Destaques

- **Personagem em relevo 3D:** a foto do Gustavo de terno, recortada, vira uma malha 3D (mapa de profundidade gerado por IA + volume da silhueta) que gira em vai-e-vem sobre a plataforma de mármore. Dá para girar arrastando e pausar a animação.
- Layout em cartões de vidro, paleta **branco, preto e dourado**, com tema claro/escuro.
- Seções: Início, Sobre, O que eu faço, Tecnologias (com logos e filtro), Experiência, Projetos, Formação (instituições + cursos extracurriculares), Método e Contato.
- **Formulário de contato** que envia as mensagens direto para o e-mail, via [FormSubmit](https://formsubmit.co).

## Estrutura

```
index.html, 404.html
assets/
├── css/main.css
├── js/app.js          # tema, menu, filtros, formulário
├── js/stage.js        # palco 3D (plataforma + personagem em relevo)
├── img/hero/          # stage.webp (plataforma), figure.webp + figure-depth.png (personagem), fallback.webp
├── img/logos/         # logos das ferramentas (SVG)
├── img/projects/      # imagens dos projetos
└── vendor/three/      # Three.js r170 (licença MIT)
```

## Rodar localmente

O 3D usa módulos ES, então sirva a pasta (abrir o arquivo direto não funciona):

```bash
python3 -m http.server 8000
# http://localhost:8000
```

## Formulário de contato (ativação única)

As mensagens são enviadas pelo FormSubmit para `stefersongustavofc@gmail.com`. **Na primeira mensagem enviada pelo site, o FormSubmit manda um e-mail de confirmação para esse endereço: clique em "Activate Form".** A partir daí todas as mensagens chegam direto na caixa de entrada.

## Créditos dos logos

Logos das ferramentas vindos de conjuntos abertos da [Iconify](https://iconify.design): Logos (CC0), VSCode Icons (MIT), Devicon (MIT) e Simple Icons (CC0). As marcas pertencem aos seus respectivos donos.
