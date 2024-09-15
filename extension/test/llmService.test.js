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
Object.defineProperty(exports, "__esModule", { value: true });
const assert = __importStar(require("assert"));
const sinon = __importStar(require("sinon"));
const llmService_1 = require("../src/services/llmService");
const mocha_1 = require("mocha");
(0, mocha_1.describe)('LLM Service Test Suite', () => {
    let mockContext;
    class MockOpenAIClass {
        constructor() {
            return mockOpenAI;
        }
    }
    global.OpenAI = MockOpenAIClass;
    let mockOpenAI;
    (0, mocha_1.beforeEach)(() => {
        mockContext = {
            secrets: {
                get: sinon.stub().resolves('mock-api-key'),
                store: sinon.stub().resolves(),
                delete: sinon.stub().resolves(),
                onDidChange: sinon.stub(),
            },
        };
        mockOpenAI = {
            beta: {
                assistants: {
                    create: sinon.stub().resolves({ id: 'assistant-id' }),
                    update: sinon.stub().resolves({}),
                },
                threads: {
                    create: sinon.stub().resolves({ id: 'thread-id' }),
                    runs: {
                        stream: sinon.stub().returns({
                            on: sinon.stub().callsFake((event, callback) => {
                                if (event === 'messageDone') {
                                    callback({ content: [{ type: 'text', text: { value: 'Mock analysis' } }] });
                                }
                                if (event === 'end') {
                                    callback();
                                }
                                return { on: sinon.stub() };
                            }),
                        }),
                    },
                },
                vectorStores: {
                    create: sinon.stub().resolves({ id: 'vector-store-id' }),
                    fileBatches: {
                        createAndPoll: sinon.stub().resolves({}),
                    },
                },
            },
            files: {
                create: sinon.stub().resolves({ id: 'file-id' }),
            },
            chat: {
                completions: {
                    create: sinon.stub().resolves({
                        choices: [{ message: { content: 'Mock response' } }],
                    }),
                },
            },
        };
    });
    (0, mocha_1.afterEach)(() => {
        sinon.restore();
    });
    (0, mocha_1.describe)('analyzeLLMInput', () => {
        (0, mocha_1.it)('should analyze input and return analysis', async () => {
            const result = await (0, llmService_1.analyzeLLMInput)(mockContext, 'test query', [
                { originalname: 'test.js', buffer: Buffer.from('test'), size: 4 },
            ]);
            assert.strictEqual(result, 'Mock analysis');
            assert.strictEqual(mockOpenAI.beta.assistants.create.calledOnce, true);
            assert.strictEqual(mockOpenAI.beta.vectorStores.create.calledOnce, true);
            assert.strictEqual(mockOpenAI.beta.assistants.update.calledOnce, true);
            assert.strictEqual(mockOpenAI.beta.threads.create.calledOnce, true);
        });
        (0, mocha_1.it)('should throw an error if API call fails', async () => {
            mockOpenAI.beta.assistants.create.rejects(new Error('API Error'));
            await assert.rejects((0, llmService_1.analyzeLLMInput)(mockContext, 'test query', [
                { originalname: 'test.js', buffer: Buffer.from('test'), size: 4 },
            ]), {
                name: 'Error',
                message: 'API Error',
            });
        });
    });
    (0, mocha_1.describe)('queryLLMResponse', () => {
        (0, mocha_1.it)('should query LLM and return response with extracted actions', async () => {
            const result = await (0, llmService_1.queryLLMResponse)(mockContext, 'test query', 'test analysis', [{ link: 'test.com', screenshot: 'base64string' }]);
            assert.deepStrictEqual(result, {
                queryResponse: 'Mock response',
                extractedActions: 'Mock response',
            });
            assert.strictEqual(mockOpenAI.chat.completions.create.calledTwice, true);
        });
        (0, mocha_1.it)('should include initial response if provided', async () => {
            await (0, llmService_1.queryLLMResponse)(mockContext, 'test query', 'test analysis', [{ link: 'test.com', screenshot: 'base64string' }], 'initial response');
            const call = mockOpenAI.chat.completions.create.getCall(0);
            assert.strictEqual(call.args[0].messages[1].content[0].text.includes('Past Response:'), true);
        });
        (0, mocha_1.it)('should throw an error if API call fails', async () => {
            mockOpenAI.chat.completions.create.rejects(new Error('API Error'));
            await assert.rejects((0, llmService_1.queryLLMResponse)(mockContext, 'test query', 'test analysis', [{ link: 'test.com', screenshot: 'base64string' }]), {
                name: 'Error',
                message: 'API Error',
            });
        });
    });
});
//# sourceMappingURL=llmService.test.js.map