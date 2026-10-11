import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { RefreshCw, Sparkles, X, ArrowUpRight } from 'lucide-react';

interface VersionInfo {
    buildId: string;
    buildTime?: string;
}

export default function VersionUpdateBanner() {
    const location = useLocation();
    const [hasUpdate, setHasUpdate] = useState(false);
    const [isDismissed, setIsDismissed] = useState(false);
    const [isReloading, setIsReloading] = useState(false);
    const [countdown, setCountdown] = useState<number | null>(null);
    const currentBuildId = import.meta.env.VITE_APP_BUILD_ID;
    const isCheckingRef = useRef(false);
    const handleReload = useCallback(() => {
        setIsReloading(true);
        window.location.reload();
    }, []);

    // Identifica se o usuário está em uma partida ativa (host ou jogador)
    const isInGame = location.pathname.startsWith('/host/') || location.pathname.startsWith('/play/');

    const checkForUpdates = useCallback(async () => {
        // Ignora em modo de desenvolvimento local ou se já estiver recarregando
        if (!currentBuildId || isReloading || isCheckingRef.current) return;

        isCheckingRef.current = true;
        try {
            const res = await fetch(`/version.json?t=${Date.now()}`, {
                cache: 'no-store',
                headers: {
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache'
                }
            });

            if (res.ok) {
                const data: VersionInfo = await res.json();
                if (data.buildId && data.buildId !== currentBuildId) {
                    setHasUpdate(true);
                }
            }
        } catch (_) {
            // Silencioso em caso de falha transitória de rede
        } finally {
            isCheckingRef.current = false;
        }
    }, [currentBuildId, isReloading]);

    // 1. Verificação periódica e na inicialização
    useEffect(() => {
        // Primeira verificação após 3 segundos da inicialização
        const initialTimer = setTimeout(() => {
            checkForUpdates();
        }, 3000);

        // Polling regular a cada 30 segundos
        const interval = setInterval(() => {
            checkForUpdates();
        }, 30000);

        return () => {
            clearTimeout(initialTimer);
            clearInterval(interval);
        };
    }, [checkForUpdates]);

    // 2. Verificação ao mudar de rota ou ao reativar a aba (visibilitychange)
    useEffect(() => {
        checkForUpdates();

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                checkForUpdates();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('focus', handleVisibilityChange);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('focus', handleVisibilityChange);
        };
    }, [location.pathname, checkForUpdates]);

    // 3. Contagem regressiva suave para atualização se o usuário estiver ocioso na Home
    useEffect(() => {
        if (hasUpdate && !isInGame && !isDismissed && location.pathname === '/') {
            setCountdown(12); // 12 segundos para dar tempo do usuário ler
            const timer = setInterval(() => {
                setCountdown((prev) => {
                    if (prev === null) return null;
                    if (prev <= 1) {
                        clearInterval(timer);
                        handleReload();
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);

            return () => clearInterval(timer);
        } else {
            setCountdown(null);
        }
    }, [hasUpdate, isInGame, isDismissed, location.pathname, handleReload]);

    if (!hasUpdate) return null;

    // Se estiver em jogo ativo, exibe apenas uma pílula discreta para não desconectar a partida
    if (isInGame) {
        return (
            <div className="fixed top-2 right-2 z-50 animate-fade-in pointer-events-auto">
                <div className="bg-[#1f1a14]/90 backdrop-blur-md border border-amber-500/40 text-amber-200 text-xs px-3 py-1.5 rounded-full flex items-center gap-2 shadow-lg">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                    <span>Nova versão disponível (atualize após a partida)</span>
                    <button
                        onClick={handleReload}
                        title="Atualizar agora mesmo"
                        className="underline hover:text-white font-bold ml-1 flex items-center gap-0.5"
                    >
                        Atualizar <ArrowUpRight className="w-3 h-3" />
                    </button>
                </div>
            </div>
        );
    }

    // Se o usuário dispensou a caixa principal na Home, deixa um botão flutuante discreto
    if (isDismissed) {
        return (
            <button
                onClick={handleReload}
                title="Nova versão do Mind Arena disponível! Clique para carregar."
                className="fixed bottom-4 right-4 z-50 bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 text-black font-black px-4 py-2.5 rounded-2xl shadow-[0_4px_25px_rgba(245,197,24,0.4)] flex items-center gap-2 transition-all hover:scale-105 active:scale-95 animate-bounce-in"
            >
                <RefreshCw className={`w-4 h-4 ${isReloading ? 'animate-spin' : ''}`} />
                <span className="text-xs uppercase tracking-wider">Nova Versão Disponível</span>
            </button>
        );
    }

    // Banner principal elegante no Coliseu da Mente
    return (
        <div 
            role="alert" 
            aria-live="polite"
            className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-lg animate-slide-up shadow-[0_10px_40px_rgba(0,0,0,0.8)]"
        >
            <div className="bg-[#171512]/95 backdrop-blur-xl border border-amber-500/50 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4 text-white">
                <div className="flex items-center gap-3.5 w-full sm:w-auto">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/10 border border-amber-500/40 flex items-center justify-center shrink-0 shadow-inner">
                        <Sparkles className="w-5 h-5 text-amber-400 animate-pulse" />
                    </div>
                    <div className="flex-1 text-left">
                        <h4 className="text-sm font-black text-gradient-gold tracking-wide uppercase flex items-center gap-1.5">
                            Nova Versão Disponível
                            {countdown !== null && (
                                <span className="text-[10px] bg-amber-500/20 border border-amber-500/40 text-amber-300 px-2 py-0.5 rounded-full font-mono font-bold lowercase">
                                    em {countdown}s
                                </span>
                            )}
                        </h4>
                        <p className="text-xs text-stone-300 font-medium leading-relaxed">
                            O Mind Arena foi atualizado com novas melhorias.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                    <button
                        onClick={() => {
                            setIsDismissed(true);
                            setCountdown(null);
                        }}
                        className="px-3 py-2 text-xs font-semibold text-stone-400 hover:text-white rounded-xl hover:bg-stone-800/60 transition-colors"
                        title="Adiar atualização"
                    >
                        Depois
                    </button>
                    
                    <button
                        onClick={handleReload}
                        disabled={isReloading}
                        className="btn-gold !py-2 !px-4 text-xs font-black uppercase tracking-wider flex items-center gap-2 shrink-0 shadow-lg active:scale-95"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${isReloading ? 'animate-spin' : ''}`} />
                        <span>{isReloading ? 'Carregando...' : 'Atualizar Agora'}</span>
                    </button>

                    <button
                        onClick={() => {
                            setIsDismissed(true);
                            setCountdown(null);
                        }}
                        aria-label="Fechar aviso de atualização"
                        className="p-1.5 text-stone-400 hover:text-stone-200 rounded-lg hover:bg-stone-800/50 transition-colors sm:hidden"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}
