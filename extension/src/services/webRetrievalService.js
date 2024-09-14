import 'dotenv/config';
import dotenv from 'dotenv';
import axios from 'axios';
import Exa from 'exa-js';

dotenv.config();

const SERPER_API_KEY = process.env.SERPER_API_KEY;
const EXA_API_KEY = process.env.EXA_API_KEY;

if (!SERPER_API_KEY || !EXA_API_KEY) {
  throw new Error('SERPER_API_KEY and EXA_API_KEY must be set in environment variables');
}

const exa = new Exa(EXA_API_KEY);

export async function getGoogleResults(query) {
  const config = {
    method: 'post',
    url: 'https://google.serper.dev/search',
    headers: {
      'X-API-KEY': SERPER_API_KEY,
      'Content-Type': 'application/json',
    },
    data: JSON.stringify({ q: query }),
  };

  try {
    const response = await axios(config);
    return response.data.organic.map((result, index) => ({
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

export async function getExaResults(query) {
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
  } catch (error) {
    console.error('Error fetching Exa results:', error);
    return [];
  }
}

export async function getCombinedSearchResults(query) {
  try {
    const [googleResults, exaResults] = await Promise.all([
      getGoogleResults(query),
      getExaResults(query),
    ]);

    return [...googleResults, ...exaResults];
  } catch (error) {
    console.error('Error in combined search:', error);
    throw error;
  }
}
