import path from 'node:path';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const websiteRoot = path.dirname(fileURLToPath(import.meta.url));
const websitePort = Number(process.env.TAVERN_WEBSITE_PORT ?? '3100');
const serverPort = Number(process.env.TAVERN_SERVER_PORT ?? '8080');
const serverOrigin = `http://localhost:${serverPort}`;

export default defineConfig(({ command }) => ({
    base: command === 'build' && process.env.TAVERN_HOSTED_APP !== '1' ? './' : '/',
    plugins: [tailwindcss(), react()],
    resolve: {
        alias: {
            '@': path.join(websiteRoot, 'src'),
        },
    },
    server: {
        port: websitePort,
        strictPort: true,
        proxy: {
            '/healthz': {
                target: serverOrigin,
            },
            '/trpc': {
                target: serverOrigin,
                ws: true,
            },
            '/wiki/attachments': {
                target: serverOrigin,
            },
        },
    },
}));
