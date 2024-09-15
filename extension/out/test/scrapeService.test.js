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
const chai_1 = require("chai");
const sinon = __importStar(require("sinon"));
const scrapeService_1 = require("../src/services/scrapeService");
const puppeteer_1 = __importDefault(require("puppeteer"));
const puppeteerStub = sinon.stub(puppeteer_1.default, 'launch');
describe('scrapeService', () => {
    let mockBrowser;
    let mockPage;
    beforeEach(() => {
        mockPage = {
            setViewport: sinon.stub(),
            goto: sinon.stub(),
            screenshot: sinon.stub().resolves('base64screenshot'),
            close: sinon.stub(),
        };
        mockBrowser = {
            newPage: sinon.stub().resolves(mockPage),
            close: sinon.stub(),
        };
        puppeteerStub.resolves(mockBrowser);
    });
    it('should scrape and screenshot pages', async () => {
        const searchResults = [
            { id: 1, title: 'Test', link: 'https://example.com', text: 'Test text' },
        ];
        const results = await (0, scrapeService_1.scrapeAndScreenshot)(searchResults);
        (0, chai_1.expect)(results).to.have.lengthOf(1);
        (0, chai_1.expect)(results[0]).to.deep.equal({
            id: 1,
            link: 'https://example.com',
            screenshot: 'base64screenshot',
        });
        (0, chai_1.expect)(mockPage.setViewport.called).to.be.true;
        (0, chai_1.expect)(mockPage.goto.calledWith('https://example.com', sinon.match.any)).to.be.true;
        (0, chai_1.expect)(mockPage.screenshot.called).to.be.true;
        (0, chai_1.expect)(mockBrowser.close.called).to.be.true;
    });
    it('should handle errors during scraping', async () => {
        mockPage.goto.rejects(new Error('Failed to load'));
        const searchResults = [
            { id: 1, title: 'Test', link: 'https://example.com', text: 'Test text' },
        ];
        const results = await (0, scrapeService_1.scrapeAndScreenshot)(searchResults);
        (0, chai_1.expect)(results).to.have.lengthOf(1);
        (0, chai_1.expect)(results[0]).to.deep.equal({
            id: 1,
            link: 'https://example.com',
            error: 'Failed to load',
        });
        (0, chai_1.expect)(mockPage.close.called).to.be.true;
        (0, chai_1.expect)(mockBrowser.close.called).to.be.true;
    });
});
after(() => {
    puppeteerStub.restore();
});
//# sourceMappingURL=scrapeService.test.js.map