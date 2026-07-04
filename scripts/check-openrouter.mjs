import https from 'https';

https.get('https://openrouter.ai/api/v1/models', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const models = JSON.parse(data).data;
    
    // Filter for free models
    const freeModels = models.filter(m => 
      m.pricing && 
      m.pricing.prompt === '0' && 
      m.pricing.completion === '0'
    );
    
    // Sort by context length descending
    freeModels.sort((a, b) => b.context_length - a.context_length);
    
    console.log('Top Free OpenRouter Models by Context Length:');
    freeModels.slice(0, 10).forEach(m => {
      console.log(`- ${m.id}`);
      console.log(`  Context Length: ${m.context_length} tokens`);
      console.log(`  Provider: ${m.architecture?.provider || 'Unknown'}`);
      console.log('');
    });
  });
}).on('error', err => {
  console.error('Error fetching models:', err.message);
});
