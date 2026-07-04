import { streamText } from 'ai';
import { getDefaultModelForMode, getHiddenFallbackModel } from './app/lib/ai/provider';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function run() {
  const modes = ['casual', 'developer', 'research', 'professional'];
  for (const mode of modes) {
    console.log(`\nTesting ${mode}...`);
    try {
      const result = await streamText({
        model: getDefaultModelForMode(mode),
        prompt: 'Say hi',
      });
      let out = '';
      for await (const delta of result.textStream) {
        out += delta;
      }
      console.log(`✅ ${mode} SUCCESS:`, out);
    } catch (e) {
      console.error(`❌ ${mode} FAILED:`, e.message);
      try {
        console.log(`Trying fallback for ${mode}...`);
        const fallback = await streamText({
          model: getHiddenFallbackModel(mode),
          prompt: 'Say hi',
        });
        let out = '';
        for await (const delta of fallback.textStream) {
          out += delta;
        }
        console.log(`✅ FALLBACK SUCCESS:`, out);
      } catch (e2) {
        console.error(`❌ FALLBACK FAILED:`, e2.message);
      }
    }
  }
}

run();
