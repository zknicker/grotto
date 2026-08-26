import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import {
    AvatarGenerationActions,
    AvatarGenerationFields,
} from './agent-avatar-generation-dialog.tsx';

const preview = {
    bytesBase64: 'cHJldmlldw==',
    byteSize: 7,
    height: 256 as const,
    mediaType: 'image/png' as const,
    width: 256 as const,
};

const noop = () => undefined;

test('generation dialog requires a concept before previewing', () => {
    const markup = renderToStaticMarkup(
        <AvatarGenerationFields
            concept=""
            error={null}
            name="Scout"
            onConceptChange={noop}
            onGenerate={noop}
            preview={null}
        />
    );

    expect(markup).toContain('Concept');
    expect(markup).toContain('Your generated avatar preview will appear here.');
    expect(markup).toContain('maxLength="280"');
});

test('generation dialog shows one preview and keeps save explicit', () => {
    const markup = renderToStaticMarkup(
        <AvatarGenerationFields
            concept="a fox mechanic"
            error={null}
            name="Scout"
            onConceptChange={noop}
            onGenerate={noop}
            preview={preview}
        />
    );

    expect(markup).toContain('alt="Scout generated avatar preview"');
    expect(markup).toContain('data:image/png;base64,cHJldmlldw==');
});

test('generation dialog keeps the preview visible when retryable generation fails', () => {
    const markup = renderToStaticMarkup(
        <AvatarGenerationFields
            concept="a fox mechanic"
            error="The image provider could not generate an avatar."
            name="Scout"
            onConceptChange={noop}
            onGenerate={noop}
            preview={preview}
        />
    );

    expect(markup).toContain('The image provider could not generate an avatar.');
    expect(markup).toContain('alt="Scout generated avatar preview"');
});

test('generation actions make Save explicit and expose retry/cancel states', () => {
    const markup = renderToStaticMarkup(
        <AvatarGenerationActions
            busy={false}
            concept="a fox mechanic"
            error="The image provider could not generate an avatar."
            isGenerating={false}
            isSaving={false}
            onSave={noop}
            preview={preview}
        />
    );

    expect(markup).toContain('Try again');
    expect(markup).toContain('Save avatar');
    expect(markup).toContain('Cancel');
});
