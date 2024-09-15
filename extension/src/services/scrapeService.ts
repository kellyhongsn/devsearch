import puppeteer from 'puppeteer';

interface SearchQueryResult {
  id: number;
  title: string;
  link: string;
  text: string;
}

interface ScrapeResult {
  id?: number;
  link: string;
  screenshot: string;
  error?: string;
}

//takes in searchResults array, gets the links, and takes screenshot of entire page
async function scrapeAndScreenshot(searchResults: SearchQueryResult[]): Promise<ScrapeResult[]> {
  const browser = await puppeteer.launch({
    headless: true, 
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const scrapePromises = searchResults.map(async (result) => {
      console.log(`Processing URL: ${result.link}`);
      const page = await browser.newPage();
      try {
        await page.setViewport({
          width: 1920,
          height: 1080,
          deviceScaleFactor: 1,
        });

        await page.goto(result.link, {
          waitUntil: 'networkidle0',
          timeout: 50000,
        });

        const screenshotBuffer = await page.screenshot({
          fullPage: true,
          encoding: 'base64',
        });

        return {
          id: result.id,
          link: result.link,
          screenshot: screenshotBuffer,
        };
      } catch (error: any) {
        console.error(`Error processing ${result.link}:`, error);
        return null;
      } finally {
        await page.close();
      }
    });

    const results: ScrapeResult[] = (await Promise.all(scrapePromises)).filter(result => result !== null) as ScrapeResult[];
    return results;
  } finally {
    await browser.close();
  }
}

export { scrapeAndScreenshot, ScrapeResult };
