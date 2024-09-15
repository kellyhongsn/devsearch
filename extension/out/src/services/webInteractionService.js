"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.performWebAction = performWebAction;
const openai_1 = require("openai");
const url_1 = require("url");
const scrapeService_js_1 = require("./scrapeService.js");
const axios_1 = __importDefault(require("axios"));
const cheerio = __importStar(require("cheerio"));
async function performWebAction(context, screenshots, queries) {
    const apiKey = await context.secrets.get('OPENAI_API_KEY');
    const client = new openai_1.OpenAI({
        apiKey: apiKey,
    });
    try {
        // Extract clickable elements from all screenshots
        const allClickableElements = await extractAllClickableElements(screenshots);
        // Find relevant links for all queries concurrently
        const relevantLinksPromises = queries.map(query => findLinkWithGPT(allClickableElements, query, client));
        const relevantLinks = await Promise.all(relevantLinksPromises);
        // Filter out any null results
        const validLinks = relevantLinks.filter((link) => link !== null);
        // Scrape and screenshot the relevant links
        const newScreenshots = await (0, scrapeService_js_1.scrapeAndScreenshot)(validLinks.map((link, index) => ({ id: index + 1, link, title: '', text: '' })));
        return newScreenshots;
    }
    catch (error) {
        console.error('Error during web interaction:', error);
        throw error;
    }
}
async function extractAllClickableElements(screenshots) {
    const allElements = [];
    for (const screenshot of screenshots) {
        try {
            const response = await axios_1.default.get(screenshot.link);
            const html = response.data;
            const $ = cheerio.load(html);
            const elements = extractClickableElements($, screenshot.link);
            allElements.push(...elements);
        }
        catch (error) {
            console.error(`Error fetching HTML for ${screenshot.link}:`, error);
        }
    }
    return allElements;
}
function truncateText(text, maxLength = 50) {
    return text.length > maxLength ? text.slice(0, maxLength) + '...' : text;
}
function removeDuplicates(elements) {
    const seen = new Set();
    return elements.filter(el => {
        const key = `${el.tag}|${el.text}|${el.href}`;
        if (seen.has(key))
            return false;
        seen.add(key);
        return true;
    });
}
async function findLinkWithGPT(elements, query, client) {
    const simplifiedElements = elements
        .map(({ tag, text, href, baseUrl }) => ({ tag, text: truncateText(text), href, baseUrl }))
        .filter(el => el.text.trim() !== '' && (el.href === undefined || el.href.trim() !== ''));
    const deduplicatedElements = removeDuplicates(simplifiedElements);
    const prompt = `Given the following clickable HTML elements and user query, find the most relevant link (href attribute) that matches the query. Only return the href value, nothing else. This can be a full URL or a relative URL.

Clickable Elements:
${JSON.stringify(deduplicatedElements.map(({ tag, text, href }) => ({ tag, text, href })), null, 2)}


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
        return new url_1.URL(url, elements[0].baseUrl).href;
    }
    catch (_) {
        console.error(`Invalid URL for query "${query}": ${url}`);
        return null;
    }
}
function parseAction(actionString) {
    // This function is no longer needed, but kept for backwards compatibility
    return actionString;
}
function extractClickableElements($, baseUrl) {
    const elements = [];
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
//# sourceMappingURL=webInteractionService.js.map