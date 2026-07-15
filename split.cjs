const fs = require('fs');
const path = require('path');

const root = __dirname;
const clientDir = path.join(root, 'client');
const serverDir = path.join(root, 'server');

// Criar pastas
if (!fs.existsSync(clientDir)) fs.mkdirSync(clientDir);
if (!fs.existsSync(serverDir)) fs.mkdirSync(serverDir);

// Arquivos para o Client
const clientFiles = ['src', 'public', 'index.html', 'vite.config.js', 'eslint.config.js', '.oxlintrc.json', 'vercel.json'];

// Arquivos para o Server
const serverFiles = ['server.js', 'extractor.js', 'db.js', 'data', 'server.log', '.env', '.env.example', 'local_import.js', 'jikan_test.json'];

function copySync(src, dest) {
  if (!fs.existsSync(src)) return;
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest);
    const files = fs.readdirSync(src);
    for (const f of files) {
      copySync(path.join(src, f), path.join(dest, f));
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

// Copiar
clientFiles.forEach(f => {
  copySync(path.join(root, f), path.join(clientDir, f));
});
serverFiles.forEach(f => {
  copySync(path.join(root, f), path.join(serverDir, f));
});

// Criar package.json separados
const oldPkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

const clientPkg = {
  name: "anime-v2-client",
  private: true,
  version: "2.0.0",
  type: "module",
  scripts: {
    dev: "vite --port 3000",
    build: "vite build",
    preview: "vite preview"
  },
  dependencies: {
    "hls.js": oldPkg.dependencies["hls.js"],
    "react": oldPkg.dependencies["react"],
    "react-dom": oldPkg.dependencies["react-dom"],
    "wouter": oldPkg.dependencies["wouter"]
  },
  devDependencies: oldPkg.devDependencies
};

const serverPkg = {
  name: "anime-v2-server",
  private: true,
  version: "2.0.0",
  type: "module",
  scripts: {
    start: "node server.js",
    dev: "node server.js"
  },
  dependencies: {
    "dotenv": oldPkg.dependencies["dotenv"],
    "mongodb": oldPkg.dependencies["mongodb"]
  }
};

fs.writeFileSync(path.join(clientDir, 'package.json'), JSON.stringify(clientPkg, null, 2));
fs.writeFileSync(path.join(serverDir, 'package.json'), JSON.stringify(serverPkg, null, 2));

// Adicionar um package.json raiz (opcional, bom para rodar ambos ao mesmo tempo)
const rootPkg = {
  name: "anime-v2-monorepo",
  private: true,
  scripts: {
    "install:all": "npm install --prefix client && npm install --prefix server",
    "dev:client": "npm run dev --prefix client",
    "dev:server": "npm run dev --prefix server",
    "dev": "npm run dev:server & npm run dev:client"
  }
};
fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify(rootPkg, null, 2));

console.log("Cópia concluída! Arquivos movidos para client/ e server/.");
