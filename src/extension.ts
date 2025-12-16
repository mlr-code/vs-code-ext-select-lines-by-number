// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

const HISTORY_KEY = "lineSelector.history";
const MAX_HISTORY = 10;


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



async function getRangeInput(
    context: vscode.ExtensionContext
): Promise<string | undefined> {

    const history = context.globalState.get<string[]>(HISTORY_KEY, []);

    const pickItems: vscode.QuickPickItem[] = [
        ...history.map(h => ({ label: h })),
        { label: "➕ Enter new range…" }
    ];

    const picked = await vscode.window.showQuickPick(pickItems, {
        placeHolder: "Select a previous range or enter a new one"
    });

    if (!picked) {
        return;
    }

    if (picked.label === "➕ Enter new range…") {
        const input = await vscode.window.showInputBox({
            prompt: "Enter line numbers or ranges (e.g. 4, 7-9)"
        });

        if (!input) {
            return;
        }

        const newHistory = [input, ...history.filter(h => h !== input)]
            .slice(0, MAX_HISTORY);

        await context.globalState.update(HISTORY_KEY, newHistory);
        return input;
    }

    return picked.label;
}


async function getFilteredLines(
    editor: vscode.TextEditor,
    rangeInput: string
): Promise<{ lines: string[]; indexes: number[] }> {

    const indexes = parseRanges(rangeInput);
    const doc = editor.document;

    const lines: string[] = [];
    for (const i of indexes) {
        if (i < doc.lineCount) {
            lines.push(doc.lineAt(i).text);
        }
    }

    return { lines, indexes };
}


// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

    // -------- SELECT LINES --------
    context.subscriptions.push(
        vscode.commands.registerCommand(
            "select-lines-by-number.selectLines",
            async () => {
                const editor = vscode.window.activeTextEditor;
                if (!editor) {
                    vscode.window.showErrorMessage("No active editor");
                    return;
                }

                const input = await getRangeInput(context);
                if (!input) {
                    return;
                }

                let indexes: number[];
                try {
                    indexes = parseRanges(input);
                } catch {
                    vscode.window.showErrorMessage("Invalid range format");
                    return;
                }

                const selections: vscode.Selection[] = [];
                for (const i of indexes) {
                    if (i < editor.document.lineCount) {
                        const line = editor.document.lineAt(i);
                        selections.push(
                            new vscode.Selection(
                                line.range.start,
                                line.range.end
                            )
                        );
                    }
                }

                if (selections.length === 0) {
                    vscode.window.showWarningMessage("No valid lines selected");
                    return;
                }

                editor.selections = selections;
                editor.revealRange(selections[0]);
            }
        )
    );

    // -------- REPLACE DOCUMENT --------
    context.subscriptions.push(
        vscode.commands.registerCommand(
            "select-lines-by-number.replaceWithFilteredLines",
            async () => {
                const editor = vscode.window.activeTextEditor;
                if (!editor) {
                    return;
                }

                const input = await getRangeInput(context);
                if (!input) {
                    return;
                }

                let filtered;
                try {
                    filtered = await getFilteredLines(editor, input);
                } catch {
                    vscode.window.showErrorMessage("Invalid range format");
                    return;
                }

                if (filtered.lines.length === 0) {
                    vscode.window.showWarningMessage("No lines to extract");
                    return;
                }

                const fullRange = new vscode.Range(
                    editor.document.positionAt(0),
                    editor.document.positionAt(
                        editor.document.getText().length
                    )
                );

                await editor.edit(editBuilder => {
                    editBuilder.replace(
                        fullRange,
                        filtered.lines.join("\n")
                    );
                });
            }
        )
    );
}

// This method is called when your extension is deactivated
export function deactivate() {}
