import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read .env.local to get OPENROUTER_API_KEY
const envFile = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf-8');
const keyMatch = envFile.match(/OPENROUTER_API_KEY=(.+)/);
if (!keyMatch) {
  console.error("No OPENROUTER_API_KEY found in .env.local");
  process.exit(1);
}
const KEY = keyMatch[1].trim().replace(/^"|"$/g, '');

const modelsToTest = [
  'meta-llama/llama-3.3-70b-instruct:free',
  'meta-llama/llama-3.1-8b-instruct:free',
  'qwen/qwen-2.5-72b-instruct:free',
  'google/gemini-2.0-flash-exp:free',
  'mistralai/mistral-7b-instruct:free',
  'openrouter/free' // default openrouter free
];

async function testModel(model) {
  try {
    const start = Date.now();
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: model,
        messages: [{ role: 'user', content: 'Say "hello"' }],
        max_tokens: 10
      })
    });
    const data = await res.json();
    const time = Date.now() - start;
    if (res.ok && data.choices && data.choices.length > 0) {
      console.log(`✅ [${model}] SUCCESS in ${time}ms: ${data.choices[0].message.content}`);
      return true;
    } else {
      console.log(`❌ [${model}] FAILED in ${time}ms: ${JSON.stringify(data)}`);
      return false;
    }
  } catch (err) {
    console.log(`❌ [${model}] ERROR: ${err.message}`);
    return false;
  }
}

async function run() {
  console.log('Fetching available free models...');
  const res = await fetch('https://openrouter.ai/api/v1/models', { headers: { Authorization: `Bearer ${KEY}` }});
  const data = await res.json();
  if (!data.data) { console.log('Failed to fetch models', data); return; }
  const freeModels = data.data.map(m => m.id).filter(id => id.includes(':free') || id === 'openrouter/free');
  console.log(`Found ${freeModels.length} free models. Testing top 10...`);
  
  for (const model of freeModels.slice(0, 10)) {
    await testModel(model);
  }
}

run();
