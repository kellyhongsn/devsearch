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
async function clearAPIKeys(secretStorage) {
    const apiKeys = ['OPENAI_API_KEY', 'SERPER_API_KEY', 'EXA_API_KEY'];
    for (const key of apiKeys) {
        await secretStorage.delete(key);
    }
    vscode.window.showInformationMessage('API keys have been cleared.');
}
async function activate(context) {
    console.log('Congratulations, your extension devsearch is now active!');
    outputChannel = vscode.window.createOutputChannel('DevSearch');
    // Show API keys input popup
    let apiKeysSet = false;
    while (!apiKeysSet) {
        try {
            await showAPIKeysInput(context);
            apiKeysSet = true;
        }
        catch (error) {
            const retry = await vscode.window.showErrorMessage('API Keys are required to use this extension.', 'Try Again', 'Cancel');
            if (retry === 'Cancel') {
                return;
            }
        }
    }
    let clearKeysDisposable = vscode.commands.registerCommand('devsearch.clearAPIKeys', async () => {
        await clearAPIKeys(context.secrets);
    });
    context.subscriptions.push(clearKeysDisposable);
    // Register the side panel
    const provider = new SidePanelViewProvider(context);
    context.subscriptions.push(vscode.window.registerWebviewViewProvider('devsearch.sidePanelView', provider));
    // Command to open the side panel
    let openSidePanelDisposable = vscode.commands.registerCommand('devsearch.openSidePanel', async () => {
        await vscode.commands.executeCommand('workbench.view.explorer');
        await vscode.commands.executeCommand('devsearch.sidePanelView.focus');
    });
    context.subscriptions.push(openSidePanelDisposable);
    //await setupAPIKeys(context.secrets);
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
        let value = await secretStorage.get(key);
        // Loop until the user provides a valid input for each key
        while (!value) {
            value = await vscode.window.showInputBox({
                prompt: `Enter your ${key}`,
                password: true,
                ignoreFocusOut: true, // Ensure the input box doesn't close when clicked outside
            });
            if (value) {
                await secretStorage.store(key, value);
                vscode.window.showInformationMessage(`${key} saved successfully!`);
            }
            else {
                // If the user cancels or doesn't input a value, show an error and re-prompt
                vscode.window.showErrorMessage(`${key} is required. Please enter a valid ${key}.`);
            }
        }
    }
}
async function analyzeCode(context, query, uploadedFile) {
    let files;
    if (uploadedFile) {
        files = [
            {
                originalname: uploadedFile.name,
                buffer: Buffer.from(uploadedFile.content),
                size: uploadedFile.content.length,
            },
        ];
    }
    else {
        const editor = vscode.window.activeTextEditor;
        if (!editor)
            throw new Error('No active editor');
        const document = editor.document;
        const fileContent = document.getText();
        const fileName = path_1.default.basename(document.fileName);
        files = [
            {
                originalname: fileName,
                buffer: Buffer.from(fileContent),
                size: fileContent.length,
            },
        ];
    }
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
async function processQuery(context, query, uploadedFile, sendMessage) {
    console.log('processQuery called with query:', query);
    const editor = vscode.window.activeTextEditor;
    if (!editor && !uploadedFile) {
        vscode.window.showErrorMessage('No active editor or uploaded file!');
        return;
    }
    const output = sendMessage ? sendMessage : (msg) => outputChannel.appendLine(msg);
    output(`Processing query: ${query}`);
    try {
        output('Analyzing code and performing web search...');
        const [analysis, searchResults] = await Promise.all([
            analyzeCode(context, query, uploadedFile),
            performWebSearch(context, query),
        ]);
        output('Getting screenshots...');
        const screenshots = await getScreenshots(searchResults);
        output('Querying LLM for initial response...');
        const { queryResponse, extractedActions } = await queryLLM(context, query, analysis, screenshots);
        output('Performing extracted actions...');
        const newScreenshots = await performActions(context, extractedActions);
        output('Querying LLM for final response...');
        const finalResponse = await queryLLM(context, query, analysis, newScreenshots, queryResponse);
        output(`Final Response: ${finalResponse.queryResponse}`);
    }
    catch (error) {
        vscode.window.showErrorMessage(`Error: ${error.message}`);
    }
}
class SidePanelViewProvider {
    constructor(_context) {
        this._context = _context;
        this._context = _context;
    }
    resolveWebviewView(webviewView, context, _token) {
        this._view = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._context.extensionUri]
        };
        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
        webviewView.webview.onDidReceiveMessage((data) => {
            console.log('Message received from webview:', data);
            switch (data.type) {
                case 'textEntered':
                    this._handleTextEntered(data.value);
                    break;
                case 'fileUploaded':
                    this._handleFileUploaded(data.name, data.content);
                    break;
                default:
                    console.log('Unknown message type:', data.type);
            }
        });
    }
    async _handleTextEntered(text) {
        console.log(`_handleTextEntered called with text: ${text}`);
        try {
            await processQuery(this._context, text, this._uploadedFile, (message) => {
                console.log(`processQuery output: ${message}`);
                this._sendMessageToWebview({ type: 'output', message });
            });
        }
        catch (error) {
            console.error(`Error in _handleTextEntered: ${error.message}`);
            vscode.window.showErrorMessage(`Error: ${error.message}`);
        }
    }
    _sendMessageToWebview(message) {
        if (this._view) {
            this._view.webview.postMessage(message);
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
    <title>DevSearch</title>
    <style>
        body { 
            font-family: var(--vscode-font-family);
            padding: 10px;
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
        }
        input[type="text"], button, #fileInputLabel {
            margin: 5px 0;
            padding: 5px;
            width: calc(100% - 10px);
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
        }
        button, #fileInputLabel {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            cursor: pointer;
            display: inline-block;
            text-align: center;
        }
        #output {
            margin-top: 10px;
            white-space: pre-wrap;
        }
        #fileInput {
            display: none;
        }
    </style>
