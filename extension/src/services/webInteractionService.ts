import { OpenAI } from 'openai';
import { URL } from 'url';
import { scrapeAndScreenshot } from './scrapeService.js';
import axios from 'axios';
import { ExtensionContext } from 'vscode';
import { ScrapeResult } from './scrapeService.js';
import * as cheerio from 'cheerio';

async function performWebAction(
  context: ExtensionContext,
  url: string,
  query: string
): Promise<ScrapeResult> {
  const apiKey = await context.secrets.get('OPENAI_API_KEY');
  const client = new OpenAI({
    apiKey: apiKey,
  });

  try {
    // Fetch the HTML content of the page
    const response = await axios.get(url);
    const html = response.data;

    // Use GPT-4 to find the relevant link
    const linkUrl = await findLinkWithGPT(html, query, client, url);

    if (!linkUrl) {
      throw new Error('No relevant link found');
    }

    // Construct the full URL if it's a relative link
    const fullUrl = new URL(linkUrl, url).href;

    // Use scrapeAndScreenshot to get the screenshot
    const screenshot = await scrapeAndScreenshot([{ id: 1, link: fullUrl, title: '', text: '' }]);

    return {
      link: fullUrl,
      screenshot: screenshot[0].screenshot,
    };
  } catch (error) {
    console.error('Error during web interaction:', error);
    throw error;
  }
}

async function findLinkWithGPT(html: string, query: string, client: OpenAI, baseUrl: string): Promise<string> {
  const $ = cheerio.load(html);
  const clickableElements = extractClickableElements($);

  const prompt = `Given the following clickable HTML elements and user query, find the most relevant link (href attribute) that matches the query. Only return the href value, nothing else. This can be a full URL or a relative URL.

  Clickable Elements:
  ${JSON.stringify(clickableElements, null, 2)}


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
  let url = response.choices[0].message.content?.trim() || '';
  url = url.replace(/^["']|["']$/g, ''); // Remove leading and trailing quotes
  url = url.replace(/\\"/g, ''); // Remove escaped quotes

  try {
    url = new URL(url, baseUrl).href;
  } catch (_) {
    throw new Error('GPT did not return a valid URL');
  }
  return url;
}

function parseAction(actionString: string): string {
  // This function is no longer needed, but kept for backwards compatibility
  return actionString;
}

function extractClickableElements($: cheerio.CheerioAPI): Array<{ tag: string, text: string, href?: string }> {
  const elements: Array<{ tag: string, text: string, href?: string }> = [];

  $('a, button, [role="button"], [type="submit"]').each((_, element) => {
    const $el = $(element);
    const tag = element.tagName.toLowerCase();
    const text = $el.text().trim();
    const href = $el.attr('href');

    elements.push({ tag, text, ...(href && { href }) });
  });

  return elements;
}

export { performWebAction };
