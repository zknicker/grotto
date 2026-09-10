'use strict';

const { describe, expect, test } = require('bun:test');
const builderConfig = require('../electron-builder.config.cjs');
const {
    prepareNativeClerkRequest,
    prepareNativeClerkResponse,
} = require('./clerk-native-requests.cjs');

describe('prepareNativeClerkRequest', () => {
    test('packages the request interceptor with the desktop shell', () => {
        expect(builderConfig.files).toContain('electron/clerk-native-requests.cjs');
    });

    test('removes the browser Origin from Clerk native requests', () => {
        expect(
            prepareNativeClerkRequest({
                requestHeaders: {
                    Authorization: 'Bearer client-jwt',
                    Origin: 'https://haus.chat',
                    'User-Agent': 'Haus',
                },
                url: 'https://clerk.haus.chat/v1/client?_is_native=1',
            })
        ).toEqual({
            Authorization: 'Bearer client-jwt',
            'User-Agent': 'Haus',
        });
    });

    test('preserves ordinary hosted Clerk requests', () => {
        const headers = {
            Origin: 'https://haus.chat',
            'User-Agent': 'Haus',
        };

        expect(
            prepareNativeClerkRequest({
                requestHeaders: headers,
                url: 'https://clerk.haus.chat/v1/client',
            })
        ).toBe(headers);
    });

    test('removes a lower-case Origin header too', () => {
        expect(
            prepareNativeClerkRequest({
                requestHeaders: {
                    authorization: 'Bearer client-jwt',
                    origin: 'https://haus.chat',
                },
                url: 'https://clerk.haus.chat/v1/client?_is_native=1',
            })
        ).toEqual({
            authorization: 'Bearer client-jwt',
        });
    });

    test('preserves native-marked requests to other origins', () => {
        const headers = {
            Authorization: 'Bearer private',
            Origin: 'https://haus.chat',
        };

        expect(
            prepareNativeClerkRequest({
                requestHeaders: headers,
                url: 'https://example.com/?_is_native=1',
            })
        ).toBe(headers);
    });
});

describe('prepareNativeClerkResponse', () => {
    test('permits only Haus App to read native Clerk responses', () => {
        expect(
            prepareNativeClerkResponse(
                {
                    responseHeaders: {
                        'content-type': ['application/json'],
                    },
                    url: 'https://clerk.haus.chat/v1/client?_is_native=1',
                },
                'https://clerk.haus.chat',
                'https://haus.chat'
            )
        ).toEqual({
            'Access-Control-Allow-Headers': ['authorization', 'content-type'],
            'Access-Control-Allow-Methods': ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
            'Access-Control-Allow-Origin': ['https://haus.chat'],
            'content-type': ['application/json'],
        });
    });

    test('preserves non-native Clerk responses', () => {
        const headers = { 'content-type': ['application/json'] };

        expect(
            prepareNativeClerkResponse(
                {
                    responseHeaders: headers,
                    url: 'https://clerk.haus.chat/v1/client',
                },
                'https://clerk.haus.chat',
                'https://haus.chat'
            )
        ).toBe(headers);
    });
});
