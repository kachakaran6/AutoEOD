import 'dotenv/config';
import OpenAI from 'openai';

async function listModels() {
  const apiKey = process.env.OPENAI_API_KEY;
  const baseURL = process.env.OPENAI_BASE_URL;

  const openai = new OpenAI({
    apiKey,
    baseURL,
  });

  try {
    const list = await openai.models.list();
    console.log("Available models on Groq:");
    for await (const model of list) {
      console.log("-", model.id);
    }
  } catch (err: any) {
    console.error("Error listing models:", err);
  }
}

listModels();
