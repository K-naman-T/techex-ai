import postgres from "postgres";

const DATABASE_URL = process.env.DATABASE_URL;
console.log("Checking DATABASE_URL existence...");
if (!DATABASE_URL) {
    console.error("DATABASE_URL IS MISSING");
    process.exit(1);
}

const sql = postgres(DATABASE_URL, {
    ssl: 'require',
    connect_timeout: 10,
});

async function test() {
    console.log("Test started...");
    try {
        const result = await sql`SELECT 1 as connected`;
        console.log("SUCCESS:", result);
    } catch (err: any) {
        console.log("!!! CONNECTION FAILED !!!");
        console.log("NAME:", err.name);
        console.log("MESSAGE:", err.message);
        console.log("CODE:", err.code);
        if (err.stack) console.log("STACK:", err.stack);
    } finally {
        await sql.end();
        process.exit(0);
    }
}

test();
