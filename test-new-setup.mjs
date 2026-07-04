
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function testNvidia() {
  console.log('Testing NVIDIA Direct API...');
  try {
    const res = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.NVIDIA_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'meta/llama-3.1-8b-instruct',
        messages: [{ role: 'user', content: 'Say "NVIDIA Works"' }],
        max_tokens: 20
      })
    });
    const data = await res.json();
    if (data.choices && data.choices.length > 0) {
      console.log('✅ NVIDIA SUCCESS:', data.choices[0].message.content);
    } else {
      console.error('❌ NVIDIA FAILED:', JSON.stringify(data));
    }
  } catch (err) {
    console.error('❌ NVIDIA EXCEPTION:', err.message);
  }
}

async function testGemini() {
  console.log('\nTesting GEMINI API...');
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'Say "GEMINI Works"' }] }]
      })
    });
    const data = await res.json();
    if (data.candidates && data.candidates.length > 0) {
      console.log('✅ GEMINI SUCCESS:', data.candidates[0].content.parts[0].text);
    } else {
      console.error('❌ GEMINI FAILED:', JSON.stringify(data));
    }
  } catch (err) {
    console.error('❌ GEMINI EXCEPTION:', err.message);
  }
}

async function run() {
  await testNvidia();
  await testGemini();
}

run();
