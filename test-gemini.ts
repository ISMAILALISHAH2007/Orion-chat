import { streamText } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function run() {
  const google = createGoogleGenerativeAI({
    apiKey: process.env.GEMINI_API_KEY,
  });

  console.log('Testing gemini-2.5-flash...');
  try {
    const result = await streamText({
      model: google('gemini-2.5-flash'),
      prompt: 'Say hi',
    });

    let out = '';
    for await (const delta of result.textStream) {
      out += delta;
    }
    console.log('✅ SUCCESS:', out);
  } catch (e: any) {
    console.error('❌ FAILED:', e);
  }
}

run();
