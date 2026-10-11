import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Play, Plus, Users, Crown, Zap, Sparkles, X, QrCode, Loader2, AlertCircle, Shield, Check } from 'lucide-react';
import { useState, useEffect, useRef, useMemo } from 'react';
import { api } from '../services/api';
import { GLADIATOR_AVATARS, DEFAULT_AVATAR, getAvatarInfo } from '../constants/avatars';
import type { QuizSummary } from '../types';
import { useOrganizer } from '../contexts/OrganizerAccess';
import logo from '../assets/logo.png';

export default function Home() {
    const navigate = useNavigate();
    const { authorize, signedIn, logout } = useOrganizer();
    const [searchParams] = useSearchParams();
    const [gameCode, setGameCode] = useState('');
    const [nickname, setNickname] = useState('');
    const [selectedAvatar, setSelectedAvatar] = useState(DEFAULT_AVATAR);
    const [fromQrCode, setFromQrCode] = useState(false);
    const [quizzes, setQuizzes] = useState<QuizSummary[]>([]);
    const [quizPage, setQuizPage] = useState(0);
    const [moreQuizzes, setMoreQuizzes] = useState(false);
    const [loadingQuizzes, setLoadingQuizzes] = useState(false);
    const [catalogError, setCatalogError] = useState('');
    const [loading, setLoading] = useState(false);
    const [joinError, setJoinError] = useState<string | null>(null);
    const [selectedQuizToHost, setSelectedQuizToHost] = useState<QuizSummary | null>(null);
    const [enablePowers, setEnablePowers] = useState(false);
    const [creatingGame, setCreatingGame] = useState(false);
    const [hostError, setHostError] = useState<string | null>(null);

    // Controle de Abas Mobile (< md): Aluno como foco padrão (95% dos acessos mobile)
    const [activeMobileTab, setActiveMobileTab] = useState<'player' | 'host'>('player');

    // Refs para gerenciamento acessível de foco no Modal (WCAG 2.4.3)
    const modalRef = useRef<HTMLDivElement>(null);
    const triggerButtonRef = useRef<HTMLButtonElement | null>(null);

    useEffect(() => {
        const codeParam = searchParams.get('code');
        if (codeParam) {
            setGameCode(codeParam.toUpperCase().trim());
            setFromQrCode(true);
            setActiveMobileTab('player');
        }
    }, [searchParams]);

    useEffect(() => {
        api.get('/quizzes')
            .then(res => { setQuizzes(res.data); setMoreQuizzes(res.data.length === 50); })
            .catch(() => setCatalogError('Não foi possível carregar os quizzes. Atualize a página para tentar novamente.'));
    }, []);

    const loadMoreQuizzes = async () => {
        setLoadingQuizzes(true); setCatalogError('');
        try {
            const response = await api.get(`/quizzes?page=${quizPage + 1}&size=50`);
            setQuizzes(previous => [...previous, ...response.data.filter((quiz: QuizSummary) => !previous.some(item => item.id === quiz.id))]);
            setQuizPage(quizPage + 1); setMoreQuizzes(response.data.length === 50);
        } catch { setCatalogError('Não foi possível carregar mais quizzes. Tente novamente.'); }
        finally { setLoadingQuizzes(false); }
    };

    // Verificação de Dicas Memoizada (Sem IIFE no render)
    const allQuestionsHaveHints = useMemo(() => {
        return Boolean(selectedQuizToHost?.allHaveHints);
    }, [selectedQuizToHost]);

    const closeHostModal = () => {
        setSelectedQuizToHost(null);
        setHostError(null);
        setTimeout(() => triggerButtonRef.current?.focus(), 50);
    };

    // Fechar modal ao pressionar tecla ESC (WCAG 2.1.2)
    useEffect(() => {
        if (!selectedQuizToHost) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !creatingGame) {
                closeHostModal();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        modalRef.current?.focus();

        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedQuizToHost, creatingGame]);

    const handleJoin = async (e: React.FormEvent) => {
        e.preventDefault();
        setJoinError(null);
        if (gameCode.trim() && nickname.trim()) {
            setLoading(true);
            try {
                const res = await api.post(`/games/${gameCode.trim().toUpperCase()}/players`, {
                    nickname: nickname.trim(),
                    avatar: selectedAvatar || 'centurion'
                });
                if (res.data?.playerToken) {
                    sessionStorage.setItem(`player_token_${gameCode.toUpperCase().trim()}`, res.data.playerToken);
                }
                sessionStorage.setItem(`player_id_${gameCode.toUpperCase().trim()}`, String(res.data.id));
                navigate(`/play/${gameCode.trim().toUpperCase()}`, { state: { player: res.data } });
            } catch (error: any) {
                setJoinError(error.response?.data?.message || "Ops! Não foi possível entrar nessa partida. Verifique o código e tente novamente.");
                setLoading(false);
            }
        }
    };

    const openHostModal = (quiz: QuizSummary, buttonEl: HTMLButtonElement) => {
        triggerButtonRef.current = buttonEl;
        setSelectedQuizToHost(quiz);
        setHostError(null);
        setEnablePowers(quiz.allHaveHints);
    };

    const confirmHostGame = async () => {
        if (!selectedQuizToHost?.id) return;
        setCreatingGame(true);
        setHostError(null);
        if (!await authorize()) { setCreatingGame(false); return; }
        try {
            const res = await api.post(`/games/quiz/${selectedQuizToHost.id}`, {
                powersEnabled: enablePowers
            });
            if (res.data?.hostToken) {
                sessionStorage.setItem(`host_token_${res.data.code}`, res.data.hostToken);
            }
            navigate(`/host/${res.data.code}`, { state: { hostToken: res.data?.hostToken } });
        } catch (error: any) {
            setHostError(error.response?.data?.message || "Erro ao criar partida. Tente novamente.");
            setCreatingGame(false);
        }
    };

    const activeGladiator = useMemo(() => getAvatarInfo(selectedAvatar), [selectedAvatar]);

    return (
        <div className="flex flex-col items-center pt-2 sm:pt-4 md:pt-6 pb-12 animate-fade-in w-full max-w-4xl mx-auto px-1 sm:px-2">

            {/* 1. HERO SECTION CINEMATOGRÁFICA & EQUILIBRADA */}
            <div className="text-center mb-5 sm:mb-7 md:mb-8 animate-fade-in-up">
                <div className="relative inline-block mb-3 sm:mb-4">
                    <img
                        src={logo}
                        alt="Emblema Imperial Mind Arena"
                        className="w-24 h-24 sm:w-32 sm:h-32 md:w-44 md:h-44 mx-auto drop-shadow-[0_12px_28px_rgba(234,179,8,0.35)] animate-float object-contain"
                    />
                    <div className="absolute inset-0 bg-radial-gradient from-arena-500/20 to-transparent blur-xl pointer-events-none -z-10" />
                </div>

                {/* Slogan com Frisos e Divisores Heráldicos Clássicos */}
                <div className="flex items-center justify-center gap-2 sm:gap-3 text-neutral-300 text-xs sm:text-sm md:text-base font-semibold tracking-wider uppercase">
                    <span className="text-arena-500 text-xs sm:text-sm" aria-hidden="true">◆</span>
                    <span className="h-px w-6 sm:w-12 bg-gradient-to-r from-transparent to-arena-500/40" />
                    <span className="flex items-center gap-1.5 text-arena-200">
                        <Zap className="w-4 h-4 text-arena-400 shrink-0" aria-hidden="true" />
                        Desafie sua mente. Domine a arena.
                        <Zap className="w-4 h-4 text-arena-400 shrink-0" aria-hidden="true" />
                    </span>
                    <span className="h-px w-6 sm:w-12 bg-gradient-to-l from-transparent to-arena-500/40" />
                    <span className="text-arena-500 text-xs sm:text-sm" aria-hidden="true">◆</span>
                </div>
            </div>

            {/* 2. SELECTOR DE ABAS MOBILE (EXCLUSIVO PARA DISPOSITIVOS MÓVEIS < md) */}
            <div className="flex md:hidden w-full max-w-sm p-1.5 mb-5 bg-dark-900/90 border border-dark-600/70 rounded-2xl shadow-lg">
                <button
                    type="button"
                    onClick={() => setActiveMobileTab('player')}
                    className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all touch-manipulation ${
                        activeMobileTab === 'player'
                            ? 'bg-gradient-gold-metallic text-dark-950 shadow-md font-black scale-[1.02]'
                            : 'text-neutral-400 hover:text-white'
                    }`}
                >
                    <Users className="w-4 h-4" />
                    Entrar na Arena
                </button>
                <button
                    type="button"
                    onClick={() => setActiveMobileTab('host')}
                    className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all touch-manipulation ${
                        activeMobileTab === 'host'
                            ? 'bg-gradient-gold-metallic text-dark-950 shadow-md font-black scale-[1.02]'
                            : 'text-neutral-400 hover:text-white'
                    }`}
                >
                    <Crown className="w-4 h-4" />
                    Área do Professor
                </button>
            </div>

            {/* 3. DUAL CARDS CONTAINER (GRID 2 COLUNAS NO DESKTOP, SELETOR CONDICIONAL NO MOBILE) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6 w-full">

                {/* ──── ÁREA DO ALUNO (ENTRADA DO DESAFIANTE) ──── */}
                <section
                    aria-labelledby="student-heading"
                    className={`card-arena card-arena-beveled p-5 sm:p-7 md:p-8 flex flex-col items-center animate-fade-in-up transition-all ${
                        activeMobileTab === 'player' ? 'flex' : 'hidden md:flex'
                    }`}
                    style={{ animationDelay: '0.1s' }}
                >
                    <div className="w-14 h-14 sm:w-16 sm:h-16 bg-arena-500/10 rounded-2xl flex items-center justify-center mb-4 sm:mb-5 border border-arena-500/30 shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)]">
                        <Users className="w-7 h-7 sm:w-8 sm:h-8 text-arena-400" aria-hidden="true" />
                    </div>
                    <h2 id="student-heading" className="text-xl sm:text-2xl font-black mb-1 text-gradient-gold text-center tracking-wide">
                        ENTRAR NA ARENA
                    </h2>
                    <p className="text-neutral-300 text-xs sm:text-sm mb-5 sm:mb-6 text-center">
                        Digite o código fornecido pelo professor
                    </p>

                    <form onSubmit={handleJoin} className="w-full space-y-3.5 sm:space-y-4" noValidate>
                        {fromQrCode && (
                            <div
                                role="status"
                                aria-live="polite"
                                className="bg-arena-500/15 border border-arena-500/40 text-arena-300 text-xs font-bold py-2 px-3.5 rounded-xl flex items-center justify-center gap-2 animate-bounce-in shadow-sm"
                            >
                                <QrCode className="w-4 h-4 text-arena-400 shrink-0" aria-hidden="true" />
                                <span>Conectado via QR Code!</span>
                            </div>
                        )}

                        {joinError && (
                            <div
                                role="alert"
                                aria-live="assertive"
                                className="bg-red-500/15 border border-red-500/40 text-red-300 text-xs font-semibold p-3.5 rounded-xl flex items-start gap-2.5 animate-shake"
                            >
                                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" aria-hidden="true" />
                                <span>{joinError}</span>
                            </div>
                        )}

                        {/* Input Código da Partida */}
                        <div>
                            <label htmlFor="game-code-input" className="block text-xs font-bold text-neutral-300 uppercase tracking-wider mb-1.5 text-left">
                                Código da Partida <span className="text-arena-400">*</span>
                            </label>
                            <input
                                id="game-code-input"
                                name="gameCode"
                                type="text"
                                placeholder="EX: 489201"
                                aria-label="Código da Partida de 6 caracteres"
                                className="input-arena text-center text-xl sm:text-2xl font-black uppercase tracking-[0.3em] py-3 sm:py-3.5 bg-dark-950/90 border border-dark-600/70 focus:border-arena-400 shadow-inner rounded-xl"
                                value={gameCode}
                                onChange={(e) => setGameCode(e.target.value.toUpperCase())}
                                maxLength={6}
                                autoCapitalize="characters"
                                autoCorrect="off"
                                spellCheck={false}
                                enterKeyHint="next"
                                required
                                aria-required="true"
                            />
                        </div>

                        {/* Input Apelido */}
                        <div>
                            <label htmlFor="nickname-input" className="block text-xs font-bold text-neutral-300 uppercase tracking-wider mb-1.5 text-left">
                                Seu Nome de Gladiador <span className="text-arena-400">*</span>
                            </label>
                            <input
                                id="nickname-input"
                                name="nickname"
                                type="text"
                                placeholder="Como quer ser anunciado"
                                aria-label="Seu apelido"
                                className="input-arena text-center text-base sm:text-lg font-bold py-3 sm:py-3.5 bg-dark-950/90 border border-dark-600/70 focus:border-arena-400 rounded-xl"
                                value={nickname}
                                onChange={(e) => setNickname(e.target.value)}
                                maxLength={15}
                                autoCapitalize="words"
                                autoCorrect="off"
                                spellCheck={false}
                                enterKeyHint="go"
                                required
                                aria-required="true"
                            />
                        </div>

                        {/* 4. SELEÇÃO DE GLADIADORES — THE IMPERIAL ARMORY */}
                        <div className="pt-1.5 w-full">
                            {/* Cabeçalho da Classe Selecionada — Alinhamento Perfeito, Alto Contraste e Miniatura */}
                            <div className="flex items-center justify-between mb-3 px-0.5 w-full">
                                <span className="text-neutral-300 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                                    <Shield className="w-3.5 h-3.5 text-arena-400" aria-hidden="true" />
                                    Classe de Batalha:
                                </span>
                                <div className="flex items-center gap-2 bg-dark-900/90 border border-arena-500/40 px-3 py-1 rounded-full shadow-md">
                                    <img
                                        src={activeGladiator.image}
                                        alt={activeGladiator.name}
                                        className="w-5 h-5 rounded-full object-cover ring-1 ring-arena-400/70 shrink-0"
                                    />
                                    <span className="text-xs font-black text-gradient-gold">
                                        {activeGladiator.name}
                                    </span>
                                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-arena-300 bg-arena-500/20 px-2 py-0.5 rounded-md border border-arena-500/30">
                                        {activeGladiator.title}
                                    </span>
                                </div>
                            </div>

                            {/* Grid 3x3 com 9 Classes Heráldicas Ilustradas em Alta Resolução */}
                            <div
                                role="radiogroup"
                                aria-label="Escolha sua classe de gladiador"
                                className="grid grid-cols-3 gap-2 sm:gap-2.5 mb-4"
                            >
                                {GLADIATOR_AVATARS.map(av => {
                                    const isSelected = selectedAvatar === av.id || selectedAvatar === av.name || selectedAvatar === av.fallbackEmoji;
                                    return (
                                        <button
                                            type="button"
                                            key={av.id}
                                            role="radio"
                                            aria-checked={isSelected}
                                            aria-label={`${av.name} (${av.title}) - ${av.motto} ${isSelected ? '(selecionado)' : ''}`}
                                            tabIndex={isSelected ? 0 : -1}
                                            onClick={() => setSelectedAvatar(av.id)}
                                            onKeyDown={(e) => {
                                                if (e.key === ' ' || e.key === 'Enter') {
                                                    e.preventDefault();
                                                    setSelectedAvatar(av.id);
                                                }
                                            }}
                                            className={`relative p-2 rounded-2xl border flex flex-col items-center justify-center transition-all touch-manipulation active:scale-95 sheen-overlay select-none cursor-pointer group ${
                                                isSelected
                                                    ? 'bg-gradient-to-b from-arena-500/25 via-dark-800 to-dark-900 border-arena-400 shadow-lg glow-gold text-white scale-[1.03] z-10'
                                                    : 'bg-dark-900/80 border-dark-600/50 hover:border-arena-500/40 text-neutral-300 hover:text-white active:bg-dark-700'
                                            }`}
                                        >
                                            {/* Aura temática suave de iluminação */}
                                            <div
                                                className={`absolute inset-0 rounded-2xl pointer-events-none transition-opacity duration-300 ${
                                                    isSelected ? 'opacity-35' : 'opacity-0 group-hover:opacity-15'
                                                }`}
                                                style={{
                                                    background: `radial-gradient(circle at 50% 35%, ${av.elementColor}, transparent 70%)`
                                                }}
                                            />

                                            {/* Indicador heráldico de seleção ativa no canto superior direito (sem corte de overflow) */}
                                            {isSelected && (
                                                <div
                                                    className="absolute top-1.5 right-1.5 w-4 h-4 sm:w-5 sm:h-5 bg-gradient-gold-metallic text-dark-950 rounded-full flex items-center justify-center shadow-md animate-scale-in z-20"
                                                    aria-hidden="true"
                                                >
                                                    <Check className="w-2.5 h-2.5 sm:w-3 sm:h-3 stroke-[3]" />
                                                </div>
                                            )}

                                            {/* Avatar Ilustrado em Alta Resolução */}
                                            <div
                                                className="relative w-11 h-11 sm:w-13 sm:h-13 mb-1.5 rounded-full overflow-hidden p-0.5 ring-1 transition-transform group-hover:scale-105 shrink-0"
                                                style={{
                                                    borderColor: isSelected ? '#ffd740' : 'rgba(255, 255, 255, 0.15)',
                                                    boxShadow: isSelected ? `0 0 12px ${av.elementColor}66` : 'none'
                                                }}
                                            >
                                                <img
                                                    src={av.image}
                                                    alt={av.name}
                                                    className="w-full h-full object-cover rounded-full pointer-events-none"
                                                    loading="lazy"
                                                />
                                            </div>

                                            {/* Nome da Classe */}
                                            <span className={`text-[11px] sm:text-xs font-black tracking-tight truncate max-w-full transition-colors ${
                                                isSelected ? 'text-arena-300' : 'text-neutral-200 group-hover:text-white'
                                            }`}>
                                                {av.name}
                                            </span>

                                            {/* Arquétipo / Título */}
                                            <span className="text-[9px] sm:text-[10px] font-semibold text-neutral-400 group-hover:text-neutral-300 truncate max-w-full">
                                                {av.title}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Botão de Submissão Primário */}
                        <button
                            type="submit"
                            disabled={gameCode.length < 3 || nickname.length < 2 || loading}
                            aria-busy={loading}
                            className="btn-primary w-full min-h-[52px] sm:min-h-[56px] flex items-center justify-center gap-2.5 sm:gap-3 text-base sm:text-lg font-black touch-manipulation active:scale-95 sheen-overlay shadow-lg cursor-pointer"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 animate-spin text-dark-900" />
                                    <span>ENTRANDO NA ARENA...</span>
                                </>
                            ) : (
                                <>
                                    <Play className="w-5 h-5 sm:w-6 sm:h-6 fill-current" aria-hidden="true" />
                                    <span>JOGAR AGORA</span>
                                </>
                            )}
                        </button>
                    </form>
                </section>

                {/* ──── ÁREA DO PROFESSOR (CAMAROTE IMPERIAL) ──── */}
                <section
                    aria-labelledby="teacher-heading"
                    className={`card-arena card-arena-beveled p-5 sm:p-7 md:p-8 flex flex-col items-center animate-fade-in-up transition-all ${
                        activeMobileTab === 'host' ? 'flex' : 'hidden md:flex'
                    }`}
                    style={{ animationDelay: '0.2s' }}
                >
                    <div className="w-14 h-14 sm:w-16 sm:h-16 bg-arena-500/10 rounded-2xl flex items-center justify-center mb-4 sm:mb-5 border border-arena-500/30 shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)]">
                        <Crown className="w-7 h-7 sm:w-8 sm:h-8 text-arena-400" aria-hidden="true" />
                    </div>
                    <h2 id="teacher-heading" className="text-xl sm:text-2xl font-black mb-1 text-gradient-gold text-center tracking-wide">
                        ÁREA DO PROFESSOR
                    </h2>
                    <p className="text-neutral-300 text-xs sm:text-sm mb-5 sm:mb-6 text-center">
                        Crie quizzes e inicie partidas ao vivo
                    </p>

                    {signedIn && <button type="button" onClick={() => void logout()} className="mb-3 text-sm text-dark-300 underline">
                        Sair do acesso de organizador
                    </button>}
                    <Link
                        to="/create-quiz"
                        className="btn-primary w-full min-h-[50px] sm:min-h-[54px] flex items-center justify-center gap-2 mb-5 sm:mb-6 text-base sm:text-lg touch-manipulation active:scale-95 sheen-overlay"
                    >
                        <Plus className="w-5 h-5 sm:w-6 sm:h-6" /> CRIAR NOVO QUIZ
                    </Link>

                    <div className="w-full text-left">
                        <h3 className="text-xs font-bold text-neutral-300 mb-2.5 sm:mb-3 uppercase tracking-widest flex items-center gap-2">
                            <Sparkles className="w-3.5 h-3.5 text-arena-500" aria-hidden="true" />
                            Quizzes Disponíveis ({quizzes.length})
                        </h3>
                        <div
                            tabIndex={0}
                            aria-label="Lista de quizzes disponíveis para iniciar"
                            className="space-y-2.5 max-h-56 sm:max-h-60 overflow-y-auto pr-1 custom-scrollbar focus-visible:ring-1 focus-visible:ring-arena-400 rounded-xl"
                        >
                            {quizzes.map(q => (
                                <div
                                    key={q.id}
                                    className="bg-dark-900/60 p-3.5 sm:p-4 rounded-xl border border-dark-600/40 flex justify-between items-center group hover:border-arena-500/40 transition-all duration-200"
                                >
                                    <div className="truncate pr-3 min-w-0">
                                        <div className="font-bold text-white text-sm sm:text-base truncate group-hover:text-arena-200 transition-colors">
                                            {q.title}
                                        </div>
                                        <div className="text-xs text-neutral-400">
                                            {q.questionCount} perguntas
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={(e) => openHostModal(q, e.currentTarget)}
                                        aria-label={`Iniciar partida com quiz: ${q.title}`}
                                        className="bg-arena-500/15 text-arena-300 hover:bg-gradient-gold-metallic hover:text-dark-950 px-3.5 sm:px-4 py-2 rounded-lg font-black text-xs sm:text-sm transition-all duration-200 shrink-0 border border-arena-500/30 hover:border-arena-400 touch-manipulation active:scale-95"
                                    >
                                        INICIAR
                                    </button>
                                </div>
                            ))}
                            {quizzes.length === 0 && (
                                <div className="text-center text-neutral-400 text-xs sm:text-sm py-8 italic border border-dashed border-dark-600/40 rounded-xl">
                                    Nenhum quiz cadastrado ainda. Crie o primeiro acima!
                                </div>
                            )}
                            {moreQuizzes && <button type="button" disabled={loadingQuizzes} onClick={loadMoreQuizzes}
                                className="w-full p-3 rounded-xl bg-dark-700 text-arena-300 font-bold">
                                {loadingQuizzes ? 'Carregando...' : 'Carregar mais quizzes'}
                            </button>}
                        </div>
                        {catalogError && <p role="alert" className="text-red-400 text-sm mt-3">{catalogError}</p>}
                    </div>
                </section>

            </div>

            {/* 5. MODAL DE CONFIGURAÇÃO DA PARTIDA (ACESSÍVEL & BLINDADO) */}
            {selectedQuizToHost && (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="modal-host-title"
                    className="fixed inset-0 bg-dark-900/85 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-4 animate-fade-in overflow-y-auto"
                    onClick={(e) => {
                        if (e.target === e.currentTarget && !creatingGame) closeHostModal();
                    }}
                >
                    <div
                        ref={modalRef}
                        tabIndex={-1}
                        className="card-arena card-arena-beveled p-5 sm:p-7 md:p-8 w-full max-w-lg glow-gold animate-scale-in relative border border-arena-600/40 max-h-[92dvh] overflow-y-auto custom-scrollbar my-auto outline-none"
                    >
                        <button
                            type="button"
                            onClick={closeHostModal}
                            disabled={creatingGame}
                            aria-label="Fechar configurações da partida"
                            className="absolute top-3 right-3 sm:top-4 sm:right-4 text-neutral-300 hover:text-white p-2 rounded-lg hover:bg-dark-700 transition-colors focus-visible:ring-2 focus-visible:ring-arena-400 focus-visible:outline-none disabled:opacity-40 touch-manipulation"
                        >
                            <X className="w-5 h-5" aria-hidden="true" />
                        </button>

                        <div className="flex items-center gap-3 mb-4 sm:mb-5">
                            <div className="w-11 h-11 sm:w-12 sm:h-12 bg-arena-500/10 rounded-xl flex items-center justify-center border border-arena-500/30 text-arena-400 shrink-0">
                                <Crown className="w-5 h-5 sm:w-6 sm:h-6" aria-hidden="true" />
                            </div>
                            <div>
                                <h2 id="modal-host-title" className="text-xl sm:text-2xl font-black text-gradient-gold">CRIAR PARTIDA</h2>
                                <p className="text-neutral-400 text-[11px] sm:text-xs font-semibold uppercase tracking-wider">Configurações da Arena</p>
                            </div>
                        </div>

                        {hostError && (
                            <div
                                role="alert"
                                aria-live="assertive"
                                className="bg-red-500/15 border border-red-500/40 text-red-300 text-xs font-semibold p-3.5 rounded-xl mb-4 flex items-center gap-2.5 animate-shake"
                            >
                                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" aria-hidden="true" />
                                <span>{hostError}</span>
                            </div>
                        )}

                        {/* Quiz Info */}
                        <div className="bg-dark-900/60 p-3.5 sm:p-4 rounded-xl border border-dark-600/40 mb-4 sm:mb-6">
                            <span className="text-[10px] sm:text-xs text-neutral-400 font-bold uppercase tracking-wider block mb-1">Quiz Selecionado</span>
                            <h3 className="text-base sm:text-lg font-bold text-white mb-1 truncate">{selectedQuizToHost.title}</h3>
                            {selectedQuizToHost.description && (
                                <p className="text-neutral-400 text-xs mb-2.5 line-clamp-2">{selectedQuizToHost.description}</p>
                            )}
                            <span className="inline-block bg-arena-500/15 border border-arena-500/30 text-arena-300 text-xs font-bold px-2.5 py-1 rounded-md">
                                {selectedQuizToHost.questionCount} perguntas
                            </span>
                        </div>

                        {/* Configuração de Poderes */}
                        <div className="bg-gradient-to-br from-orange-500/10 via-dark-800 to-dark-900 p-3.5 sm:p-5 rounded-2xl border border-orange-500/30 mb-5 sm:mb-6">
                            <div className="flex items-center justify-between gap-2.5 sm:gap-3 mb-2 sm:mb-2.5">
                                <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1">
                                    <span className="text-lg sm:text-2xl shrink-0" aria-hidden="true">⚡</span>
                                    <div className="min-w-0">
                                        <h4 className="font-black text-white text-xs sm:text-base flex items-center gap-1.5 flex-wrap leading-tight">
                                            <span>Poderes dos Gladiadores</span>
                                            <span className={`text-[9px] sm:text-[10px] uppercase font-bold px-1.5 sm:px-2 py-0.5 rounded-full ${enablePowers ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' : 'bg-dark-600 text-neutral-300 border border-dark-500/30'}`}>
                                                {enablePowers ? 'ATIVADO' : 'DESATIVADO'}
                                            </span>
                                        </h4>
                                    </div>
                                </div>

                                {/* Toggle switch acessível */}
                                <button
                                    type="button"
                                    role="switch"
                                    aria-checked={enablePowers}
                                    aria-label="Ativar poderes especiais dos gladiadores"
                                    aria-describedby="hint-requirement-desc"
                                    disabled={!allQuestionsHaveHints && !enablePowers}
                                    onClick={() => setEnablePowers(!enablePowers)}
                                    className={`w-12 h-7 sm:w-14 sm:h-8 rounded-full relative transition-colors shrink-0 touch-manipulation focus-visible:ring-2 focus-visible:ring-arena-400 ${
                                        enablePowers ? 'bg-orange-500' : 'bg-dark-600'
                                    } ${!allQuestionsHaveHints && !enablePowers ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                                >
                                    <span
                                        className={`w-5 h-5 sm:w-6 sm:h-6 bg-white rounded-full absolute top-1 transition-transform block shadow-sm ${
                                            enablePowers ? 'translate-x-6 sm:translate-x-7' : 'translate-x-1'
                                        }`}
                                    />
                                </button>
                            </div>

                            <p className="text-[11px] sm:text-xs text-neutral-400 mb-2.5 sm:mb-3 leading-relaxed">
                                Cada jogador recebe 2 poderes na partida: <strong>Cegar oponente (2s)</strong> e <strong>Dica da pergunta</strong>.
                            </p>

                            <div id="hint-requirement-desc">
                                {allQuestionsHaveHints ? (
                                    <div className="text-[11px] sm:text-xs text-green-400 font-medium bg-green-500/10 border border-green-500/20 rounded-lg p-2.5 flex items-center gap-2">
                                        <span aria-hidden="true">✓</span>
                                        <span>Todas as perguntas possuem dicas cadastradas. Poderes disponíveis!</span>
                                    </div>
                                ) : (
                                    <div className="text-[11px] sm:text-xs text-amber-300 font-medium bg-amber-500/10 border border-amber-500/20 rounded-lg p-2.5 flex items-start gap-1.5">
                                        <span aria-hidden="true">⚠️</span>
                                        <span>Algumas perguntas deste quiz não têm dicas cadastradas. Cadastre dicas em todas as perguntas para ativar os poderes.</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Botões de Ação do Modal */}
                        <div className="flex gap-2.5 sm:gap-3">
                            <button
                                type="button"
                                onClick={closeHostModal}
                                disabled={creatingGame}
                                className="btn-secondary flex-1 py-2.5 sm:py-3 text-xs sm:text-sm font-bold touch-manipulation active:scale-95 disabled:opacity-40"
                            >
                                CANCELAR
                            </button>
                            <button
                                type="button"
                                onClick={confirmHostGame}
                                disabled={creatingGame}
                                aria-busy={creatingGame}
                                className="btn-primary flex-1 py-2.5 sm:py-3 text-sm sm:text-base flex items-center justify-center gap-2 font-black touch-manipulation active:scale-95 sheen-overlay"
                            >
                                {creatingGame ? (
                                    <>
                                        <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin text-dark-900" />
                                        <span>INICIANDO...</span>
                                    </>
                                ) : (
                                    <>
                                        <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current" aria-hidden="true" />
                                        <span>CRIAR PARTIDA</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
