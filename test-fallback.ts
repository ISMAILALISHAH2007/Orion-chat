import { streamText, fallback } from 'ai';
import { getDefaultModelForMode, getHiddenFallbackModel } from './app/lib/ai/provider';

async function run() {
  console.log('Testing native fallback...');
  try {
    const badModel = getDefaultModelForMode('professional'); // 404
    const goodModel = getHiddenFallbackModel('professional'); // 70b

    const result = await streamText({
      model: fallback([badModel, goodModel]),
      prompt: 'Say hi',
    });

    let out = '';
    for await (const delta of result.textStream) {
      out += delta;
    }
    console.log('✅ SUCCESS:', out);
  } catch (e: any) {
    console.error('❌ FAILED:', e.message);
  }
}

run();
