import { OpenAI } from 'openai';
import { scrapeAndScreenshot } from './scrapeService.js';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function performWebAction(url, query) {
  try {
    // Fetch the HTML content of the page
    const response = await axios.get(url);
    const html = response.data;

    // Use GPT-4 to find the relevant link
    const linkUrl = await findLinkWithGPT(html, query);

    if (!linkUrl) {
      throw new Error('No relevant link found');
    }

    // Construct the full URL if it's a relative link
    const fullUrl = new URL(linkUrl, url).href;

    // Use scrapeAndScreenshot to get the screenshot
    const screenshot = await scrapeAndScreenshot([{ id: 1, link: fullUrl }]);

    return {
      newUrl: fullUrl,
      screenshot: screenshot[0].screenshot,
    };
  } catch (error) {
    console.error('Error during web interaction:', error);
    throw error;
  }
}

async function findLinkWithGPT(html, query) {
  const prompt = `Given the following HTML and user query, find the most relevant link (href attribute) that matches the query. Only return the href value, nothing else.

  HTML:
  ${html}

  User Query: ${query}

  Relevant href:`;

  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 100,
    temperature: 0,
  });

  console.log(response.choices[0]);

  // Clean up the URL
  let url = response.choices[0].message.content.trim();
  url = url.replace(/^["']|["']$/g, ''); // Remove leading and trailing quotes
  url = url.replace(/\\"/g, ''); // Remove escaped quotes

  return url;
}

export function parseAction(actionString) {
  // This function is no longer needed, but kept for backwards compatibility
  return actionString;
}
