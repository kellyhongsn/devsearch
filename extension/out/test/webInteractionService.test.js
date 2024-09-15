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
const webInteractionService_1 = require("../src/services/webInteractionService");
const openai_1 = require("openai");
const axios_1 = __importDefault(require("axios"));
const scrapeService_1 = require("../src/services/scrapeService");
describe('webInteractionService', () => {
    let mockContext;
    let mockOpenAI;
    let axiosStub;
    let scrapeAndScreenshotStub;
    beforeEach(() => {
        mockContext = {
            secrets: {
                get: sinon.stub().resolves('mock-api-key'),
            },
        };
        mockOpenAI = {
            chat: {
                completions: {
                    create: sinon.stub().resolves({
                        choices: [{ message: { content: 'https://example.com/relevant' } }],
                    }),
                },
            },
        };
        sinon.stub(openai_1.OpenAI.prototype, 'constructor').returns(mockOpenAI);
        axiosStub = sinon.stub(axios_1.default, 'get').resolves({ data: '<html>Mock HTML</html>' });
        scrapeAndScreenshotStub = sinon.stub(scrapeService_1.scrapeAndScreenshot).resolves([
            { id: 1, link: 'https://example.com/relevant', screenshot: 'base64screenshot' },
        ]);
    });
    afterEach(() => {
        sinon.restore();
    });
    it('should perform web action and return result', async () => {
        const result = await (0, webInteractionService_1.performWebAction)(mockContext, 'https://example.com', 'test query');
        (0, chai_1.expect)(result).to.deep.equal({
            link: 'https://example.com/relevant',
            screenshot: 'base64screenshot',
        });
        (0, chai_1.expect)(mockContext.secrets.get.calledWith('OPENAI_API_KEY')).to.be.true;
        (0, chai_1.expect)(axiosStub.calledWith('https://example.com')).to.be.true;
        (0, chai_1.expect)(mockOpenAI.chat.completions.create.called).to.be.true;
        (0, chai_1.expect)(scrapeAndScreenshotStub.called).to.be.true;
    });
    it('should throw an error if no relevant link is found', async () => {
        mockOpenAI.chat.completions.create.returns(Promise.resolve({
            choices: [{ message: { content: '' } }],
        }));
        await (0, chai_1.expect)((0, webInteractionService_1.performWebAction)(mockContext, 'https://example.com', 'test query')).to.be.rejectedWith('No relevant link found');
    });
});
//# sourceMappingURL=webInteractionService.test.js.map