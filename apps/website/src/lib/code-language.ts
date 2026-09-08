/** Shiki language for a workspace file, by extension; plain text otherwise. */
export function codeLanguageForPath(path: string): { id: string; label: string } {
    const extension = path.split('.').at(-1)?.toLowerCase() ?? '';
    switch (extension) {
        case 'cjs':
        case 'js':
        case 'mjs':
            return { id: 'javascript', label: 'JavaScript' };
        case 'cts':
        case 'mts':
        case 'ts':
            return { id: 'typescript', label: 'TypeScript' };
        case 'jsx':
        case 'tsx':
            return { id: 'tsx', label: 'TSX' };
        case 'json':
        case 'jsonc':
            return { id: 'json', label: 'JSON' };
        case 'css':
            return { id: 'css', label: 'CSS' };
        case 'md':
        case 'mdx':
            return { id: 'markdown', label: 'Markdown' };
        case 'py':
            return { id: 'python', label: 'Python' };
        case 'sh':
        case 'bash':
        case 'zsh':
            return { id: 'shellscript', label: 'Shell' };
        case 'yaml':
        case 'yml':
            return { id: 'yaml', label: 'YAML' };
        case 'toml':
            return { id: 'toml', label: 'TOML' };
        default:
            return { id: 'text', label: 'Text' };
    }
}
