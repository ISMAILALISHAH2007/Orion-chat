import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const nvidia = createOpenAI({
  apiKey: process.env.NVIDIA_API_KEY,
  baseURL: 'https://integrate.api.nvidia.com/v1',
});

async function testSDK(modelId) {
  console.log(`Testing SDK with model: ${modelId}`);
  try {
    const { text } = await generateText({
      model: nvidia.chat(modelId),
      prompt: 'Say hi',
    });
    console.log(`✅ SDK SUCCESS (${modelId}):`, text);
  } catch (e) {
    console.error(`❌ SDK FAILED (${modelId}):`, e.message);
  }
}

async function run() {
  await testSDK('nvidia/llama-3.1-nemotron-ultra-253b-v1');
  await testSDK('meta/llama-3.1-70b-instruct');
  await testSDK('meta/llama-3.1-8b-instruct');
}

run();
