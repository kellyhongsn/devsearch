import axios from 'axios';
import Exa from 'exa-js';
import { ExtensionContext } from 'vscode';

interface SearchResult {
  id: number;
  title: string;
  link: string;
  text: string;
}

async function getGoogleResults(query: string, serperApiKey: string): Promise<SearchResult[]> {
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
    const response = await axios(config);
    return response.data.organic.map((result: any, index: number) => ({
      id: index,
      title: result.title,
      link: result.link,
      text: result.snippet,
    }));
  } catch (error) {
    console.error('Error fetching Google results:', error);
    return [];
  }
}

async function getExaResults(query: string, exaApiKey: string): Promise<SearchResult[]> {
  const exa = new Exa(exaApiKey);
  try {
    const result = await exa.searchAndContents(query, {
      type: 'auto',
      numResults: 10,
      text: true,
      category: 'github',
    });
    return result.results.map((result: any, index: number) => ({
      id: index + 1000, // To differentiate from Google results
      title: result.title,
      link: result.url,
      text: result.text,
    }));
  } catch (error) {
    console.error('Error fetching Exa results:', error);
    return [];
  }
}

async function getCombinedSearchResults(
  context: ExtensionContext,
  query: string
): Promise<SearchResult[]> {
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
  } catch (error) {
    console.error('Error in combined search:', error);
    throw error;
  }
}

export { getCombinedSearchResults, getExaResults, getGoogleResults };
