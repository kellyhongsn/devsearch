const vscode = require('vscode');

function activate(context) {
    console.log('DevSearch extension is now active!');

    const provider = new SidePanelViewProvider(context.extensionUri);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('devsearch.sidePanelView', provider)
    );
    let disposable = vscode.commands.registerCommand('devsearch.openSidePanel', async () => {
        await vscode.commands.executeCommand('workbench.view.explorer');
        await vscode.commands.executeCommand('devsearch.sidePanelView.focus');
    });

    context.subscriptions.push(disposable);
}

class SidePanelViewProvider {
    constructor(extensionUri) {
        this._extensionUri = extensionUri;
    }

    resolveWebviewView(webviewView, context, _token) {
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(data => {
            switch (data.type) {
                case 'textEntered':
                    vscode.window.showInformationMessage(`You entered: ${data.value}`);
                    break;
            }
        });
    }
    _getHtmlForWebview(webview) {
        const nonce = getNonce();
    
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <meta http-equiv="Content-Security-Policy" content="default-src 'self'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
            <title>DevSearch</title>
        </head>
        <body>
            <input type="text" id="textInput" placeholder="Enter text here">
            <button id="submitButton">Submit</button>
            <div id="output"></div>
            <script nonce="${nonce}">
                const vscode = acquireVsCodeApi();
                const textInput = document.getElementById('textInput');
                const submitButton = document.getElementById('submitButton');
                const output = document.getElementById('output');
    
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

function deactivate() {}

module.exports = {
    activate,
    deactivate
}

/*// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
const llmService = require('./services/llmService');
const scrapeService = require('./services/scrapeService');
const webInteractionService = require('./services/webInteractionService');
const webRetrievalService = require('./services/webRetrievalService');

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed

/**
 * @param {vscode.ExtensionContext} context
 */
/*function activate(context) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension devsearch is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with  registerCommand
	// The commandId parameter must match the command field in package.json
	const disposable = vscode.commands.registerCommand('extension.helloWorld', function () {
		// The code you place here will be executed every time your command is executed

		// Display a message box to the user
		vscode.window.showInformationMessage('Hello World from devsearch!');
	});

	context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
function deactivate() {}

module.exports = {
	activate,
	deactivate
}
*/