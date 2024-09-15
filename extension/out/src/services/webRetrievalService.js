"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCombinedSearchResults = getCombinedSearchResults;
exports.getExaResults = getExaResults;
exports.getGoogleResults = getGoogleResults;
const axios_1 = __importDefault(require("axios"));
const exa_js_1 = __importDefault(require("exa-js"));
async function getGoogleResults(query, serperApiKey) {
    const config = {
        method: 'post',
        url: 'https://google.serper.dev/search',
        headers: {
            'X-API-KEY': serperApiKey,
            'Content-Type': 'application/json',
        },
        data: JSON.stringify({ q: query }),
    };
    try {
        const response = await (0, axios_1.default)(config);
        return response.data.organic.map((result, index) => ({
            id: index,
            title: result.title,
            link: result.link,
            text: result.snippet,
        }));
    }
    catch (error) {
        console.error('Error fetching Google results:', error);
        return [];
    }
}
async function getExaResults(query, exaApiKey) {
    const exa = new exa_js_1.default(exaApiKey);
    try {
        const result = await exa.searchAndContents(query, {
            type: 'auto',
            numResults: 10,
            text: true,
            category: 'github',
        });
        return result.results.map((result, index) => ({
            id: index + 1000, // To differentiate from Google results
            title: result.title,
            link: result.url,
            text: result.text,
        }));
    }
    catch (error) {
        console.error('Error fetching Exa results:', error);
        return [];
    }
}
async function getCombinedSearchResults(context, query) {
    const serperApiKey = await context.secrets.get('SERPER_API_KEY');
    const exaApiKey = await context.secrets.get('EXA_API_KEY');
    if (!serperApiKey || !exaApiKey) {
        throw new Error('SERPER_API_KEY and EXA_API_KEY must be set in environment variables');
    }
    try {
        const [googleResults, exaResults] = await Promise.all([
            getGoogleResults(query, serperApiKey),
            getExaResults(query, exaApiKey),
        ]);
        return [...googleResults, ...exaResults];
    }
    catch (error) {
        console.error('Error in combined search:', error);
        throw error;
    }
}
//# sourceMappingURL=webRetrievalService.js.map