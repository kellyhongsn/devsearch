import { OpenAI } from 'openai';
import { URL } from 'url';
import { scrapeAndScreenshot } from './scrapeService.js';
import axios from 'axios';
import { ExtensionContext } from 'vscode';
import { ScrapeResult } from './scrapeService.js';
import * as cheerio from 'cheerio';

interface ClickableElement {
  tag: string;
  text: string;
  href?: string;
  baseUrl: string;
}

async function performWebAction(
  context: ExtensionContext,
  screenshots: ScrapeResult[],
  queries: string[]
): Promise<ScrapeResult[]> {
  const apiKey = await context.secrets.get('OPENAI_API_KEY');
  const client = new OpenAI({
    apiKey: apiKey,
  });

  try {
    // Extract clickable elements from all screenshots
    const allClickableElements = await extractAllClickableElements(screenshots);

    // Find relevant links for all queries concurrently
    const relevantLinksPromises = queries.map(query => 
      findLinkWithGPT(allClickableElements, query, client)
    );
    const relevantLinks = await Promise.all(relevantLinksPromises);

    // Filter out any null results
    const validLinks = relevantLinks.filter((link): link is string => link !== null);

    // Scrape and screenshot the relevant links
    const newScreenshots = await scrapeAndScreenshot(
      validLinks.map((link, index) => ({ id: index + 1, link, title: '', text: '' }))
    );

    return newScreenshots;
  } catch (error) {
    console.error('Error during web interaction:', error);
    throw error;
  }
}

async function extractAllClickableElements(screenshots: ScrapeResult[]): Promise<ClickableElement[]> {
  const allElements: ClickableElement[] = [];

  for (const screenshot of screenshots) {
    try {
      const response = await axios.get(screenshot.link);
      const html = response.data;
      const $ = cheerio.load(html);
      const elements = extractClickableElements($, screenshot.link);
      allElements.push(...elements);
    } catch (error) {
      console.error(`Error fetching HTML for ${screenshot.link}:`, error);
    }
  }

  return allElements;
}

function truncateText(text: string, maxLength: number = 50): string {
  return text.length > maxLength ? text.slice(0, maxLength) + '...' : text;
}

function removeDuplicates(elements: ClickableElement[]): ClickableElement[] {
  const seen = new Set();
  return elements.filter(el => {
    const key = `${el.tag}|${el.text}|${el.href}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function findLinkWithGPT(
  elements: ClickableElement[],
  query: string,
  client: OpenAI
): Promise<string | null> {
  const simplifiedElements = elements
    .map(({ tag, text, href, baseUrl }) => ({ tag, text: truncateText(text), href, baseUrl }))
    .filter(el => el.text.trim() !== '' && (el.href === undefined || el.href.trim() !== ''));

  const deduplicatedElements = removeDuplicates(simplifiedElements);
  
  const prompt = `Given the following clickable HTML elements and user query, find the most relevant link (href attribute) that matches the query. Only return the href value, nothing else. This can be a full URL or a relative URL.

Clickable Elements:
${JSON.stringify(deduplicatedElements.map(({tag, text, href}) => ({tag, text, href})), null, 2)}


User Query: ${query}

Relevant URL:`;

  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 100,
    temperature: .2,
  });


  // Clean up the URL
  let url = response.choices[0].message.content?.trim() || '';
  url = url.replace(/^["']|["']$/g, ''); // Remove leading and trailing quotes
  url = url.replace(/\\"/g, ''); // Remove escaped quotes

  // Validate and resolve URLs
  try {
    return new URL(url, elements[0].baseUrl).href;
  } catch (_) {
    console.error(`Invalid URL for query "${query}": ${url}`);
    return null;
  }
}

function parseAction(actionString: string): string {
  // This function is no longer needed, but kept for backwards compatibility
  return actionString;
}

function extractClickableElements($: cheerio.CheerioAPI, baseUrl: string): ClickableElement[] {
  const elements: ClickableElement[] = [];

  $('a, button, [role="button"], [type="submit"]').each((_, element) => {
    const $el = $(element);
    const tag = element.tagName.toLowerCase();
    const text = $el.text().trim();
    const href = $el.attr('href');

    elements.push({ tag, text, ...(href && { href }), baseUrl });
  });
  console.log(`Extracted elements: ${JSON.stringify(elements, null, 2)}`);
  return elements;
}

export { performWebAction };
