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
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = __importStar(require("vscode"));
const path_1 = __importDefault(require("path"));
const llmService_1 = require("./services/llmService");
const scrapeService_1 = require("./services/scrapeService");
const webInteractionService_1 = require("./services/webInteractionService");
const webRetrievalService_1 = require("./services/webRetrievalService");
let outputChannel;
async function activate(context) {
    console.log('Congratulations, your extension devsearch is now active!');
    outputChannel = vscode.window.createOutputChannel('DevSearch');
    // Register the side panel
    const provider = new SidePanelViewProvider(context.extensionUri);
    context.subscriptions.push(vscode.window.registerWebviewViewProvider('devsearch.sidePanelView', provider));
    // Command to open the side panel
    let openSidePanelDisposable = vscode.commands.registerCommand('devsearch.openSidePanel', async () => {
        await vscode.commands.executeCommand('workbench.view.explorer');
        await vscode.commands.executeCommand('devsearch.sidePanelView.focus');
    });
    context.subscriptions.push(openSidePanelDisposable);
    await setupAPIKeys(context.secrets);
    let queryDisposable = vscode.commands.registerCommand('devsearch.query', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor!');
            return;
        }
        const query = await vscode.window.showInputBox({ prompt: 'Enter your query' });
        if (!query)
            return;
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
            const { queryResponse, extractedActions } = await queryLLM(context, query, analysis, screenshots);
            // Step 4: Perform extracted actions
            const newScreenshots = await performActions(context, extractedActions);
            // Step 5: Final LLM query with new context
            const finalResponse = await queryLLM(context, query, analysis, newScreenshots, queryResponse);
            // Display final response
            outputChannel.appendLine(`Final Response: ${finalResponse.queryResponse}`);
        }
        catch (error) {
            vscode.window.showErrorMessage(`Error: ${error.message}`);
        }
    });
    context.subscriptions.push(queryDisposable);
}
async function setupAPIKeys(secretStorage) {
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
async function analyzeCode(context, query) {
    const editor = vscode.window.activeTextEditor;
    if (!editor)
        throw new Error('No active editor');
    const document = editor.document;
    const fileContent = document.getText();
    const fileName = path_1.default.basename(document.fileName);
    const files = [
        {
            originalname: fileName,
            buffer: Buffer.from(fileContent),
            size: fileContent.length,
        },
    ];
    return (0, llmService_1.analyzeLLMInput)(context, query, files);
}
async function performWebSearch(context, query) {
    return (0, webRetrievalService_1.getCombinedSearchResults)(context, query);
}
async function getScreenshots(searchResults) {
    return (0, scrapeService_1.scrapeAndScreenshot)(searchResults);
}
async function queryLLM(context, query, analysis, screenshots, initialResponse = null) {
    return (0, llmService_1.queryLLMResponse)(context, query, analysis, screenshots, initialResponse);
}
async function performActions(context, actions) {
    const actionList = actions.split('\n');
    const screenshots = [];
    for (const action of actionList) {
        if (action.trim()) {
            const result = await (0, webInteractionService_1.performWebAction)(context, '', action);
            screenshots.push(result);
        }
    }
    return screenshots;
}
class SidePanelViewProvider {
    _extensionUri;
    _view;
    _uploadedFile = null;
    constructor(_extensionUri) {
        this._extensionUri = _extensionUri;
    }
    resolveWebviewView(webviewView, context, _token) {
        this._view = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };
        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
        webviewView.webview.onDidReceiveMessage((data) => {
            switch (data.type) {
                case 'textEntered':
                    this._handleTextEntered(data.value);
                    break;
                case 'fileUploaded':
                    this._handleFileUploaded(data.name, data.content);
                    break;
            }
        });
    }
    _handleTextEntered(text) {
        if (this._uploadedFile) {
            vscode.window.showInformationMessage(`Processing text: "${text}" with file: ${this._uploadedFile.name}`);
            // Process the text and file content as needed
        }
        else {
            vscode.window.showInformationMessage(`You entered: ${text}`);
        }
    }
    _handleFileUploaded(name, content) {
        this._uploadedFile = { name, content };
        vscode.window.showInformationMessage(`File ${name} uploaded successfully.`);
    }
    _getHtmlForWebview(webview) {
        const nonce = getNonce();
        return `<!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
          <title>DevSearch</title>
      </head>
      <body>
          <input type="text" id="textInput" placeholder="Enter text here">
          <input type="file" id="fileInput" style="display: none;">
          <button id="submitButton">Submit</button>
          <div id="output"></div>
  
          <script nonce="${nonce}">
              const vscode = acquireVsCodeApi();
              const textInput = document.getElementById('textInput');
              const fileInput = document.getElementById('fileInput');
              const submitButton = document.getElementById('submitButton');
              const output = document.getElementById('output');
  
              fileInput.addEventListener('change', (event) => {
                  const file = event.target.files[0];
                  if (file) {
                      const reader = new FileReader();
                      reader.onload = (e) => {
                          const content = e.target.result as string;
                          vscode.postMessage({ type: 'fileUploaded', name: file.name, content: content });
                          textInput.value = 'File selected: ' + file.name;
                      };
                      reader.readAsText(file);
                  }
              });
  
              submitButton.addEventListener('click', () => {
                  const text = textInput.value;
                  vscode.postMessage({ type: 'textEntered', value: text });
                  output.textContent = 'You entered: ' + text;
              });
          </script>
      </body>
      </html>`;
    }
}
function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
// This method is called when your extension is deactivated
function deactivate() { }
module.exports = {
    activate,
    deactivate,
};
//# sourceMappingURL=extension.js.map