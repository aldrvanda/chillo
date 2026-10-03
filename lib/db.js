import { MongoClient } from 'mongodb';
import dns from 'dns';

// Local DNS resolvers (e.g. 127.0.0.1 from a VPN/antivirus) may refuse the SRV lookup
// needed by mongodb+srv:// URIs, so use public DNS during local development.
if (process.env.NODE_ENV === 'development') {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
}

if (!process.env.DB_URI) {
  throw new Error('MongoDB URI not found. Please set DB_URI in your .env.local file.');
}

const uri = process.env.DB_URI;
const options = {
  tls: true,
  tlsAllowInvalidCertificates: false,
  serverSelectionTimeoutMS: 10000,
  connectTimeoutMS: 10000,
};

// Cache the connection promise (on `global` in dev so it survives hot reloads),
// but drop it on failure so the next request retries instead of failing forever.
function getClientPromise() {
  const cache = process.env.NODE_ENV === 'development' ? global : getClientPromise;
  if (!cache._mongoClientPromise) {
    cache._mongoClientPromise = new MongoClient(uri, options).connect().catch((err) => {
      cache._mongoClientPromise = null;
      throw err;
    });
  }
  return cache._mongoClientPromise;
}

async function getDB(dbName) {
  try {
    const connectedClient = await getClientPromise();
    return connectedClient.db(dbName);
  } catch (err) {
    console.error('[MongoDB] Connection error:', err);
    throw new Error('Failed to connect to database.', { cause: err });
  }
}

export async function getCollection(collectionName) {
  const db = await getDB('smartFridge_DB');
  if (!db) return null;
  return db.collection(collectionName);
}
