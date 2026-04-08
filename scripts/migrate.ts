import postgres from "postgres";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
    console.error("Error: DATABASE_URL is missing in environment variables.");
    process.exit(1);
}

const sql = postgres(DATABASE_URL, {
    ssl: 'require',
    max: 1,
});

async function migrate() {
    console.log("[MIGRATE] Attempting to connect to Supabase...");

    try {
        // Test connection
        await sql`SELECT 1`;
        console.log("[MIGRATE] Connection successful.");

        console.log("[MIGRATE] Creating tables...");

        await sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        name TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;

        await sql`
      CREATE TABLE IF NOT EXISTS conversations (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        title TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;

        await sql`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
        role TEXT,
        content TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;

        await sql`
      CREATE TABLE IF NOT EXISTS user_configs (
        user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        voice_provider TEXT DEFAULT 'elevenlabs',
        voice_id TEXT,
        stt_language TEXT DEFAULT 'en-IN'
      );
    `;

        console.log("[MIGRATE] Success! All tables created/verified.");
    } catch (error) {
        console.error("[MIGRATE] Failed with error:");
        console.error(error);
    } finally {
        await sql.end();
        process.exit(0);
    }
}

migrate();
