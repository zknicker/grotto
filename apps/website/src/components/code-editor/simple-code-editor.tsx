'use client';

import Prism from 'prismjs';
import * as React from 'react';
import Editor from 'react-simple-code-editor';
import './simple-code-editor.css';
import 'prismjs/components/prism-clike.js';
import 'prismjs/components/prism-bash.js';
import 'prismjs/components/prism-css.js';
import 'prismjs/components/prism-javascript.js';
import 'prismjs/components/prism-jsx.js';
import 'prismjs/components/prism-json.js';
import 'prismjs/components/prism-markdown.js';
import 'prismjs/components/prism-markup.js';
import 'prismjs/components/prism-python.js';
import 'prismjs/components/prism-tsx.js';
import 'prismjs/components/prism-typescript.js';
import 'prismjs/components/prism-yaml.js';
import { cn } from '../../lib/utils.ts';

interface SimpleCodeEditorProps {
    className?: string;
    disabled?: boolean;
    filePath: string;
    onChange?: (value: string) => void;
    placeholder?: string;
    readOnly?: boolean;
    value: string;
}

function detectLanguage(filePath: string) {
    const extension = filePath.split('.').at(-1)?.toLowerCase() ?? '';

    switch (extension) {
        case 'js':
        case 'cjs':
        case 'mjs':
            return { label: 'JavaScript', prism: 'javascript' };
        case 'ts':
        case 'cts':
        case 'mts':
            return { label: 'TypeScript', prism: 'typescript' };
        case 'tsx':
            return { label: 'TSX', prism: 'tsx' };
        case 'jsx':
            return { label: 'JSX', prism: 'jsx' };
        case 'json':
            return { label: 'JSON', prism: 'json' };
        case 'sh':
        case 'bash':
            return { label: 'Shell', prism: 'bash' };
        case 'py':
            return { label: 'Python', prism: 'python' };
        case 'css':
            return { label: 'CSS', prism: 'css' };
        case 'html':
            return { label: 'HTML', prism: 'markup' };
        case 'md':
            return { label: 'Markdown', prism: 'markdown' };
        case 'yml':
        case 'yaml':
            return { label: 'YAML', prism: 'yaml' };
        case 'txt':
            return { label: 'Text', prism: 'plain' };
        default:
            return {
                label: extension.length > 0 ? extension.toUpperCase() : 'Text',
                prism: 'plain',
            };
    }
}

function buildLineNumbers(value: string) {
    const lineCount = Math.max(1, value.split('\n').length);

    return Array.from({ length: lineCount }, (_, index) => index + 1).join('\n');
}

function highlightCode(code: string, language: string) {
    const grammar = Prism.languages[language];

    if (!grammar) {
        return code;
    }

    return Prism.highlight(code, grammar, language);
}

export function SimpleCodeEditor({
    className,
    disabled = false,
    filePath,
    onChange,
    placeholder,
    readOnly = false,
    value,
}: SimpleCodeEditorProps): React.ReactElement {
    const language = React.useMemo(() => detectLanguage(filePath), [filePath]);
    const lineNumbers = React.useMemo(() => buildLineNumbers(value), [value]);

    return (
        <div
            className={cn('flex min-h-0 flex-1 flex-col overflow-auto overscroll-none', className)}
        >
            <div className="grid flex-1 grid-cols-[auto_minmax(0,1fr)]">
                <pre
                    aria-hidden="true"
                    className="sticky left-0 min-h-full min-w-14 select-none border-border-subtle border-r bg-default px-3 py-[12px] text-right font-mono text-code text-muted-foreground tabular-nums leading-[1.65]"
                >
                    {lineNumbers}
                </pre>
                <Editor
                    className={cn(
                        'tavern-simple-code-editor min-h-full font-mono text-code leading-[1.65]',
                        readOnly && 'tavern-simple-code-editor--plain'
                    )}
                    disabled={disabled}
                    highlight={(code) => highlightCode(code, language.prism)}
                    insertSpaces
                    onValueChange={onChange ?? noop}
                    padding={12}
                    placeholder={placeholder}
                    preClassName="min-h-full"
                    readOnly={readOnly}
                    style={{ minWidth: 'max-content', overflow: 'visible' }}
                    tabSize={4}
                    textareaClassName="min-h-full w-full outline-none"
                    value={value}
                />
            </div>
        </div>
    );
}

function noop() {
    // Read-only fallback when no onChange handler is provided.
}
