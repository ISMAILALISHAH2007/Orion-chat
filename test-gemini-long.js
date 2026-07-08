const { createGoogleGenerativeAI } = require('@ai-sdk/google');
const { generateText } = require('ai');
require('dotenv').config({ path: '.env.local' });

async function main() {
  try {
    const google = createGoogleGenerativeAI({
      apiKey: process.env.GEMINI_API_KEY,
    });
    
    console.log("Calling Gemini 2.5 Flash with a longer prompt...");
    const result = await generateText({
      model: google('gemini-2.5-flash'),
      prompt: "Explain the history of the universe in 500 words and then give me a detailed breakdown of quantum mechanics.",
    });
    console.log("Success! Response length:", result.text.length);
  } catch (error) {
    console.error("Error occurred:");
    console.error(error);
  }
}
main();
