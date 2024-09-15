import * as assert from 'assert';
import * as sinon from 'sinon';
import { ExtensionContext } from 'vscode';
import { analyzeLLMInput, queryLLMResponse } from '../src/services/llmService';
import { describe, it, beforeEach, afterEach } from 'mocha';

describe('LLM Service Test Suite', () => {
  let mockContext: Partial<ExtensionContext>;

  type MockOpenAI = {
    beta: {
      assistants: {
        create: sinon.SinonStub;
        update: sinon.SinonStub;
      };
      threads: {
        create: sinon.SinonStub;
        runs: {
          stream: sinon.SinonStub;
        };
      };
      vectorStores: {
        create: sinon.SinonStub;
        fileBatches: {
          createAndPoll: sinon.SinonStub;
        };
      };
    };
    files: {
      create: sinon.SinonStub;
    };
    chat: {
      completions: {
        create: sinon.SinonStub;
      };
    };
  };

  class MockOpenAIClass {
    constructor() {
      return mockOpenAI as any;
    }
  }
  (global as any).OpenAI = MockOpenAIClass;
  let mockOpenAI: MockOpenAI;

  beforeEach(() => {
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

  afterEach(() => {
    sinon.restore();
  });

  describe('analyzeLLMInput', () => {
    it('should analyze input and return analysis', async () => {
      const result = await analyzeLLMInput(mockContext as ExtensionContext, 'test query', [
        { originalname: 'test.js', buffer: Buffer.from('test'), size: 4 },
      ]);

      assert.strictEqual(result, 'Mock analysis');
      assert.strictEqual(mockOpenAI.beta.assistants.create.calledOnce, true);
      assert.strictEqual(mockOpenAI.beta.vectorStores.create.calledOnce, true);
      assert.strictEqual(mockOpenAI.beta.assistants.update.calledOnce, true);
      assert.strictEqual(mockOpenAI.beta.threads.create.calledOnce, true);
    });

    it('should throw an error if API call fails', async () => {
      mockOpenAI.beta.assistants.create.rejects(new Error('API Error'));

      await assert.rejects(
        analyzeLLMInput(mockContext as ExtensionContext, 'test query', [
          { originalname: 'test.js', buffer: Buffer.from('test'), size: 4 },
        ]),
        {
          name: 'Error',
          message: 'API Error',
        }
      );
    });
  });

  describe('queryLLMResponse', () => {
    it('should query LLM and return response with extracted actions', async () => {
      const result = await queryLLMResponse(
        mockContext as ExtensionContext,
        'test query',
        'test analysis',
        [{ link: 'test.com', screenshot: 'base64string' }]
      );

      assert.deepStrictEqual(result, {
        queryResponse: 'Mock response',
        extractedActions: 'Mock response',
      });
      assert.strictEqual(mockOpenAI.chat.completions.create.calledTwice, true);
    });

    it('should include initial response if provided', async () => {
      await queryLLMResponse(
        mockContext as ExtensionContext,
        'test query',
        'test analysis',
        [{ link: 'test.com', screenshot: 'base64string' }],
        'initial response'
      );

      const call = mockOpenAI.chat.completions.create.getCall(0);
      assert.strictEqual(call.args[0].messages[1].content[0].text.includes('Past Response:'), true);
    });

    it('should throw an error if API call fails', async () => {
      mockOpenAI.chat.completions.create.rejects(new Error('API Error'));

      await assert.rejects(
        queryLLMResponse(
          mockContext as ExtensionContext,
          'test query',
          'test analysis',
          [{ link: 'test.com', screenshot: 'base64string' }]
        ),
        {
          name: 'Error',
          message: 'API Error',
        }
      );
    });
  });
});