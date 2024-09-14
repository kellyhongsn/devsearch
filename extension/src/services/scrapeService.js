import puppeteer from 'puppeteer';

/**
 * @typedef {Object} SearchQueryResult
 * @property {number} id
 * @property {string} title
 * @property {string} link
 * @property {string} text
 */

/**
 * @param {SearchQueryResult[]} searchResults
 * @returns {Promise<Array<{id: number, link: string, screenshot: string}>>}
 */

//takes in searchResults array, gets the links, and takes screenshot of entire page

export async function scrapeAndScreenshot(searchResults) {
  const browser = await puppeteer.launch();
  const results = [];

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
    } catch (error) {
      console.error(`Error processing ${result.link}:`, error);
      results.push({
        id: result.id,
        link: result.link,
        error: error.message,
      });
    } finally {
      await page.close();
    }
  }

  await browser.close();
  return results;
}
