import * as assert from 'assert';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import * as llmService from '../src/services/llmService';
import * as scrapeService from '../src/services/scrapeService';
import * as webInteractionService from '../src/services/webInteractionService';
import * as webRetrievalService from '../src/services/webRetrievalService';

suite('Extension Test Suite', () => {
  vscode.window.showInformationMessage('Start all tests.');

  test('Extension activation', async () => {
    // Test if the extension activates correctly
    const ext = vscode.extensions.getExtension('your-extension-id');
    assert.ok(ext);
    await ext?.activate();
    assert.strictEqual(ext?.isActive, true);
  });

  test('devsearch.query command', async () => {
    // Mock VS Code API functions
    const showInputBoxStub = sinon.stub(vscode.window, 'showInputBox');
    showInputBoxStub.resolves('test query');

    // Mock service functions
    const analyzeCodeStub = sinon.stub(llmService, 'analyzeLLMInput').resolves('analysis result');
    const performWebSearchStub = sinon.stub(webRetrievalService, 'getCombinedSearchResults').resolves([]);
    const getScreenshotsStub = sinon.stub(scrapeService, 'scrapeAndScreenshot').resolves([]);
    const queryLLMStub = sinon.stub(llmService, 'queryLLMResponse').resolves({
      queryResponse: 'response',
      extractedActions: 'actions',
    });
    const performActionsStub = sinon.stub(webInteractionService, 'performWebAction').resolves({
      link: 'test link',
      screenshot: 'test screenshot',
    });

    // Trigger the command
    await vscode.commands.executeCommand('devsearch.query');

    // Assert that all the necessary functions were called
    assert.strictEqual(showInputBoxStub.calledOnce, true);
    assert.strictEqual(analyzeCodeStub.calledOnce, true);
    assert.strictEqual(performWebSearchStub.calledOnce, true);
    assert.strictEqual(getScreenshotsStub.calledOnce, true);
    assert.strictEqual(queryLLMStub.calledTwice, true);
    assert.strictEqual(performActionsStub.calledOnce, true);

    // Restore stubs
    showInputBoxStub.restore();
    analyzeCodeStub.restore();
    performWebSearchStub.restore();
    getScreenshotsStub.restore();
    queryLLMStub.restore();
    performActionsStub.restore();
  });
});