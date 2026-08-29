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
            isGenerating={false}
            name="Scout"
            onConceptChange={noop}
            onGenerate={noop}
            preview={null}
        />
    );

    expect(markup).toContain('Concept');
    expect(markup).toContain('maxLength="280"');
    // No placeholder stage before generation — an empty box read as a drop
    // zone it never was.
    expect(markup).not.toContain('bg-surface-secondary');
});

test('generation dialog shows one preview and keeps save explicit', () => {
    const markup = renderToStaticMarkup(
        <AvatarGenerationFields
            concept="a fox mechanic"
            error={null}
            isGenerating={false}
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
            isGenerating={false}
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

    expect(markup).toContain('Try Again');
    expect(markup).toContain('Save Avatar');
    expect(markup).toContain('Cancel');
});
