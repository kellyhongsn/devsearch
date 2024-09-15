"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.performWebAction = performWebAction;
const openai_1 = require("openai");
const scrapeService_js_1 = require("./scrapeService.js");
const axios_1 = __importDefault(require("axios"));
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
        const linkUrl = await findLinkWithGPT(html, query, client);
        if (!linkUrl) {
            throw new Error('No relevant link found');
        }
        // Construct the full URL if it's a relative link
        const fullUrl = new URL(linkUrl, url).href;
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
async function findLinkWithGPT(html, query, client) {
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
    let url = response.choices[0].message.content?.trim() || '';
    url = url.replace(/^["']|["']$/g, ''); // Remove leading and trailing quotes
    url = url.replace(/\\"/g, ''); // Remove escaped quotes
    return url;
}
function parseAction(actionString) {
    // This function is no longer needed, but kept for backwards compatibility
    return actionString;
}
//# sourceMappingURL=webInteractionService.js.map