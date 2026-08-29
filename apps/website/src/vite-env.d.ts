/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_GROTTO_PRODUCT_VERSION: string;
    readonly VITE_GROTTO_RELEASE_SNAPSHOT: import('@grotto/api').GrottoReleaseSnapshot;
}
