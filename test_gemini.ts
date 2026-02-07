
import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = "AIzaSyCF5ji04Y08NvQVDN6amswIdgpGvBD3aN4";
const genAI = new GoogleGenerativeAI(API_KEY);

async function test() {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        const result = await model.generateContent("Say hello");
        console.log("Success:", result.response.text());
    } catch (e) {
        console.error("Connectivity Test Failed:", e);
    }
}

test();
