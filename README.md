# 🎌 AnimeIndex (AnimeKaiKai v2)

Um ecossistema completo de streaming de animes com extração automática, compressão nativa e uma interface cinematográfica.

![UI Preview](https://img.shields.io/badge/UI-Cinematic_OLED-black?style=flat-square&logo=react)
![Backend](https://img.shields.io/badge/Backend-Node.js_Native-339933?style=flat-square&logo=node.js)
![Storage](https://img.shields.io/badge/Storage-GZIP_JSON-blue?style=flat-square)

---

## ✨ Funcionalidades Incríveis

*   **Extração Automática (Scraping):** Extrai catálogos inteiros e episódios de provedores conhecidos (AnimeFire, Goyabu, etc) de forma silenciosa e sob demanda.
*   **Dual-Scraper Fallback:** Se um anime não for encontrado no idioma original, o sistema tenta adivinhar o link utilizando a versão Romaji (Japonês), reduzindo erros de indexação a quase zero.
*   **Compressão Extrema de Dados:** Utiliza o módulo `zlib` nativo do Node.js para armazenar o banco de dados e arquivos de animes no formato binário `.json.gz`. Economia de **~90%** em disco e RAM.
*   **Calendário Jikan API:** Integração com o MyAnimeList (via Jikan) para listar os Lançamentos do Dia. O sistema possui Auto-Retry (*Exponential Backoff*) e Cache local para se defender dos constantes erros `504` da API.
*   **UI/UX Pro Max:** Interface *OLED Dark Mode* inspirada nas maiores plataformas de streaming. Transições suaves, *Lazy Rendering* (paginação) em listas gigantes para não travar a GPU, e sistema de Badges para novos episódios.
*   **Tarefas em Segundo Plano:** Verifica lançamentos em andamento periodicamente (Cron) e atualiza sua base automaticamente.

## 🛠️ Tecnologias Utilizadas

*   **Frontend:** React.js, Vite, Vanilla CSS com variáveis dinâmicas, HLS.js para streaming.
*   **Backend:** Node.js Nativo (sem dependências de frameworks pesados como Express para maior performance). 

## 🚀 Como Executar Localmente

Você precisará do [Node.js](https://nodejs.org/) instalado.

1. Instale as dependências:
```bash
npm install
```

2. Inicie o Servidor Backend (API e Scraper):
```bash
node server.js
```
> O servidor rodará na porta **5000**. Os logs de todas as operações e extrações serão salvos automaticamente no arquivo `server.log`.

3. Em outro terminal, inicie o Frontend:
```bash
npm run dev
```
> O frontend rodará na porta **3000** e fará proxy reverso para o backend.

## 📦 Hospedagem e Deploy (ATENÇÃO)

Devido à arquitetura da aplicação, você deve hospedar o Frontend e o Backend em locais diferentes (ou em um servidor que suporte Node contínuo).

### 🟢 Frontend (Recomendado: Vercel, Netlify)
O front-end é uma Single Page Application (SPA) gerada pelo Vite.
Ele pode ser hospedado facilmente e **gratuitamente** na **Vercel**.
Basta interligar o seu repositório no Vercel que ele construirá a pasta `dist` automaticamente.

### 🔴 Backend (Recomendado: Render, Railway, VPS, Hostinger)
**NÃO HOSPEDE O BACKEND NA VERCEL.**
A Vercel utiliza funções *Serverless* (Sem servidor persistente) que possuem duas grandes limitações que quebram o nosso backend:
1. **O Disco é Read-Only:** O nosso backend escreve constantemente os dados dos episódios e o index compactado (`.json.gz`) na pasta `/data`. A Vercel bloqueia gravações locais.
2. **Tempo Limite (Timeout):** Funções *Serverless* são mortas após 10 segundos na Vercel gratuita. O nosso backend precisa manter um relógio rodando para raspar novos episódios de tempos em tempos.

**Hospede o arquivo `server.js` em locais como o [Render.com](https://render.com/), [Railway](https://railway.app/) ou uma VPS**, pois eles oferecem um container de longa duração com disco liberado.
