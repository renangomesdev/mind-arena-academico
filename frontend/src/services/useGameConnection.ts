import { useCallback, useEffect, useRef } from 'react';
import { api } from './api';
import { createStompClient } from './websocket';

// Subscribe before reading the snapshot; discard snapshots overtaken by live events.
export function useGameConnection(code: string | undefined, playerId: number | undefined,
    onState: (state: any) => void, onEvent: (event: any) => void, onError: (error: any) => void) {
    const handlers = useRef({ onState, onEvent, onError });
    const refreshRef = useRef<() => void>(() => {});
    useEffect(() => { handlers.current = { onState, onEvent, onError }; });

    useEffect(() => {
        if (!code) return;
        let disposed = false;
        let generation = 0;
        let fetching = false;
        let needsRefresh = false;
        const client = createStompClient();
        client.beforeConnect = () => {
            const arenaCode = code.toUpperCase();
            client.connectHeaders = playerId
                ? { arenaCode, playerId: String(playerId), playerToken: sessionStorage.getItem(`player_token_${arenaCode}`) || '' }
                : { arenaCode, hostToken: sessionStorage.getItem(`host_token_${arenaCode}`) || '' };
        };
        const sync = async () => {
            if (disposed) return;
            if (fetching) { needsRefresh = true; return; }
            fetching = true;
            const before = generation;
            const requestedAt = Date.now();
            try {
                const path = playerId ? `/games/${code}/players/${playerId}/state` : `/games/${code}`;
                const response = await api.get(path);
                if (!disposed && before === generation) {
                    // Estimate the server clock at receipt using half the HTTP round trip.
                    handlers.current.onState({ ...response.data, receivedAt: Date.now(),
                        serverTime: response.data.serverTime + (Date.now() - requestedAt) / 2 });
                } else { needsRefresh = true; }
            } catch (error) {
                if (!disposed) handlers.current.onError(error);
            } finally {
                fetching = false;
                if (needsRefresh && !disposed) { needsRefresh = false; void sync(); }
            }
        };
        refreshRef.current = () => { void sync(); };
        client.onConnect = () => {
            client.subscribe(`/topic/game/${code}`, message => {
                if (disposed) return;
                generation++;
                handlers.current.onEvent(JSON.parse(message.body));
            });
            void sync();
        };
        client.activate();
        void sync();
        const onVisible = () => { if (document.visibilityState === 'visible') void sync(); };
        document.addEventListener('visibilitychange', onVisible);
        window.addEventListener('online', onVisible);
        const interval = window.setInterval(() => { void sync(); }, 10000);
        return () => {
            disposed = true;
            refreshRef.current = () => {};
            clearInterval(interval);
            document.removeEventListener('visibilitychange', onVisible);
            window.removeEventListener('online', onVisible);
            void client.deactivate();
        };
    }, [code, playerId]);

    return useCallback(() => refreshRef.current(), []);
}
