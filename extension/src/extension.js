// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
const path = require('path');
const llmService = require('./services/llmService');
const scrapeService = require('./services/scrapeService');
const webInteractionService = require('./services/webInteractionService');
const webRetrievalService = require('./services/webRetrievalService');

let outputChannel;

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
	console.log('Congratulations, your extension devsearch is now active!');
	outputChannel = vscode.window.createOutputChannel("DevSearch");

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
                analyzeCode(query),
                performWebSearch(query)
            ]);

            // Step 2: Get screenshots
            const screenshots = await getScreenshots(searchResults);

            // Step 3: Query LLM for initial response
            const { queryResponse, extractedActions } = await queryLLM(query, analysis, screenshots);

            // Step 4: Perform extracted actions
            const newScreenshots = await performActions(extractedActions);

            // Step 5: Final LLM query with new context
            const finalResponse = await queryLLM(query, analysis, newScreenshots, queryResponse);

            // Display final response
            outputChannel.appendLine(`Final Response: ${finalResponse.queryResponse}`);
        } catch (error) {
            vscode.window.showErrorMessage(`Error: ${error.message}`);
        }
	});
	context.subscriptions.push(disposable);
}

async function analyzeCode(query) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) throw new Error('No active editor');

    const document = editor.document;
    const fileContent = document.getText();
    const fileName = path.basename(document.fileName);

    const files = [{
        originalname: fileName,
        buffer: Buffer.from(fileContent),
        size: fileContent.length
    }];

    return llmService.analyzeLLMInput(query, files);
}

async function performWebSearch(query) {
    return webRetrievalService.getCombinedSearchResults(query);
}

async function getScreenshots(searchResults) {
    return scrapeService.scrapeAndScreenshot(searchResults);
}

async function queryLLM(query, analysis, screenshots, initialResponse = null) {
    return llmService.queryLLMResponse(query, analysis, screenshots, initialResponse);
}

async function performActions(actions) {
    const actionList = actions.split('\n');
    const screenshots = [];

    for (const action of actionList) {
        if (action.trim()) {
            const result = await webInteractionService.performWebAction('', action);
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
