export class ApiKeyManager {
    private keys: string[] = [];
    private currentIndex = 0;

    constructor() {
        // Collect Gemini API keys from the environment variables automatically.
        // We explicitly ignore the default GEMINI_API_KEY and only use the dedicated rotation keys (key1, key2, key3...)
        const envEntries = Object.entries(process.env);

        // Deduplicate and filter legitimate Gemini keys
        const validKeys = envEntries
            .filter(([keyName, val]) => keyName.startsWith("key") && typeof val === "string" && val.startsWith("AIzaSy"))
            .map(([, val]) => val as string);

        this.keys = Array.from(new Set(validKeys));

        if (this.keys.length === 0) {
            console.warn("[ApiKeyManager] \u26A0\uFE0F No Gemini API keys found starting with 'AIzaSy' in environment!");
        } else {
            console.log(`[ApiKeyManager] \uD83D\uDD04 Initialized with ${this.keys.length} Gemini API keys for round-robin rotation.`);
        }
    }

    /**
     * Retrieves the next available API key in round-robin order.
     */
    public getNextKey(): string {
        if (this.keys.length === 0) {
            throw new Error("No Gemini API keys configured on the server.");
        }
        const key = this.keys[this.currentIndex] as string;
        this.currentIndex = (this.currentIndex + 1) % this.keys.length;
        return key;
    }
}
