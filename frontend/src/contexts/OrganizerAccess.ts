import { createContext, useContext } from 'react';

export const OrganizerContext = createContext<{
    authorize: () => Promise<boolean>;
    signedIn: boolean;
    logout: () => Promise<void>;
} | null>(null);

export function useOrganizer() {
    const value = useContext(OrganizerContext);
    if (!value) throw new Error('OrganizerProvider ausente.');
    return value;
}
