
import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
    console.error("GEMINI_API_KEY not found in environment");
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);

async function listModels() {
    try {
        const models = await genAI.listModels();
        console.log("Available Models:");
        for (const model of models.models) {
            console.log(`- ${model.name} (${model.displayName})`);
            console.log(`  Supported Methods: ${model.supportedGenerationMethods.join(", ")}`);
        }
    } catch (err) {
        console.error("Error listing models:", err);
    }
}

listModels();
