import { generateText } from 'ai';
import { config } from 'dotenv';
import path from 'path';

// Load .env.local
config({ path: path.resolve(process.cwd(), '.env.local') });

import { getDefaultModelForMode, getHiddenFallbackModel } from '../app/lib/ai/provider';

const modes = ['casual', 'developer', 'research', 'professional'];

async function testMode(mode: string) {
  console.log(`\n============================`);
  console.log(`Testing Mode: [${mode.toUpperCase()}]`);
  console.log(`============================`);
  
  // Test Primary Model
  try {
    const primaryModel = getDefaultModelForMode(mode);
    console.log(`- Primary Model ID: ${primaryModel.modelId}`);
    
    const start = Date.now();
    const result = await generateText({
      model: primaryModel,
      prompt: 'Respond with exactly one word: "Success".'
    });
    console.log(`✅ Primary Success in ${Date.now() - start}ms! Response: "${result.text.trim()}"`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`❌ Primary Failed: ${msg}`);
  }

  // Test Fallback Model
  try {
    const fallbackModel = getHiddenFallbackModel(mode);
    console.log(`\n- Fallback Model ID: ${fallbackModel.modelId}`);
    
    const start = Date.now();
    const result = await generateText({
      model: fallbackModel,
      prompt: 'Respond with exactly one word: "Success".'
    });
    console.log(`✅ Fallback Success in ${Date.now() - start}ms! Response: "${result.text.trim()}"`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`❌ Fallback Failed: ${msg}`);
  }
}

async function run() {
  for (const mode of modes) {
    await testMode(mode);
  }
  console.log(`\n============================`);
  console.log('All tests completed.');
}

run();
