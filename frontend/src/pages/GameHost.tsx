import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Users, Play, Trophy, ArrowRight, ArrowLeft, Timer, MessageSquare, SkipForward, Crown, Medal, Copy, QrCode, BarChart3, CheckCircle2, XCircle, FileText, Maximize, Minimize, Volume2, VolumeX, MoreHorizontal, Activity, ChevronDown } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { api } from '../services/api';
import { useGameConnection } from '../services/useGameConnection';
import { soundManager } from '../services/soundManager';
import { getRomanTitle } from '../utils/romanTitles';
import { useAccessibility } from '../contexts/AccessibilityContext';
import PedagogicalReportModal from '../components/PedagogicalReportModal';
import { AvatarImage } from '../components/AvatarImage';
import ArenaDiagnosticsPanel from '../components/ArenaDiagnosticsPanel';
import type { QuizSummary, Question, PedagogicalReport } from '../types';

interface Player {
    id: number;
    nickname: string;
    avatar?: string;
    score: number;
}

interface OptionStat {
    id: number;
    text: string;
    correct: boolean;
    count: number;
    percentage: number;
}

interface QuestionStats {
    questionId: number;
    questionText: string;
    questionIndex: number;
    totalAnswers: number;
    totalPlayers: number;
    correctCount: number;
    options: OptionStat[];
}

