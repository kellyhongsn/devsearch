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
  const browser = await puppeteer.launch();
  const results: ScrapeResult[] = [];

  for (const result of searchResults) {
    const page = await browser.newPage();
    try {
      // Set only the viewport width
      await page.setViewport({
        width: 1920, // Set to a common large screen width
        height: 1080, // This height will be ignored for fullPage screenshots
        deviceScaleFactor: 1,
      });

      await page.goto(result.link, {
        waitUntil: 'networkidle0',
        timeout: 30000,
      });

      const screenshotBuffer = await page.screenshot({
        fullPage: true,
        encoding: 'base64',
      });

      results.push({
        id: result.id,
        link: result.link,
        screenshot: screenshotBuffer,
      });
    } catch (error: any) {
      console.error(`Error processing ${result.link}:`, error);
      results.push({
        id: result.id,
        link: result.link,
        error: error.message,
      } as ScrapeResult);
    } finally {
      await page.close();
    }
  }

  await browser.close();
  return results as ScrapeResult[];
}

export { scrapeAndScreenshot, ScrapeResult };
