"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.scrapeAndScreenshot = scrapeAndScreenshot;
const puppeteer_1 = __importDefault(require("puppeteer"));
//takes in searchResults array, gets the links, and takes screenshot of entire page
async function scrapeAndScreenshot(searchResults) {
    const browser = await puppeteer_1.default.launch();
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
        }
        catch (error) {
            console.error(`Error processing ${result.link}:`, error);
            results.push({
                id: result.id,
                link: result.link,
                error: error.message,
            });
        }
        finally {
            await page.close();
        }
    }
    await browser.close();
    return results;
}
//# sourceMappingURL=scrapeService.js.map