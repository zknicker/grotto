import * as SecureStore from 'expo-secure-store';
import {
    createContext,
    type PropsWithChildren,
    use,
    useCallback,
    useEffect,
    useRef,
    useState,
} from 'react';
import { Uniwind } from 'uniwind';

export type ThemePreference = 'dark' | 'light' | 'system';

const STORAGE_KEY = 'grotto.theme-preference';

const ThemePreferenceContext = createContext<
    | {
          preference: ThemePreference;
          setPreference: (preference: ThemePreference) => void;
      }
    | undefined
>(undefined);

export function ThemePreferenceProvider({ children }: PropsWithChildren) {
    const [preference, setPreferenceState] = useState<ThemePreference>('system');
    const didChangePreference = useRef(false);

    useEffect(() => {
        let isCurrent = true;

        SecureStore.getItemAsync(STORAGE_KEY)
            .then((storedPreference) => {
                if (
                    !(isCurrent && isThemePreference(storedPreference)) ||
                    didChangePreference.current
                ) {
                    return;
                }
                setPreferenceState(storedPreference);
                Uniwind.setTheme(storedPreference);
            })
            .catch((error: unknown) => {
                console.error('Could not restore the appearance preference.', error);
            });

        return () => {
            isCurrent = false;
        };
    }, []);

    const setPreference = useCallback((nextPreference: ThemePreference) => {
        didChangePreference.current = true;
        setPreferenceState(nextPreference);
        Uniwind.setTheme(nextPreference);
        SecureStore.setItemAsync(STORAGE_KEY, nextPreference).catch((error: unknown) => {
            console.error('Could not save the appearance preference.', error);
        });
    }, []);

    return (
        <ThemePreferenceContext value={{ preference, setPreference }}>
            {children}
        </ThemePreferenceContext>
    );
}

export function useThemePreference() {
    const value = use(ThemePreferenceContext);
    if (!value) {
        throw new Error('useThemePreference must be used inside ThemePreferenceProvider.');
    }
    return value;
}

function isThemePreference(value: string | null): value is ThemePreference {
    return value === 'dark' || value === 'light' || value === 'system';
}
