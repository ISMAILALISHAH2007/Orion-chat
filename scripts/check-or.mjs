// One-time diagnostic: probes a list of candidate model providers to find one
// that accepts the key in OPENROUTER_API_KEY. The key is read from the
// environment — never hardcode it here.
//
// Usage: OPENROUTER_API_KEY=... node scripts/check-or.mjs
// (Or run via: npm run check:openrouter)

import process from 'node:process';

const KEY = process.env.OPENROUTER_API_KEY;
if (!KEY) {
  console.error('Set OPENROUTER_API_KEY in the environment first.');
  process.exit(2);
}

const endpoints = [
  'https://openrouter.ai/api/v1/models',
];

async function test() {
  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${KEY}` },
      });
      if (res.ok) {
        const data = await res.json();
        console.log(`Success on ${url}`);
        const models = data.data.map((m) => m.id);
        console.log(`Found ${models.length} models.`);
        console.log('First 10 models:', models.slice(0, 10));
        return;
      }
    } catch (e) {}
  }
  console.log('Could not find a matching API endpoint.');
}
test();