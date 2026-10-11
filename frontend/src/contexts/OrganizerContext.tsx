import { useRef, useState, useEffect, type ReactNode } from 'react';
import { api } from '../services/api';
import { OrganizerContext } from './OrganizerAccess';

export function OrganizerProvider({ children }: { children: ReactNode }) {
    const [open, setOpen] = useState(false);
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [signedIn, setSignedIn] = useState(() => Boolean(sessionStorage.getItem('organizer_token')) && Number(sessionStorage.getItem('organizer_expires')) > Date.now());
    const pending = useRef<((allowed: boolean) => void) | null>(null);
    const input = useRef<HTMLInputElement>(null);
    const previousFocus = useRef<HTMLElement | null>(null);
    const finish = (allowed: boolean) => {
        setOpen(false); setPassword(''); setError('');
        pending.current?.(allowed); pending.current = null;
        previousFocus.current?.focus();
    };
    const authorize = () => {
        if (sessionStorage.getItem('organizer_token') && Number(sessionStorage.getItem('organizer_expires')) > Date.now()) return Promise.resolve(true);
        previousFocus.current = document.activeElement as HTMLElement;
        setError(''); setOpen(true);
        return new Promise<boolean>(resolve => { pending.current = resolve; });
    };
    useEffect(() => { if (open) input.current?.focus(); }, [open]);
    useEffect(() => () => pending.current?.(false), []);
    const login = async (event: React.FormEvent) => {
        event.preventDefault(); setBusy(true); setError('');
        try {
            const response = await api.post('/organizer/login', { password });
            sessionStorage.setItem('organizer_token', response.data.organizerToken);
            sessionStorage.setItem('organizer_expires', String(response.data.expiresAt));
            setSignedIn(true);
            finish(true);
        } catch (failure: any) {
            setError(failure.response?.data?.message || 'Não foi possível liberar a criação. Tente novamente.');
        } finally { setBusy(false); }
    };
    const logout = async () => {
        const token = sessionStorage.getItem('organizer_token');
        // Clear local access immediately, even if the network is unavailable.
        sessionStorage.removeItem('organizer_token'); sessionStorage.removeItem('organizer_expires'); setSignedIn(false);
        try { await api.post('/organizer/logout', null, {headers: {'X-Organizer-Token': token || ''}}); }
        catch { /* The server session also expires after twelve hours. */ }
    };
    return <OrganizerContext.Provider value={{ authorize, signedIn, logout }}>
        {children}
        {open && <div className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
            onKeyDown={event => {
                if (event.key === 'Escape' && !busy) { event.stopPropagation(); finish(false); }
                if (event.key === 'Tab') {
                    const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('input, button:not(:disabled)'));
                    const first = controls[0], last = controls[controls.length - 1];
                    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
                    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
                }
            }}>
            <form onSubmit={login} role="dialog" aria-modal="true" aria-labelledby="organizer-heading" className="card-arena p-6 w-full max-w-sm space-y-4">
                <h2 id="organizer-heading" className="text-xl font-black text-arena-400">Acesso do organizador</h2>
                <p className="text-sm text-dark-300">Use a senha para criar quizzes e partidas. Os alunos entram pelo código.</p>
                <label htmlFor="organizer-password" className="block font-bold text-sm">Senha do organizador</label>
                <input ref={input} id="organizer-password" type="password" autoComplete="current-password" required maxLength={128}
                    value={password} onChange={event => setPassword(event.target.value)} className="input-arena" />
                {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
                <div className="flex gap-3">
                    <button type="button" disabled={busy} onClick={() => finish(false)} className="flex-1 py-3 rounded-xl bg-dark-700">Cancelar</button>
                    <button type="submit" disabled={busy || !password} className="btn-primary flex-1">{busy ? 'Entrando...' : 'Entrar'}</button>
                </div>
            </form>
        </div>}
    </OrganizerContext.Provider>;
}