</head>
<body>
    <input type="text" id="textInput" placeholder="Enter your query">
    <label for="fileInput" id="fileInputLabel">Choose File</label>
    <input type="file" id="fileInput">
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
                    vscode.postMessage({
                        type: 'fileUploaded',
                        name: file.name,
                        content: e.target.result
                    });
                };
                reader.readAsText(file);
            }
        });

        submitButton.addEventListener('click', () => {
            const text = textInput.value;
            vscode.postMessage({ type: 'textEntered', value: text });
            console.log('Message sent:', { type: 'textEntered', value: text });
        });

        window.addEventListener('message', event => {
            const message = event.data;
            switch (message.type) {
                case 'output':
                    const p = document.createElement('p');
                    p.textContent = message.message;
                    output.appendChild(p);
                    console.log('Output message displayed:', message.message);
                    break;
                default:
                    console.log('Unknown message type from extension:', message.type);
            }
        });
    </script>
</body>
</html>
    `;
    }
}
async function showAPIKeysInput(context) {
    const apiKeys = ['OPENAI_API_KEY', 'SERPER_API_KEY', 'EXA_API_KEY'];
    let allKeysPresent = true;
    for (const key of apiKeys) {
        const value = await context.secrets.get(key);
        if (!value) {
            allKeysPresent = false;
            break;
        }
    }
    if (allKeysPresent) {
        return;
    }
    const panel = vscode.window.createWebviewPanel('apiKeysInput', 'Enter API Keys', vscode.ViewColumn.Active, {
        enableScripts: true,
        retainContextWhenHidden: true,
    });
    panel.webview.html = getAPIKeysHtml(panel.webview);
    return new Promise((resolve, reject) => {
        panel.webview.onDidReceiveMessage(async (message) => {
            if (message.command === 'saveKeys') {
                const keys = message.keys;
                for (const key of apiKeys) {
                    const value = keys[key];
                    if (value) {
                        await context.secrets.store(key, value);
                    }
                    else {
                        vscode.window.showErrorMessage(`${key} is required.`);
                        return;
                    }
                }
                vscode.window.showInformationMessage('API Keys saved successfully.');
                panel.dispose();
                resolve();
            }
        }, undefined, context.subscriptions);
        panel.onDidDispose(() => {
            vscode.window.showErrorMessage('API Keys are required to use this extension.');
            reject(new Error('API Keys not provided.'));
        }, null, context.subscriptions);
    });
}
function getAPIKeysHtml(webview) {
    const nonce = getNonce();
    return `<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <title>Enter API Keys</title>
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
  </head>
  <body>
    <h1>Enter API Keys</h1>
    <form id="apiKeysForm">
      <label for="OPENAI_API_KEY">OpenAI API Key:</label><br>
      <input type="password" id="OPENAI_API_KEY" name="OPENAI_API_KEY"><br>
      <label for="SERPER_API_KEY">Serper API Key:</label><br>
      <input type="password" id="SERPER_API_KEY" name="SERPER_API_KEY"><br>
      <label for="EXA_API_KEY">Exa API Key:</label><br>
      <input type="password" id="EXA_API_KEY" name="EXA_API_KEY"><br>
      <button type="submit">Save</button>
    </form>
    <script nonce="${nonce}">
      const vscode = acquireVsCodeApi();
      const form = document.getElementById('apiKeysForm');
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        const keys = {
          OPENAI_API_KEY: document.getElementById('OPENAI_API_KEY').value,
          SERPER_API_KEY: document.getElementById('SERPER_API_KEY').value,
          EXA_API_KEY: document.getElementById('EXA_API_KEY').value,
        };
        vscode.postMessage({
          command: 'saveKeys',
          keys: keys
        });
      });
    </script>
  </body>
  </html>`;
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