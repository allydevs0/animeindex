import { bulkImportAnimesOnline, bulkImportMeusAnimes, loadIndex, saveIndex } from './extractor.js';

async function run() {
  console.log("Iniciando extração LOCAL (para bypass do Cloudflare)...");
  
  // Tentar extrair AnimesOnline
  try {
    const resAO = await bulkImportAnimesOnline((progress) => {
      console.log(`[AnimesOnline] Página/Sitemap processado. Total até agora: ${progress.totalImported}`);
    });
    console.log("✅ AnimesOnline finalizado:", resAO.message);
  } catch(e) {
    console.error("❌ Erro AnimesOnline:", e.message);
  }

  // Tentar extrair MeusAnimes
  try {
    const resMA = await bulkImportMeusAnimes((progress) => {
      console.log(`[MeusAnimes] Página/Sitemap processado. Total até agora: ${progress.totalImported}`);
    });
    console.log("✅ MeusAnimes finalizado:", resMA.message);
  } catch(e) {
    console.error("❌ Erro MeusAnimes:", e.message);
  }

  console.log("Processo concluído! O arquivo data/index.json.gz foi atualizado na sua máquina.");
}

run();
