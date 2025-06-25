import 'dotenv/config'; // Charge .env automatiquement
import pkg from 'pg';
const { Client } = pkg;

async function testDbConnection() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  try {
    await client.connect();
    const res = await client.query('SELECT NOW()');
    console.log('Connexion réussie, heure serveur:', res.rows[0]);
  } catch (error) {
    console.error('Erreur de connexion à la base:', error);
  } finally {
    await client.end();
  }
}

testDbConnection();
