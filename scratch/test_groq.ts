import 'dotenv/config';
import OpenAI from 'openai';

async function testModel(modelName: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  const baseURL = process.env.OPENAI_BASE_URL;

  const openai = new OpenAI({
    apiKey,
    baseURL,
  });

  try {
    const res = await openai.chat.completions.create({
      model: modelName,
      messages: [{ role: 'user', content: 'Say hello in JSON format: {"greeting": "hello"}' }],
      response_format: { type: 'json_object' }
    });
    console.log(`[${modelName}] Success:`, res.choices[0].message.content);
  } catch (err: any) {
    console.error(`[${modelName}] Failed:`, err.message);
  }
}

async function run() {
  const models = [
    'openai/gpt-oss-120b',
    'openai/gpt-oss-20b',
    'qwen/qwen3.6-27b',
    'groq/compound-mini',
    'groq/compound'
  ];
  for (const m of models) {
    await testModel(m);
  }
}

run();