export default function GameHost() {
    const { code } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const {
        getOptionVisuals,
        speakQuestion,
        stopSpeaking,
        isSpeaking,
        ttsAutoPlay
    } = useAccessibility();
    const [status, setStatus] = useState('WAITING');
    const [players, setPlayers] = useState<Player[]>([]);
    const [joinLocked, setJoinLocked] = useState(false);
    const [quiz, setQuiz] = useState<QuizSummary | null>(null);
    const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
    const [questionIndex, setQuestionIndex] = useState(-1);
    const [answersCount, setAnswersCount] = useState(0);
    const [timeLeft, setTimeLeft] = useState(0);
    const [leaderboard, setLeaderboard] = useState<Player[]>([]);
    const [countdown, setCountdown] = useState(0);
    const [countdownDeadline, setCountdownDeadline] = useState(0);
    const [questionDeadline, setQuestionDeadline] = useState(0);
    const [powersEnabled, setPowersEnabled] = useState(false);
    const [questionStats, setQuestionStats] = useState<QuestionStats | null>(null);
    const [resultTab, setResultTab] = useState<'STATS' | 'LEADERBOARD'>('STATS');
    const [showReportModal, setShowReportModal] = useState(false);
    const [reportData, setReportData] = useState<PedagogicalReport | null>(null);
    const [loadingReport, setLoadingReport] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
    const [confirmRemoveId, setConfirmRemoveId] = useState<number | null>(null);
    const hostOptions = useRef<HTMLDetailsElement>(null);
    const handleGameEventRef = useRef<((event: any) => void) | null>(null);

    useEffect(() => {
        if (code && (location.state as any)?.hostToken) {
            sessionStorage.setItem(`host_token_${code}`, (location.state as any).hostToken);
        }
        if (code && !sessionStorage.getItem(`host_token_${code}`)) navigate('/');
    }, [code, location.state, navigate]);

    useEffect(() => {
        const onFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener('fullscreenchange', onFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
    }, []);

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => {});
        } else {
            document.exitFullscreen().catch(() => {});
        }
    };

    const renderProjectorButton = () => (
        <div className="no-print w-full max-w-4xl mx-auto flex items-center justify-end gap-2 mb-3 px-2">
            <button
                type="button"
                onClick={toggleFullscreen}
                className={`h-9 inline-flex items-center gap-2 px-3.5 rounded-xl border text-xs font-black tracking-wide uppercase transition-all shadow-sm cursor-pointer select-none ${
                    isFullscreen
                        ? 'bg-arena-500 text-dark-950 border-arena-400 shadow-arena-500/30'
                        : 'bg-dark-800/90 hover:bg-dark-700 text-arena-400 hover:text-arena-300 border-dark-600/70 hover:border-arena-500/50'
                }`}
                title={isFullscreen ? "Sair da Tela Cheia (Esc)" : "Ativar Modo Telão para Sala de Aula"}
            >
                {isFullscreen ? <Minimize className="w-3.5 h-3.5" /> : <Maximize className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">{isFullscreen ? "Sair do Telão" : "Modo Telão"}</span>
                <span className="sm:hidden">{isFullscreen ? "Sair" : "Telão"}</span>
            </button>
            <details ref={hostOptions} className="relative">
                <summary
                    aria-label="Opções do professor"
                    title="Opções do professor"
                    className="list-none cursor-pointer h-9 w-9 rounded-xl bg-dark-800/90 hover:bg-dark-700 border border-dark-600/70 hover:border-arena-500/50 text-dark-300 hover:text-arena-300 flex items-center justify-center transition-colors [&::-webkit-details-marker]:hidden"
                >
                    <MoreHorizontal className="w-4 h-4" />
                </summary>
                <div className="absolute right-0 top-full mt-2 w-52 bg-dark-800 border border-dark-600/80 rounded-xl p-2 shadow-2xl z-50">
                    <button
                        type="button"
                        onClick={() => { hostOptions.current?.removeAttribute('open'); setDiagnosticsOpen(true); }}
                        className="w-full text-left flex items-center gap-2.5 text-xs font-bold text-dark-200 hover:text-arena-300 p-2.5 rounded-lg hover:bg-dark-700 transition-colors cursor-pointer"
                    >
                        <Activity className="w-4 h-4 text-arena-400" /> Diagnóstico da arena
                    </button>
                </div>
            </details>
            {diagnosticsOpen && code && (
                <ArenaDiagnosticsPanel
                    code={code}
                    onEntriesChanged={refreshGame}
                    onClose={() => { setDiagnosticsOpen(false); hostOptions.current?.querySelector('summary')?.focus(); }}
                />
            )}
        </div>
    );

    const handleOpenReport = async () => {
        setShowReportModal(true);
        setLoadingReport(true);
        try {
            const res = await api.get(`/games/${code}/report`);
            setReportData(res.data);
        } catch (err: any) {
            alert(err.response?.data?.message || "Não foi possível carregar o relatório pedagógico.");
            setShowReportModal(false);
        } finally {
            setLoadingReport(false);
        }
    };

    useEffect(() => {
        handleGameEventRef.current = (event: any) => {
            switch (event.type) {
                case 'PLAYER_JOINED':
                    soundManager.playTick(1200);
                    setPlayers(prev => prev.some(p => p.id === event.payload.id) ? prev : [...prev, event.payload]);
                    break;
                case 'PLAYER_REMOVED':
                    setPlayers(previous => previous.filter(player => player.id !== Number(event.payload)));
                    setLeaderboard(previous => previous.filter(player => player.id !== Number(event.payload)));
                    break;
                case 'LOBBY_LOCKED':
                    setJoinLocked(event.payload);
                    break;
                case 'EXPIRED':
                    alert('Esta arena expirou. Crie uma nova partida.'); navigate('/');
                    break;
                case 'GAME_STARTED':
                    soundManager.stopLobbyMusic();
                    setStatus('STARTING');
                    setCountdown(3);
                    setCountdownDeadline(Date.now() + Math.max(0, 3000 - (event.payload.serverTime - event.payload.startTime)));
                    break;
                case 'QUESTION_STARTED':
                    soundManager.playStartFanfare();
                    setStatus('QUESTION_ACTIVE');
                    setCurrentQuestion(event.payload);
                    setQuestionIndex(event.payload.questionIndex);
                    setTimeLeft(event.payload.timeLimitSeconds);
                    setQuestionDeadline(Date.now() + Math.max(0, event.payload.startTime + event.payload.timeLimitSeconds * 1000 - event.payload.serverTime));
                    setAnswersCount(0);
                    setQuestionStats(null);
                    if (ttsAutoPlay && event.payload?.text) {
                        speakQuestion(event.payload.text, event.payload.options, event.payload.timeLimitSeconds);
                    }
                    break;
                case 'ANSWER_SUBMITTED':
                    soundManager.playTick(900);
                    setAnswersCount(prev => prev + 1);
                    break;
                case 'QUESTION_ENDED':
                    stopSpeaking();
                    soundManager.playStartFanfare();
                    setStatus('QUESTION_ENDED');
                    setResultTab('STATS');
                    const hostLeaderboard = Array.isArray(event.payload)
                        ? event.payload
                        : (event.payload?.leaderboard || []);
                    setLeaderboard(hostLeaderboard);
                    if (event.payload?.stats) {
                        setQuestionStats(event.payload.stats);
                    } else {
                        api.get(`/games/${code}/question-stats`).then(s => setQuestionStats(s.data)).catch(() => {});
                    }
                    break;
                case 'FINISHED':
                    stopSpeaking();
                    soundManager.playVictory();
                    setStatus('FINISHED');
                    const finalLeaderboard = Array.isArray(event.payload)
                        ? event.payload
                        : (event.payload?.leaderboard || []);
                    setLeaderboard(finalLeaderboard);
                    break;
            }
        };
    });

    const refreshGame = useGameConnection(code, undefined, game => {
            setStatus(game.status);
            setQuiz(game.quiz);
            setPlayers(game.players || []);
            setJoinLocked(Boolean(game.joinLocked));
            setPowersEnabled(game.powersEnabled || false);
            setLeaderboard(game.leaderboard || []);
            setQuestionIndex(game.currentQuestionIndex);
            setAnswersCount(game.answersCount || 0);
            if (game.status === 'STARTING') {
                const remaining = Math.max(0, game.currentQuestionStartTime + 3000 - game.serverTime);
                setCountdown(Math.ceil(remaining / 1000));
                setCountdownDeadline(game.receivedAt + remaining);
            }
            if (game.status === 'QUESTION_ACTIVE' || game.status === 'QUESTION_ENDED') {
                setCurrentQuestion(game.currentQuestion);
                const question = game.currentQuestion;
                const remaining = Math.max(0, game.currentQuestionStartTime + question.timeLimitSeconds * 1000 - game.serverTime);
                setTimeLeft(Math.ceil(remaining / 1000));
                setQuestionDeadline(game.receivedAt + remaining);
                if (game.status === 'QUESTION_ENDED') {
                    setQuestionStats(game.stats || null);
                }
            }
    }, event => {
        if (event.type === 'POWERS_TOGGLED') setPowersEnabled(event.payload);
        handleGameEventRef.current?.(event);
    }, error => {
        if ([403, 404, 410].includes(error.response?.status)) {
            alert(error.response.data.message || 'Partida indisponível.');
            navigate('/');
        }
    });

    useEffect(() => () => stopSpeaking(), [stopSpeaking]);

    const hostCommand = async (action: string) => {
        try {
            await api.post(`/games/${code}/${action}`, { questionIndex });
            refreshGame();
        } catch (error: any) {
            if (error.response?.status !== 409) alert(error.response?.data?.message || 'Não foi possível executar a ação.');
            refreshGame();
        }
    };

    // Lobby music
    useEffect(() => {
        if (status === 'WAITING') {
            soundManager.startLobbyMusic();
        } else {
            soundManager.stopLobbyMusic();
        }
        return () => {
            soundManager.stopLobbyMusic();
        };
    }, [status]);

    useEffect(() => {
        if (status !== 'STARTING') return;
        const timer = setInterval(() => setCountdown(Math.max(0, Math.ceil((countdownDeadline - Date.now()) / 1000))), 100);
        return () => clearInterval(timer);
    }, [status, countdownDeadline]);

    useEffect(() => {
        if (status !== 'QUESTION_ACTIVE') return;
        const timer = setInterval(() => setTimeLeft(Math.max(0, Math.ceil((questionDeadline - Date.now()) / 1000))), 100);
        return () => clearInterval(timer);
    }, [status, questionDeadline]);

    // Countdown 3-2-1
    useEffect(() => {
        if (status === 'STARTING' && countdown > 0) {
            soundManager.playTick(600 + (3 - countdown) * 200);
        }
    }, [countdown, status]);

    // Timer
    useEffect(() => {
        if (status === 'QUESTION_ACTIVE' && timeLeft > 0) {
            if (timeLeft <= 5) {
                soundManager.playUrgentTick();
            }
        }
    }, [timeLeft, status]);

    const togglePowers = async () => {
        const newState = !powersEnabled;
        try {
            await api.post(`/games/${code}/toggle-powers`, { enable: newState });
        } catch (error: any) {
            alert(error.response?.data?.message || "Erro ao ativar poderes.");
        }
    };

    const toggleLobby = async () => {
        try { await api.post(`/games/${code}/lobby-lock`, { enable: !joinLocked }); refreshGame(); }
        catch (error: any) { alert(error.response?.data?.message || 'Não foi possível alterar as entradas.'); }
    };

    const removeParticipant = async (id: number) => {
        try { await api.delete(`/games/${code}/players/${id}`); refreshGame(); }
        catch (error: any) { alert(error.response?.data?.message || 'Não foi possível remover o participante.'); }
    };

    const renderParticipantControls = () => {
        if (!['QUESTION_ACTIVE', 'QUESTION_ENDED', 'FINISHED'].includes(status)) return null;

        return (
            <div className="no-print w-full max-w-4xl mx-auto mb-4 px-2">
                <details className="group bg-dark-900/80 hover:bg-dark-900 border border-dark-600/70 open:border-arena-500/40 rounded-2xl shadow-md transition-all backdrop-blur-sm overflow-hidden">
                    <summary className="list-none cursor-pointer p-3 sm:px-4 flex items-center justify-between gap-3 text-sm select-none [&::-webkit-details-marker]:hidden">
                        <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-7 h-7 rounded-lg bg-arena-500/10 border border-arena-500/30 flex items-center justify-center shrink-0">
                                <Users className="w-4 h-4 text-arena-400" />
                            </div>
                            <span className="font-bold text-white text-sm">Gerenciar participantes</span>
                            <span className="text-[11px] font-black uppercase tracking-wider bg-dark-800 text-arena-300 border border-dark-600/80 px-2 py-0.5 rounded-full shrink-0">
                                {players.length} {players.length === 1 ? 'gladiador' : 'gladiadores'}
                            </span>
                        </div>
                        <div className="flex items-center gap-2 text-dark-400 group-hover:text-arena-400 transition-colors shrink-0">
                            <span className="text-xs font-semibold hidden sm:inline group-open:hidden">Expandir</span>
                            <span className="text-xs font-semibold hidden sm:inline hidden group-open:inline">Recolher</span>
                            <ChevronDown className="w-4 h-4 transition-transform duration-200 group-open:rotate-180" />
                        </div>
                    </summary>

                    <div className="border-t border-dark-700/60 p-3 sm:p-4 bg-dark-950/60">
                        {players.length === 0 ? (
                            <div className="text-center py-4 text-dark-400 text-xs italic">
                                Nenhum participante na arena no momento.
                            </div>
                        ) : (
                            <div className="max-h-56 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                                {players.map(participant => (
                                    <div
                                        key={participant.id}
                                        className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-dark-800/80 border border-dark-700/50 hover:border-dark-600 transition-colors"
                                    >
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <AvatarImage avatar={participant.avatar} className="w-7 h-7 ring-1 ring-arena-400/40 rounded-full shrink-0" />
                                            <div className="min-w-0">
                                                <span className="font-bold text-white text-sm block truncate max-w-[150px] sm:max-w-xs" title={participant.nickname}>
                                                    {participant.nickname}
                                                </span>
                                                <span className="text-[11px] font-black text-arena-400/90 block">
                                                    {participant.score || 0} pts
                                                </span>
                                            </div>
                                        </div>

                                        <div className="shrink-0">
                                            {confirmRemoveId === participant.id ? (
                                                <div className="flex items-center gap-1.5 animate-scale-in">
                                                    <span className="text-xs text-red-300 font-bold hidden xs:inline">Remover?</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            removeParticipant(participant.id);
                                                            setConfirmRemoveId(null);
                                                        }}
                                                        className="px-2.5 py-1 bg-red-600 hover:bg-red-500 text-white text-xs font-black rounded-lg shadow-sm transition-colors cursor-pointer"
                                                    >
                                                        Sim
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setConfirmRemoveId(null)}
                                                        className="px-2 py-1 bg-dark-700 hover:bg-dark-600 text-neutral-300 text-xs font-bold rounded-lg border border-dark-600 transition-colors cursor-pointer"
                                                    >
                                                        Cancelar
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={() => setConfirmRemoveId(participant.id)}
                                                    className="px-2.5 py-1 text-xs font-bold text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-lg transition-colors cursor-pointer"
                                                >
                                                    Remover
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </details>
            </div>
        );
    };

    if (!quiz) return (
        <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-dark-400 animate-pulse text-xl font-bold">Carregando arena...</div>
        </div>
    );

    // ──── LOBBY ────
    if (status === 'WAITING') {
        const canEnablePowers = quiz.allHaveHints;
        return (
            <div className="flex flex-col items-center pt-8 animate-fade-in">
                {renderProjectorButton()}{renderParticipantControls()}
                <div className="card-arena p-6 md:p-8 w-full max-w-2xl mb-8 glow-gold animate-scale-in flex flex-col md:flex-row items-center justify-between gap-6">
                    {/* Left: Code & Info */}
                    <div className="text-center md:text-left flex-1">
                        <span className="text-arena-400 font-bold tracking-[0.2em] text-xs uppercase block mb-1">
                            CÓDIGO DA ARENA
                        </span>
                        <div className="text-5xl md:text-6xl font-black text-gradient-gold tracking-[0.25em] py-2 select-all">
                            {code}
                        </div>
                        <p className="text-dark-300 text-sm mt-1 font-medium">
                            Acesse <span className="text-arena-400 font-bold underline">{window.location.host}</span> e digite o código acima.
                        </p>
                        <div className="mt-4 flex flex-wrap gap-2 justify-center md:justify-start">
                            <button
                                type="button"
                                onClick={() => {
                                    navigator.clipboard.writeText(`${window.location.origin}/?code=${code}`);
                                    alert("Link da arena copiado para a área de transferência!");
                                }}
                                className="text-xs bg-dark-700/80 hover:bg-dark-600 text-dark-300 hover:text-white px-3 py-1.5 rounded-lg border border-dark-500/40 transition-colors flex items-center gap-1.5 font-bold cursor-pointer"
                            >
                                <Copy className="w-3.5 h-3.5 text-arena-400" />
                                Copiar Link da Sala
                            </button>
                        </div>
                    </div>

                    {/* Right: QR Code */}
                    <div className="flex flex-col items-center bg-dark-900/90 p-4 rounded-2xl border border-arena-600/30 shadow-xl flex-shrink-0">
                        <div className="p-2.5 bg-white rounded-xl shadow-inner border border-arena-500/20">
                            <QRCodeSVG
                                value={`${window.location.origin}/?code=${code}`}
                                size={135}
                                bgColor="#ffffff"
                                fgColor="#0f0e0c"
                                level="M"
                            />
                        </div>
                        <span className="text-[11px] font-bold text-arena-400 mt-2.5 flex items-center gap-1">
                            <QrCode className="w-3.5 h-3.5 text-arena-500" />
                            Aponte a câmera do celular
                        </span>
                    </div>
                </div>

                <div className="mb-8 w-full max-w-lg bg-dark-900/80 p-3.5 sm:p-4 rounded-2xl border border-orange-500/30 flex items-center justify-between gap-3 shadow-lg backdrop-blur-md">
                    <div className="text-left min-w-0 flex-1">
                        <div className="text-orange-400 font-bold flex items-center gap-2 text-sm sm:text-base">
                            ⚡ Poderes dos Jogadores
                        </div>
                        <div className="text-dark-400 text-xs mt-1 font-semibold truncate">
                            {canEnablePowers ? "Cegar oponentes e revelar dicas." : "Requer dicas em TODAS as perguntas."}
                        </div>
                    </div>
                    <button
                        onClick={togglePowers}
                        disabled={!canEnablePowers && !powersEnabled}
                        className={`w-12 h-7 sm:w-14 sm:h-8 rounded-full relative transition-colors shrink-0 ${powersEnabled ? 'bg-orange-500' : 'bg-dark-600'} ${(!canEnablePowers && !powersEnabled) ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        <div className={`w-5 h-5 sm:w-6 sm:h-6 bg-white rounded-full absolute top-1 transition-transform ${powersEnabled ? 'translate-x-6 sm:translate-x-7' : 'translate-x-1'}`} />
                    </button>
                </div>

                <div className="flex items-center gap-3 mb-6 animate-fade-in-up">
                    <div className="w-10 h-10 bg-arena-500/10 rounded-xl flex items-center justify-center border border-arena-500/20">
                        <Users className="w-5 h-5 text-arena-400" />
                    </div>
                    <h3 className="text-2xl font-black">
                        <span className="text-gradient-gold">{players.length}</span>
                        <span className="text-dark-400 ml-2 font-bold text-lg">jogadores na arena</span>
                    </h3>
                </div>

                <button type="button" onClick={toggleLobby} className="mb-5 px-5 py-3 rounded-xl bg-dark-700 text-arena-300 font-bold">
                    {joinLocked ? '🔒 Entradas fechadas · Liberar' : '🔓 Fechar novas entradas'}
                </button>

                <div className="flex flex-wrap justify-center gap-2.5 mb-10 w-full max-w-3xl min-h-[80px]">
                    {players.map((p, i) => (
                        <div key={p.id}
                            className="bg-dark-700/90 border border-arena-600/30 px-3.5 py-1.5 rounded-full font-bold text-arena-200 shadow-md animate-player-join flex items-center gap-2"
                            style={{ animationDelay: `${i * 0.05}s` }}
                        >
                            <AvatarImage avatar={p.avatar} className="w-6 h-6 ring-1 ring-arena-400/50 shrink-0" />
                            <span className="truncate max-w-[140px]" title={p.nickname}>{p.nickname}</span>
                            {confirmRemoveId === p.id ? (
                                <span className="inline-flex items-center gap-1 ml-1 animate-scale-in">
                                    <button
                                        type="button"
                                        onClick={() => { removeParticipant(p.id); setConfirmRemoveId(null); }}
                                        className="px-2 py-0.5 text-[10px] bg-red-600 hover:bg-red-500 text-white rounded font-black cursor-pointer shadow-sm"
                                    >
                                        Sim
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setConfirmRemoveId(null)}
                                        className="px-1.5 py-0.5 text-[10px] bg-dark-600 hover:bg-dark-500 text-neutral-300 rounded font-semibold cursor-pointer"
                                    >
                                        Não
                                    </button>
                                </span>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => setConfirmRemoveId(p.id)}
                                    aria-label={`Remover ${p.nickname}`}
                                    className="ml-1 px-1.5 py-0.5 text-red-400 hover:text-red-300 rounded-lg hover:bg-dark-600 text-xs font-bold cursor-pointer transition-colors"
                                >
                                    ×
                                </button>
                            )}
                        </div>
                    ))}
                    {players.length === 0 && (
                        <div className="text-dark-500 italic mt-6 animate-pulse">Aguardando gladiadores entrarem...</div>
                    )}
                </div>

                <button
                    onClick={() => hostCommand('start')}
                    disabled={players.length === 0}
                    className="btn-primary flex items-center gap-3 text-xl px-14 py-5 rounded-2xl animate-fade-in-up"
                >
                    <Play className="w-7 h-7 fill-current" /> INICIAR ARENA
                </button>
            </div>
        );
    }

    // ──── CONTAGEM REGRESSIVA ────
    if (status === 'STARTING') {
        return (
            <div className="flex flex-col items-center justify-center min-h-[65vh]">
                {renderProjectorButton()}{renderParticipantControls()}
                {countdown > 0 ? (
                    <div key={countdown} className="animate-count-pop">
                        <span className="text-[12rem] font-black text-gradient-gold leading-none drop-shadow-2xl">{countdown}</span>
                    </div>
                ) : (
                    <h2 className="text-5xl font-black text-gradient-fire animate-bounce-in">VALENDO!</h2>
                )}
            </div>
        );
    }

    // ──── PERGUNTA ATIVA ────
    if (status === 'QUESTION_ACTIVE' && currentQuestion) {
        const totalQuestions = quiz?.questionCount || 0;
        const timerPercent = currentQuestion.timeLimitSeconds > 0 ? (timeLeft / currentQuestion.timeLimitSeconds) * 100 : 0;
        const answerPercent = players.length > 0 ? (answersCount / players.length) * 100 : 0;

        return (
            <div className="flex flex-col pt-4 animate-fade-in">
                {renderProjectorButton()}{renderParticipantControls()}
                {/* Top Bar - Centralização Rigorosa via Grid 3 Colunas */}
                <div className="grid grid-cols-3 items-center w-full max-w-4xl mx-auto mb-6 gap-2 sm:gap-4 px-2">
                    {/* Coluna 1: Pergunta X/Y */}
                    <div className="flex justify-start items-center">
                        <div className="card-arena px-3 sm:px-5 py-2 sm:py-3 flex items-center gap-2 sm:gap-3">
                            <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5 text-arena-400 shrink-0" />
                            <span className="font-black text-xs sm:text-sm text-dark-400 hidden xs:inline">PERGUNTA</span>
                            <span className="font-black text-base sm:text-xl text-gradient-gold tabular-nums">{questionIndex + 1}/{totalQuestions}</span>
                        </div>
                    </div>

                    {/* Coluna 2: Cronômetro Rigorosamente Centralizado */}
                    <div className="flex justify-center items-center">
                        <div className={`card-arena px-4 sm:px-6 py-2 sm:py-3 flex items-center gap-2 sm:gap-3 shadow-lg ${timeLeft <= 3 ? 'animate-timer-pulse border-red-500/50' : ''}`}>
                            <Timer className={`w-5 h-5 sm:w-6 sm:h-6 shrink-0 ${timeLeft <= 3 ? 'text-red-500' : 'text-arena-400'}`} />
                            <span className={`text-2xl sm:text-4xl font-black tabular-nums tracking-tight ${timeLeft <= 3 ? 'text-red-500' : 'text-white'}`}>{timeLeft}</span>
                        </div>
                    </div>

                    {/* Coluna 3: Respostas Enviadas */}
                    <div className="flex justify-end items-center">
                        <div className="card-arena px-3 sm:px-5 py-2 sm:py-3 flex items-center gap-2 sm:gap-3">
                            <Users className="w-4 h-4 sm:w-5 sm:h-5 text-arena-400 shrink-0" />
                            <span className="font-black text-base sm:text-xl text-arena-300 tabular-nums">{answersCount}</span>
                            <span className="text-dark-500 font-bold text-xs sm:text-base">/ {players.length}</span>
                        </div>
                    </div>
                </div>

                {/* Timer bar */}
                <div className="w-full max-w-4xl mx-auto px-2 mb-8">
                    <div className="w-full h-1.5 bg-dark-700 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-1000 ease-linear ${timeLeft <= 3 ? 'bg-red-500' : 'bg-arena-500'}`}
                            style={{ width: `${timerPercent}%` }} />
                    </div>
                </div>

                {/* Question */}
                <div className="text-center mb-8 animate-fade-in-down flex flex-col items-center">
                    <div className="flex items-center justify-center gap-3 mb-3">
                        <button
                            type="button"
                            onClick={() => {
                                if (isSpeaking) {
                                    stopSpeaking();
                                } else {
                                    speakQuestion(currentQuestion.text, currentQuestion.options, timeLeft);
                                }
                            }}
                            title={isSpeaking ? "Parar leitura por voz" : "Ouvir pergunta e alternativas em voz alta (pt-BR)"}
                            className="px-3.5 py-1.5 rounded-xl bg-dark-700/80 hover:bg-dark-600 border border-dark-500/40 text-arena-400 hover:text-white transition-all shadow-md active:scale-95 flex items-center gap-2"
                        >
                            {isSpeaking ? (
                                <>
                                    <VolumeX className="w-4 h-4 text-red-400 animate-pulse" />
                                    <span className="text-xs font-bold text-red-300">Parar Voz</span>
                                </>
                            ) : (
                                <>
                                    <Volume2 className="w-4 h-4 text-arena-400" />
                                    <span className="text-xs font-bold text-arena-300">Ler Questão</span>
                                </>
                            )}
                        </button>
                    </div>
                    <h2 className="text-3xl md:text-5xl font-black leading-tight max-w-4xl">{currentQuestion.text}</h2>
                </div>

                {/* Options */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {currentQuestion.options.map((opt: any, i: number) => {
                        const visual = getOptionVisuals(i);
                        return (
                            <div key={i}
                                className={`${visual.bgClass} ${visual.textClass} ${visual.borderClass} p-6 rounded-2xl flex items-center gap-4 min-h-[100px] shadow-xl animate-fade-in-up`}
                                style={{ animationDelay: `${i * 0.1}s` }}
                            >
                                <span className="w-12 h-12 rounded-xl bg-black/30 border border-white/20 flex items-center justify-center text-2xl font-black shrink-0 shadow-inner">
                                    {visual.shapeIcon}
                                </span>
                                <span className="text-xl md:text-2xl font-bold leading-snug">{opt.text}</span>
                            </div>
                        );
                    })}
                </div>

                {/* Answers progress */}
                <div className="mt-8 flex justify-center">
                    <div className="card-arena px-6 py-3 flex items-center gap-4 w-full max-w-md">
                        <div className="flex-1 h-2 bg-dark-700 rounded-full overflow-hidden">
                            <div className="h-full bg-arena-500 rounded-full transition-all duration-300" style={{ width: `${answerPercent}%` }} />
                        </div>
                        <button onClick={() => hostCommand('end-question')}
                            className="text-dark-400 hover:text-arena-400 transition-colors flex items-center gap-1 text-sm font-bold">
                            <SkipForward className="w-4 h-4" /> Pular
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ──── FIM DA PERGUNTA: GRÁFICO KAHOOT & RANKING ────
    if (status === 'QUESTION_ENDED') {
        const questionToDisplay = currentQuestion;
        const totalAnswers = questionStats?.totalAnswers || 0;
        const correctCount = questionStats?.correctCount || 0;
        const accuracyPct = totalAnswers > 0 ? Math.round((correctCount / totalAnswers) * 100) : 0;

        const optionsList = questionStats?.options && questionStats.options.length > 0
            ? questionStats.options
            : (questionToDisplay?.options || []).map((o: any) => ({
                id: o.id,
                text: o.text,
                correct: o.correct,
                count: 0,
                percentage: 0
            }));

        const maxVotes = Math.max(...optionsList.map(o => o.count), 1);

        return (
            <div className="flex flex-col items-center pt-4 w-full max-w-4xl mx-auto animate-fade-in">
                {renderProjectorButton()}{renderParticipantControls()}
                {/* Cabeçalho da Pergunta */}
                <div className="text-center mb-6 w-full animate-fade-in-down">
                    <span className="text-xs font-bold uppercase tracking-widest text-arena-400 bg-arena-500/10 border border-arena-500/20 px-3.5 py-1 rounded-full inline-block mb-3">
                        Pergunta {questionIndex + 1} de {quiz?.questionCount || 0} Encerrada
                    </span>
                    <h2 className="text-2xl md:text-3xl font-black text-white px-4 leading-tight">
                        {questionToDisplay?.text || "Pergunta Concluída"}
                    </h2>
                </div>

                {/* Seletor de Abas: Gráfico vs Ranking */}
                <div className="flex items-center gap-2 p-1.5 bg-dark-900/80 border border-dark-600/40 rounded-2xl mb-8 shadow-lg">
                    <button
                        type="button"
                        onClick={() => setResultTab('STATS')}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-sm transition-all cursor-pointer ${
                            resultTab === 'STATS'
                                ? 'bg-arena-500 text-dark-900 shadow-md scale-102 glow-gold'
                                : 'text-dark-400 hover:text-white hover:bg-dark-700/50'
                        }`}
                    >
                        <BarChart3 className="w-4 h-4" />
                        Gráfico de Respostas ({totalAnswers})
                    </button>
                    <button
                        type="button"
                        onClick={() => setResultTab('LEADERBOARD')}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-sm transition-all cursor-pointer ${
                            resultTab === 'LEADERBOARD'
                                ? 'bg-arena-500 text-dark-900 shadow-md scale-102 glow-gold'
                                : 'text-dark-400 hover:text-white hover:bg-dark-700/50'
                        }`}
                    >
                        <Crown className="w-4 h-4" />
                        Classificação Geral ({leaderboard.length})
                    </button>
                </div>

                {/* ──── TAB 1: GRÁFICO DE BARRAS ESTILO KAHOOT ──── */}
                {resultTab === 'STATS' && (
                    <div className="w-full flex flex-col items-center animate-fade-in">
                        {/* 4 Colunas com Barras de Resposta */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full mb-8 items-end min-h-[310px]">
                            {optionsList.map((opt, i) => {
                                const heightPercent = totalAnswers > 0
                                    ? Math.max(18, Math.round((opt.count / maxVotes) * 100))
                                    : 18;
                                const isCorrect = opt.correct;
                                const visual = getOptionVisuals(i);

                                return (
                                    <div
                                        key={opt.id || i}
                                        className={`flex flex-col items-center justify-end h-full p-4 rounded-2xl border transition-all ${
                                            isCorrect
                                                ? 'bg-dark-900/90 border-green-500 shadow-[0_0_25px_rgba(34,197,94,0.25)] glow-green'
                                                : 'bg-dark-900/60 border-dark-600/30'
                                        }`}
                                    >
                                        {/* Selo: Correta ou Incorreta */}
                                        <div className="mb-3 h-6 flex items-center">
                                            {isCorrect ? (
                                                <span className="bg-green-500/20 text-green-300 border border-green-500/40 text-[11px] font-black px-2.5 py-1 rounded-full flex items-center gap-1 shadow-sm animate-bounce-in">
                                                    <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                                                    CORRETA
                                                </span>
                                            ) : (
                                                <span className="text-dark-500 text-[11px] font-bold flex items-center gap-1">
                                                    <XCircle className="w-3.5 h-3.5 text-dark-500" />
                                                    Incorreta
                                                </span>
                                            )}
                                        </div>

                                        {/* Barra Animada com Quantidade */}
                                        <div className="w-full h-44 flex items-end justify-center mb-3">
                                            <div
                                                className={`w-full max-w-[80px] rounded-xl ${visual.bgClass} flex flex-col items-center justify-between py-2 shadow-xl transition-all duration-1000 ease-out`}
                                                style={{ height: `${heightPercent}%` }}
                                            >
                                                <span className="text-2xl font-black text-white drop-shadow-md">
                                                    {opt.count}
                                                </span>
                                                <span className="text-[10px] font-black text-white/90 uppercase tracking-wider">
                                                    {opt.percentage}%
                                                </span>
                                            </div>
                                        </div>

                                        {/* Símbolo e Texto da Opção */}
                                        <div className="w-full text-center pt-3 border-t border-dark-700/50">
                                            <div className="w-8 h-8 mx-auto mb-1 rounded-lg bg-black/40 border border-white/20 flex items-center justify-center text-lg font-black">
                                                {visual.shapeIcon}
                                            </div>
                                            <p className={`text-xs md:text-sm font-bold line-clamp-2 ${isCorrect ? 'text-green-300 font-black' : 'text-dark-300'}`}>
                                                {opt.text}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Estatística de Resumo */}
                        <div className="bg-dark-900/80 border border-arena-600/30 px-6 py-3 rounded-2xl flex flex-wrap items-center justify-center gap-4 mb-8 shadow-md">
                            <span className="text-sm text-dark-300 font-medium text-center">
                                <strong className="text-arena-400 font-black text-base">{correctCount}</strong> de <strong className="text-white font-bold">{totalAnswers}</strong> gladiadores acertaram
                            </span>
                            <span className="bg-arena-500/15 text-arena-400 font-black text-xs px-3 py-1 rounded-lg border border-arena-500/25">
                                {accuracyPct}% de acerto
                            </span>
                        </div>

                        {/* Botões de Ação */}
                        <div className="flex flex-wrap gap-4 justify-center">
                            <button
                                type="button"
                                onClick={() => setResultTab('LEADERBOARD')}
                                className="btn-secondary flex items-center gap-2 text-base px-6 py-3 font-bold"
                            >
                                <Crown className="w-5 h-5 text-arena-400" /> VER RANKING
                            </button>
                            <button
                                type="button"
                                onClick={() => hostCommand('next')}
                                className="btn-primary flex items-center gap-3 text-base px-8 py-3"
                            >
                                PRÓXIMA PERGUNTA <ArrowRight className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                )}

                {/* ──── TAB 2: RANKING DOS GLADIADORES ──── */}
                {resultTab === 'LEADERBOARD' && (
                    <div className="w-full max-w-2xl flex flex-col items-center animate-fade-in">
                        <div className="w-full space-y-2 mb-8">
                            {leaderboard.slice(0, 5).map((p, i) => {
                                const medals = ['🥇', '🥈', '🥉'];
                                return (
                                    <div key={p.id}
                                        className="card-arena p-4 flex justify-between items-center animate-rank-slide"
                                        style={{ animationDelay: `${i * 0.1}s` }}
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className="text-2xl w-8 text-center">
                                                {i < 3 ? medals[i] : <span className="text-dark-400 font-black">{i + 1}º</span>}
                                            </span>
                                            <AvatarImage avatar={p.avatar} className="w-8 h-8 ring-1 ring-arena-400/50 shrink-0" />
                                            <span className="text-lg font-bold text-white">{p.nickname}</span>
                                        </div>
                                        <span className="text-2xl font-black text-gradient-gold">{p.score}</span>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="flex flex-wrap gap-4 justify-center">
                            <button
                                type="button"
                                onClick={() => setResultTab('STATS')}
                                className="btn-secondary flex items-center gap-2 text-base px-6 py-3 font-bold"
                            >
                                <BarChart3 className="w-5 h-5 text-arena-400" /> VER GRÁFICO
                            </button>
                            <button
                                type="button"
                                onClick={() => hostCommand('next')}
                                className="btn-primary flex items-center gap-3 text-base px-8 py-3"
                            >
                                PRÓXIMA PERGUNTA <ArrowRight className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // ──── PÓDIO FINAL COM TÍTULOS ROMANOS ────
    if (status === 'FINISHED') {
        const title1 = getRomanTitle(1);
        const title2 = getRomanTitle(2);
        const title3 = getRomanTitle(3);

        return (
            <div className="flex flex-col items-center pt-6 pb-12 w-full max-w-4xl mx-auto animate-fade-in">
                {renderProjectorButton()}{renderParticipantControls()}
                <div className="no-print flex flex-col items-center w-full">
                    <Trophy className="w-16 h-16 text-arena-400 mb-3 animate-bounce-in drop-shadow-[0_0_25px_rgba(245,197,24,0.4)]" />
                    <span className="text-xs font-bold uppercase tracking-[0.3em] text-arena-400 mb-1">Honra e Glória Eterna</span>
                    <h2 className="text-4xl md:text-5xl font-black text-gradient-gold mb-2 animate-fade-in-up">ARENA ENCERRADA</h2>
                    <p className="text-dark-400 mb-10 animate-fade-in-up text-sm md:text-base">Os deuses de Roma consagraram os maiores gladiadores!</p>

                {/* Podium Container - Balanced height to prevent any overlap */}
                <div className="flex items-end justify-center gap-4 md:gap-8 mb-12 min-h-[440px] pt-10 animate-fade-in-up w-full px-2">
                    {/* 2nd Place */}
                    {leaderboard[1] && (
                        <div className="flex flex-col items-center animate-fade-in-up flex-1 max-w-[170px]" style={{ animationDelay: '0.4s' }}>
                            <Medal className="w-6 h-6 text-gray-300 mb-1 drop-shadow" />
                            <AvatarImage avatar={leaderboard[1].avatar} className="w-12 h-12 mb-1.5 ring-2 ring-slate-300/80 shadow-lg" />
                            <span className="font-bold text-sm md:text-base mb-1 truncate max-w-full text-white">{leaderboard[1].nickname}</span>

                            {/* Roman Title Badge */}
                            <div className={`px-2 py-0.5 rounded-full border text-[10px] md:text-xs font-black tracking-wider uppercase mb-1 flex items-center gap-1 ${title2.badgeClass}`}>
                                <span>{title2.icon}</span> {title2.title}
                            </div>
                            <span className="text-[10px] italic text-gray-400 mb-2 font-serif">{title2.subtitle}</span>

                            <span className="text-dark-300 font-black text-sm mb-2">{leaderboard[1].score} pts</span>
                            <div className="w-full h-[140px] md:h-[165px] bg-gradient-to-t from-gray-700 via-gray-500 to-gray-400 rounded-t-2xl flex flex-col justify-start items-center pt-4 text-3xl font-black text-gray-900 shadow-xl border-t-2 border-gray-300/40">
                                <span>2º</span>
                            </div>
                        </div>
                    )}

                    {/* 1st Place - Champion (Tallest!) */}
                    {leaderboard[0] && (
                        <div className="flex flex-col items-center animate-fade-in-up flex-1 max-w-[200px]" style={{ animationDelay: '0.2s' }}>
                            <Crown className="w-8 h-8 text-arena-400 mb-1 animate-float drop-shadow-[0_0_15px_rgba(245,197,24,0.6)]" />
                            <AvatarImage avatar={leaderboard[0].avatar} className="w-16 h-16 mb-1.5 ring-2 ring-arena-400 shadow-xl" />
                            <span className="font-black text-base md:text-xl text-arena-300 mb-1 truncate max-w-full drop-shadow">{leaderboard[0].nickname}</span>

                            {/* Roman Title Badge */}
                            <div className={`px-3 py-1 rounded-full border text-xs md:text-sm font-black tracking-wider uppercase mb-1 flex items-center gap-1.5 ${title1.badgeClass}`}>
                                <span>{title1.icon}</span> {title1.title}
                            </div>
                            <span className="text-xs italic text-arena-400/80 mb-2 font-serif">{title1.subtitle}</span>

                            <span className="text-arena-200 font-black text-base mb-2">{leaderboard[0].score} pts</span>
                            <div className="w-full h-[210px] md:h-[250px] bg-gradient-to-t from-amber-700 via-arena-500 to-yellow-400 rounded-t-2xl flex flex-col justify-start items-center pt-5 text-4xl font-black text-dark-900 shadow-2xl glow-gold border-t-2 border-yellow-200/60">
                                <span>1º</span>
                            </div>
                        </div>
                    )}

                    {/* 3rd Place */}
                    {leaderboard[2] && (
                        <div className="flex flex-col items-center animate-fade-in-up flex-1 max-w-[170px]" style={{ animationDelay: '0.6s' }}>
                            <Medal className="w-6 h-6 text-amber-500 mb-1 drop-shadow" />
                            <AvatarImage avatar={leaderboard[2].avatar} className="w-12 h-12 mb-1.5 ring-2 ring-amber-600/80 shadow-lg" />
                            <span className="font-bold text-sm md:text-base mb-1 truncate max-w-full text-white">{leaderboard[2].nickname}</span>

                            {/* Roman Title Badge */}
                            <div className={`px-2 py-0.5 rounded-full border text-[10px] md:text-xs font-black tracking-wider uppercase mb-1 flex items-center gap-1 ${title3.badgeClass}`}>
                                <span>{title3.icon}</span> {title3.title}
                            </div>
                            <span className="text-[10px] italic text-amber-500/80 mb-2 font-serif">{title3.subtitle}</span>

                            <span className="text-orange-300 font-black text-sm mb-2">{leaderboard[2].score} pts</span>
                            <div className="w-full h-[85px] md:h-[105px] bg-gradient-to-t from-orange-800 via-amber-700 to-amber-600 rounded-t-2xl flex flex-col justify-start items-center pt-3 text-3xl font-black text-orange-950 shadow-xl border-t-2 border-amber-400/40">
                                <span>3º</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Demais Gladiadores (4º em diante) */}
                {leaderboard.length > 3 && (
                    <div className="w-full max-w-xl card-arena p-4 mb-8 animate-fade-in-up" style={{ animationDelay: '0.8s' }}>
                        <span className="text-[11px] font-bold text-dark-400 uppercase tracking-wider block mb-3 text-center">
                            Demais Combatentes da Arena
                        </span>
                        <div className="space-y-2">
                            {leaderboard.slice(3).map((p, idx) => {
                                const rank = idx + 4;
                                const title = getRomanTitle(rank);
                                return (
                                    <div key={p.id} className="flex justify-between items-center p-2.5 bg-dark-900/60 rounded-xl border border-dark-700/50">
                                        <div className="flex items-center gap-3">
                                            <span className="text-sm font-black text-dark-400 w-6 text-center">{rank}º</span>
                                            <AvatarImage avatar={p.avatar} className="w-6 h-6 ring-1 ring-arena-400/50 shrink-0" />
                                            <div>
                                                <span className="font-bold text-white text-sm block">{p.nickname}</span>
                                                <span className="text-[10px] text-dark-400 flex items-center gap-1">
                                                    {title.icon} {title.title}
                                                </span>
                                            </div>
                                        </div>
                                        <span className="font-bold text-arena-400 text-sm">{p.score} pts</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                <div className="flex flex-col sm:flex-row items-center gap-4 animate-fade-in-up" style={{ animationDelay: '0.9s' }}>
                    <button
                        onClick={handleOpenReport}
                        className="px-6 py-3.5 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black rounded-2xl flex items-center gap-2.5 shadow-xl shadow-amber-500/20 text-sm tracking-wider uppercase transition-all cursor-pointer hover:scale-105 active:scale-95"
                    >
                        <FileText className="w-5 h-5" />
                        RELATÓRIO PEDAGÓGICO (PDF)
                    </button>
                    <button
                        onClick={() => navigate('/')}
                        className="btn-secondary flex items-center gap-2 cursor-pointer"
                    >
                        <ArrowLeft className="w-5 h-5" /> VOLTAR AO INÍCIO
                    </button>
                </div>
                </div>

                {showReportModal && (
                    <PedagogicalReportModal
                        report={reportData}
                        loading={loadingReport}
                        onClose={() => setShowReportModal(false)}
                    />
                )}
            </div>
        );
    }

    return null;
}
