"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.scrapeAndScreenshot = scrapeAndScreenshot;
const puppeteer_1 = __importDefault(require("puppeteer"));
//takes in searchResults array, gets the links, and takes screenshot of entire page
async function scrapeAndScreenshot(searchResults) {
    const browser = await puppeteer_1.default.launch({
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
            }
            catch (error) {
                console.error(`Error processing ${result.link}:`, error);
                return null;
            }
            finally {
                await page.close();
            }
        });
        const results = (await Promise.all(scrapePromises)).filter(result => result !== null);
        return results;
    }
    finally {
        await browser.close();
    }
}
//# sourceMappingURL=scrapeService.js.map