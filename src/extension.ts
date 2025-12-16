// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';


function parseRanges(input: string): number[] {
    const lines = new Set<number>();

    for (const part of input.split(",")) {
        const p = part.trim();
        if (!p) {
            continue;
        }

        if (p.includes("-")) {
            const [start, end] = p.split("-").map(Number);
            for (let i = start; i <= end; i++) {
                lines.add(i - 1); // VS Code is 0-based
            }
        } else {
            lines.add(Number(p) - 1);
        }
    }

    return [...lines].filter(n => n >= 0).sort((a, b) => a - b);
}


// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

    const disposable = vscode.commands.registerCommand(
        "select-lines-by-number.selectLines",
        async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage("No active editor");
                return;
            }

            const input = await vscode.window.showInputBox({
                prompt: "Enter line numbers or ranges (e.g. 4, 7-9)"
            });

            if (!input) {
				return;
			}

            let lineNumbers: number[];
            try {
                lineNumbers = parseRanges(input);
            } catch {
                vscode.window.showErrorMessage("Invalid range format");
                return;
            }

            const document = editor.document;
            const selections: vscode.Selection[] = [];

            for (const line of lineNumbers) {
                if (line < document.lineCount) {
                    const lineObj = document.lineAt(line);
                    selections.push(
                        new vscode.Selection(
                            lineObj.range.start,
                            lineObj.range.end
                        )
                    );
                }
            }

            if (selections.length === 0) {
                vscode.window.showWarningMessage("No valid lines selected");
                return;
            }

            editor.selections = selections;
            editor.revealRange(selections[0], vscode.TextEditorRevealType.InCenter);
        }
    );

    context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() {}
