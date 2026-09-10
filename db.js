import 'dotenv/config';
import { MongoClient } from 'mongodb';

const uri = process.env.MONGO_URL;
let client = null;
let db = null;

// The global in-memory store so the app can stay 100% synchronous
global.MONGO_CACHE = {
  files: {}
};

export async function initMongoDB() {
  if (!uri) {
    console.warn("⚠️ MONGO_URL não configurado! Usando sistema de arquivos local (arquivos podem ser apagados pelo Render).");
    return;
  }
  
  try {
    client = new MongoClient(uri);
    await client.connect();
    db = client.db('animeindex');
    console.log("✅ Conectado ao MongoDB! Restaurando dados para a memória...");

    const allDocs = await db.collection('vfs').find().toArray();
    for (const doc of allDocs) {
      global.MONGO_CACHE.files[doc._id] = doc.data;
    }
    console.log(`✅ MongoDB: ${allDocs.length} arquivos virtuais restaurados!`);
  } catch (err) {
    console.error("❌ Erro fatal ao conectar ao MongoDB:", err);
  }
}

// Background save mechanism
const saveQueue = new Set();
let saveTimeout = null;

export function scheduleMongoSave(filename, data) {
  if (!db) return; // Se não tem mongo, não faz nada
  
  global.MONGO_CACHE.files[filename] = data;
  saveQueue.add(filename);

  if (!saveTimeout) {
    saveTimeout = setTimeout(async () => {
      saveTimeout = null;
      const filesToSave = Array.from(saveQueue);
      saveQueue.clear();

      try {
        const bulk = filesToSave.map(file => ({
          updateOne: {
            filter: { _id: file },
            update: { $set: { data: global.MONGO_CACHE.files[file] } },
            upsert: true
          }
        }));
        if (bulk.length > 0) {
          await db.collection('vfs').bulkWrite(bulk);
        }
      } catch (err) {
        console.error("❌ Falha ao salvar no MongoDB em background:", err);
      }
    }, 5000); // Salva em lotes a cada 5 segundos para não spammar o banco
  }
}
