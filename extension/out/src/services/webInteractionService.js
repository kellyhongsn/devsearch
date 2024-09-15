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
async function performWebAction(context, url, query) {
    const apiKey = await context.secrets.get('OPENAI_API_KEY');
    const client = new openai_1.OpenAI({
        apiKey: apiKey,
    });
    try {
        // Fetch the HTML content of the page
        const response = await axios_1.default.get(url);
        const html = response.data;
        // Use GPT-4 to find the relevant link
        const linkUrl = await findLinkWithGPT(html, query, client, url);
        if (!linkUrl) {
            throw new Error('No relevant link found');
        }
        // Construct the full URL if it's a relative link
        const fullUrl = new url_1.URL(linkUrl, url).href;
        // Use scrapeAndScreenshot to get the screenshot
        const screenshot = await (0, scrapeService_js_1.scrapeAndScreenshot)([{ id: 1, link: fullUrl, title: '', text: '' }]);
        return {
            link: fullUrl,
            screenshot: screenshot[0].screenshot,
        };
    }
    catch (error) {
        console.error('Error during web interaction:', error);
        throw error;
    }
}
async function findLinkWithGPT(html, query, client, baseUrl) {
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
        url = new url_1.URL(url, baseUrl).href;
    }
    catch (_) {
        throw new Error('GPT did not return a valid URL');
    }
    return url;
}
function parseAction(actionString) {
    // This function is no longer needed, but kept for backwards compatibility
    return actionString;
}
function extractClickableElements($) {
    const elements = [];
    $('a, button, [role="button"], [type="submit"]').each((_, element) => {
        const $el = $(element);
        const tag = element.tagName.toLowerCase();
        const text = $el.text().trim();
        const href = $el.attr('href');
        elements.push({ tag, text, ...(href && { href }) });
    });
    return elements;
}
//# sourceMappingURL=webInteractionService.js.map