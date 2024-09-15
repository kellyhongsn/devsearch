import { expect } from 'chai';
import * as sinon from 'sinon';
import { scrapeAndScreenshot, ScrapeResult } from '../src/services/scrapeService';
import puppeteer from 'puppeteer';

const puppeteerStub = sinon.stub(puppeteer, 'launch');

describe('scrapeService', () => {
  let mockBrowser: any;
  let mockPage: any;

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

    const results = await scrapeAndScreenshot(searchResults);

    expect(results).to.have.lengthOf(1);
    expect(results[0]).to.deep.equal({
      id: 1,
      link: 'https://example.com',
      screenshot: 'base64screenshot',
    });
    expect(mockPage.setViewport.called).to.be.true;
    expect(mockPage.goto.calledWith('https://example.com', sinon.match.any)).to.be.true;
    expect(mockPage.screenshot.called).to.be.true;
    expect(mockBrowser.close.called).to.be.true;
  });

  it('should handle errors during scraping', async () => {
    mockPage.goto.rejects(new Error('Failed to load'));

    const searchResults = [
      { id: 1, title: 'Test', link: 'https://example.com', text: 'Test text' },
    ];

    const results = await scrapeAndScreenshot(searchResults);

    expect(results).to.have.lengthOf(1);
    expect(results[0]).to.deep.equal({
      id: 1,
      link: 'https://example.com',
      error: 'Failed to load',
    });
    expect(mockPage.close.called).to.be.true;
    expect(mockBrowser.close.called).to.be.true;
  });
});

after(() => {
    puppeteerStub.restore();
});