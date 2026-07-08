const { createGoogleGenerativeAI } = require('@ai-sdk/google');
const { generateText } = require('ai');
require('dotenv').config({ path: '.env.local' });

async function main() {
  try {
    const google = createGoogleGenerativeAI({
      apiKey: process.env.GEMINI_API_KEY,
    });
    
    console.log("Calling Gemini 2.5 Flash...");
    const result = await generateText({
      model: google('gemini-2.5-flash'),
      prompt: "Tell me a joke",
    });
    console.log("Success! Response:");
    console.log(result.text);
  } catch (error) {
    console.error("Error occurred:");
    console.error(error);
  }
}
main();
