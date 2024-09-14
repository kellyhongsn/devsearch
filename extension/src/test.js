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
        this._view = undefined;
        this._uploadedFile = null;
    }

    resolveWebviewView(webviewView, context, _token) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(data => {
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
        } else {
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
                const chooseFileButton = document.getElementById('chooseFileButton');
                const fileInput = document.getElementById('fileInput');
                const submitButton = document.getElementById('submitButton');
                const output = document.getElementById('output');
    
                chooseFileButton.addEventListener('click', () => {
                    fileInput.click();
                });
    
                fileInput.addEventListener('change', (event) => {
                    const file = event.target.files[0];
                    if (file) {
                        const reader = new FileReader();
                        reader.onload = (e) => {
                            const content = e.target.result;
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

function deactivate() {}

module.exports = {
    activate,
    deactivate
}