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
const webRetrievalService_1 = require("../src/services/webRetrievalService");
const axios_1 = __importDefault(require("axios"));
const exa_js_1 = __importDefault(require("exa-js"));
const chai_2 = __importDefault(require("chai"));
const chai_as_promised_1 = __importDefault(require("chai-as-promised"));
chai_2.default.use(chai_as_promised_1.default);
describe('webRetrievalService', () => {
    let mockContext;
    let axiosStub;
    let exaStub;
    beforeEach(() => {
        mockContext = {
            secrets: {
                get: sinon.stub().callsFake((key) => {
                    if (key === 'SERPER_API_KEY')
                        return Promise.resolve('mock-serper-key');
                    if (key === 'EXA_API_KEY')
                        return Promise.resolve('mock-exa-key');
                    return Promise.resolve(null);
                }),
            },
        };
        axiosStub = sinon.stub(axios_1.default, 'post');
        exaStub = sinon.stub(exa_js_1.default.prototype, 'searchAndContents');
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
            const results = await (0, webRetrievalService_1.getGoogleResults)('test query', 'mock-serper-key');
            (0, chai_1.expect)(results).to.have.lengthOf(1);
            (0, chai_1.expect)(results[0]).to.deep.equal({
                id: 0,
                title: 'Test',
                link: 'https://example.com',
                text: 'Test snippet',
            });
            (0, chai_1.expect)(axiosStub.calledWith(sinon.match({
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
            const results = await (0, webRetrievalService_1.getExaResults)('test query', 'mock-exa-key');
            (0, chai_1.expect)(results).to.have.lengthOf(1);
            (0, chai_1.expect)(results[0]).to.deep.equal({
                id: 1000,
                title: 'Test',
                link: 'https://example.com',
                text: 'Test text',
            });
            (0, chai_1.expect)(exaStub.calledWith('test query', sinon.match.object)).to.be.true;
        });
    });
    describe('getCombinedSearchResults', () => {
        it('should combine Google and Exa results', async () => {
            const mockGoogleResults = [{ id: 0, title: 'Google', link: 'https://google.com', text: 'Google result' }];
            const mockExaResults = [{ id: 1000, title: 'Exa', link: 'https://exa.ai', text: 'Exa result' }];
            sinon.stub(global, 'getGoogleResults').resolves(mockGoogleResults);
            sinon.stub(global, 'getExaResults').resolves(mockExaResults);
            const results = await (0, webRetrievalService_1.getCombinedSearchResults)(mockContext, 'test query');
            (0, chai_1.expect)(results).to.have.lengthOf(2);
            (0, chai_1.expect)(results).to.deep.equal([...mockGoogleResults, ...mockExaResults]);
            await (0, chai_1.expect)((0, webRetrievalService_1.getCombinedSearchResults)(mockContext, 'test query')).to.be.eventually.rejectedWith('SERPER_API_KEY and EXA_API_KEY must be set in environment variables');
        });
        it('should throw an error if API keys are missing', async () => {
            mockContext.secrets.get.resolves(null);
            await (0, chai_1.expect)((0, webRetrievalService_1.getCombinedSearchResults)(mockContext, 'test query')).to.be.rejectedWith('SERPER_API_KEY and EXA_API_KEY must be set in environment variables');
        });
    });
});
//# sourceMappingURL=webRetrievalService.test.js.map