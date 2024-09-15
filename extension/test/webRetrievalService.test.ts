import { expect } from 'chai';
import * as sinon from 'sinon';
import { getCombinedSearchResults, getGoogleResults, getExaResults } from '../src/services/webRetrievalService';
import axios from 'axios';
import Exa from 'exa-js';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
chai.use(chaiAsPromised);

describe('webRetrievalService', () => {
  let mockContext: any;
  let axiosStub: sinon.SinonStub;
  let exaStub: sinon.SinonStub;

  beforeEach(() => {
    mockContext = {
      secrets: {
        get: sinon.stub().callsFake((key) => {
          if (key === 'SERPER_API_KEY') return Promise.resolve('mock-serper-key');
          if (key === 'EXA_API_KEY') return Promise.resolve('mock-exa-key');
          return Promise.resolve(null);
        }),
      },
    };

    axiosStub = sinon.stub(axios, 'post');
    exaStub = sinon.stub(Exa.prototype, 'searchAndContents');
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('getGoogleResults', () => {
    it('should fetch Google results', async () => {
      axiosStub.resolves({
        data: {
          organic: [
            { title: 'Test', link: 'https://example.com', snippet: 'Test snippet' },
          ],
        },
      });

      const results = await getGoogleResults('test query', 'mock-serper-key');

      expect(results).to.have.lengthOf(1);
      expect(results[0]).to.deep.equal({
        id: 0,
        title: 'Test',
        link: 'https://example.com',
        text: 'Test snippet',
      });
      expect(axiosStub.calledWith(sinon.match({
        url: 'https://google.serper.dev/search',
        headers: sinon.match({ 'X-API-KEY': 'mock-serper-key' }),
      }))).to.be.true;
    });
  });

  describe('getExaResults', () => {
    it('should fetch Exa results', async () => {
      exaStub.resolves({
        results: [
          { title: 'Test', url: 'https://example.com', text: 'Test text' },
        ],
      });

      const results = await getExaResults('test query', 'mock-exa-key');

      expect(results).to.have.lengthOf(1);
      expect(results[0]).to.deep.equal({
        id: 1000,
        title: 'Test',
        link: 'https://example.com',
        text: 'Test text',
      });
      expect(exaStub.calledWith('test query', sinon.match.object)).to.be.true;
    });
  });

  describe('getCombinedSearchResults', () => {
    it('should combine Google and Exa results', async () => {
      const mockGoogleResults = [{ id: 0, title: 'Google', link: 'https://google.com', text: 'Google result' }];
      const mockExaResults = [{ id: 1000, title: 'Exa', link: 'https://exa.ai', text: 'Exa result' }];

      sinon.stub(global, 'getGoogleResults' as any).resolves(mockGoogleResults);
      sinon.stub(global, 'getExaResults' as any).resolves(mockExaResults);

      const results = await getCombinedSearchResults(mockContext, 'test query');

      expect(results).to.have.lengthOf(2);
      expect(results).to.deep.equal([...mockGoogleResults, ...mockExaResults]);
      await expect(getCombinedSearchResults(mockContext, 'test query')).to.be.eventually.rejectedWith(
        'SERPER_API_KEY and EXA_API_KEY must be set in environment variables'
      );
    });

    it('should throw an error if API keys are missing', async () => {
      mockContext.secrets.get.resolves(null);

      await expect(getCombinedSearchResults(mockContext, 'test query')).to.be.rejectedWith(
        'SERPER_API_KEY and EXA_API_KEY must be set in environment variables'
      );
    });
  });
});