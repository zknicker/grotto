import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const websiteRoot = path.dirname(fileURLToPath(import.meta.url));
const websitePort = Number(process.env.GROTTO_WEBSITE_PORT ?? '3100');
const serverPort = Number(process.env.GROTTO_SERVER_PORT ?? '8090');
const serverOrigin = process.env.VITE_GROTTO_SERVER_ORIGIN ?? `http://localhost:${serverPort}`;
// Hosted avatar bytes are served by the Grotto Server, not the local API. In
// production Grotto App shares that origin, so the stored avatar URL stays
// relative; only the dev proxy has to be pointed at the Server explicitly.
const grottoServerOrigin = serverOrigin;

// The App's product version is provenance the App sends to the hosted Server.
// It has one source of truth: this package's version.
const productVersion = JSON.parse(readFileSync(path.join(websiteRoot, 'package.json'), 'utf8'))
    .version as string;

export default defineConfig(({ command }) => ({
    base: command === 'build' && process.env.GROTTO_HOSTED_APP !== '1' ? './' : '/',
    define: {
        'import.meta.env.VITE_GROTTO_PRODUCT_VERSION': JSON.stringify(
            process.env.VITE_GROTTO_PRODUCT_VERSION ?? productVersion
        ),
    },
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
            '/api/avatars': {
                target: grottoServerOrigin,
            },
            '/api/prepared-action-media': {
                target: grottoServerOrigin,
            },
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
