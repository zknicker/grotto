import { useOutletContext } from 'react-router-dom';

interface AppLayoutContextValue {
    navigateToSettings: () => void;
}

export function useLayoutContext() {
    return useOutletContext<AppLayoutContextValue>();
}
