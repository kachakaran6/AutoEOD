import OpenAI from 'openai';

async function test() {
  const openai = new OpenAI({

  });

  try {
    const res = await openai.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: 'Say hello in JSON { "hello": "world" }' }],
      response_format: { type: 'json_object' }
    });
    console.log("Success:", res.choices[0].message.content);
  } catch (err: any) {
    console.error("Error:", err.message);
  }
}

test();
