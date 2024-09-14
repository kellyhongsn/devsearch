// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import path from 'path';
import { analyzeLLMInput, queryLLMResponse } from './services/llmService';
import { scrapeAndScreenshot } from './services/scrapeService';
import { performWebAction } from './services/webInteractionService';
import { getCombinedSearchResults } from './services/webRetrievalService';
import { ScrapeResult } from './services/scrapeService';
let outputChannel: vscode.OutputChannel;

async function activate(context: vscode.ExtensionContext) {
  console.log('Congratulations, your extension devsearch is now active!');
  outputChannel = vscode.window.createOutputChannel('DevSearch');

  await setupAPIKeys(context.secrets);

  let disposable = vscode.commands.registerCommand('devsearch.query', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage('No active editor!');
      return;
    }

    const query = await vscode.window.showInputBox({ prompt: 'Enter your query' });
    if (!query) return;

    outputChannel.appendLine(`Processing query: ${query}`);
    outputChannel.show();

    try {
      // Step 1: Analyze code and perform web search
      const [analysis, searchResults] = await Promise.all([
        analyzeCode(context, query),
        performWebSearch(context, query),
      ]);

      // Step 2: Get screenshots
      const screenshots = await getScreenshots(searchResults);

      // Step 3: Query LLM for initial response
      const { queryResponse, extractedActions } = await queryLLM(
        context,
        query,
        analysis,
        screenshots
      );

      // Step 4: Perform extracted actions
      const newScreenshots = await performActions(context, extractedActions);

      // Step 5: Final LLM query with new context
      const finalResponse = await queryLLM(context, query, analysis, newScreenshots, queryResponse);

      // Display final response
      outputChannel.appendLine(`Final Response: ${finalResponse.queryResponse}`);
    } catch (error: any) {
      vscode.window.showErrorMessage(`Error: ${error.message}`);
    }
  });
  context.subscriptions.push(disposable);
}

async function setupAPIKeys(secretStorage: vscode.SecretStorage): Promise<void> {
  const apiKeys = ['OPENAI_API_KEY', 'SERPER_API_KEY', 'EXA_API_KEY'];
  for (const key of apiKeys) {
    if (!(await secretStorage.get(key))) {
      const value = await vscode.window.showInputBox({
        prompt: `Enter your ${key}`,
        password: true,
      });
      if (value) {
        await secretStorage.store(key, value);
      }
    }
  }
}

async function analyzeCode(context: vscode.ExtensionContext, query: string): Promise<string> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) throw new Error('No active editor');

  const document = editor.document;
  const fileContent = document.getText();
  const fileName = path.basename(document.fileName);

  const files = [
    {
      originalname: fileName,
      buffer: Buffer.from(fileContent),
      size: fileContent.length,
    },
  ];

  return analyzeLLMInput(context, query, files);
}

async function performWebSearch(context: vscode.ExtensionContext, query: string): Promise<any[]> {
  return getCombinedSearchResults(context, query);
}

async function getScreenshots(searchResults: any[]): Promise<ScrapeResult[]> {
  return scrapeAndScreenshot(searchResults);
}

async function queryLLM(
  context: vscode.ExtensionContext,
  query: string,
  analysis: any,
  screenshots: ScrapeResult[],
  initialResponse: string | null = null
) {
  return queryLLMResponse(context, query, analysis, screenshots, initialResponse);
}

async function performActions(
  context: vscode.ExtensionContext,
  actions: string
): Promise<ScrapeResult[]> {
  const actionList = actions.split('\n');
  const screenshots: ScrapeResult[] = [];

  for (const action of actionList) {
    if (action.trim()) {
      const result = await performWebAction(context, '', action);
      screenshots.push(result);
    }
  }

  return screenshots;
}

// This method is called when your extension is deactivated
function deactivate() {}

module.exports = {
  activate,
  deactivate,
};
