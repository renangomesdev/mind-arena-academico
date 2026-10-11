import { useEffect, useState, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useGameConnection } from '../services/useGameConnection';
import { api } from '../services/api';
import { CheckCircle2, XCircle, Trophy, Loader2, Swords, BookOpen, Volume2, VolumeX } from 'lucide-react';
import { soundManager } from '../services/soundManager';
import { getRomanTitle } from '../utils/romanTitles';
import { useAccessibility } from '../contexts/AccessibilityContext';
import PlayerReviewModal from '../components/PlayerReviewModal';
import { AvatarImage } from '../components/AvatarImage';
import type { Question, PlayerReview } from '../types';

export default function GamePlayer() {
    const { code } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const {
        getOptionVisuals,
        speakQuestion,
        stopSpeaking,
        isSpeaking,
        vibrate,
        ttsAutoPlay
    } = useAccessibility();

    const [player, setPlayer] = useState<any>(() => {
        const id = sessionStorage.getItem(`player_id_${code}`);
        return location.state?.player || (id ? { id: Number(id) } : null);
    });
    const [status, setStatus] = useState('WAITING');
    const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
    const [answered, setAnswered] = useState(false);
    const [feedback, setFeedback] = useState<'CORRECT' | 'WRONG' | null>(null);
    const [scoreAwarded, setScoreAwarded] = useState(0);
    const [questionStartTime, setQuestionStartTime] = useState(0);
    const [countdown, setCountdown] = useState(0);
    const [countdownDeadline, setCountdownDeadline] = useState(0);
    const [blindDeadline, setBlindDeadline] = useState(0);
    const [streakInfo, setStreakInfo] = useState({ streakBonus: 0, currentStreak: 0 });
    const [powersEnabled, setPowersEnabled] = useState(false);
    const [isBlinded, setIsBlinded] = useState(false);
    const [blindSecondsLeft, setBlindSecondsLeft] = useState(2);
    const [leaderboard, setLeaderboard] = useState<any[]>([]);
    const [showBlindModal, setShowBlindModal] = useState(false);
    const [opponents, setOpponents] = useState<any[]>([]);
    const [activeHint, setActiveHint] = useState<string | null>(null);
    const [showReviewModal, setShowReviewModal] = useState(false);
    const [reviewData, setReviewData] = useState<PlayerReview | null>(null);
    const [loadingReview, setLoadingReview] = useState(false);
    const handleGameEventRef = useRef<((event: any) => void) | null>(null);
    const refreshGameRef = useRef<() => void>(() => {});
    const activeQuestionIdRef = useRef<number | undefined>(undefined);
    const answerResultRef = useRef<{ correct: boolean; streakBonus: number; currentStreak: number } | null>(null);

    useEffect(() => {
        if (code && player?.playerToken) {
            sessionStorage.setItem(`player_token_${code}`, player.playerToken);
        }
        if (code && player?.id) sessionStorage.setItem(`player_id_${code}`, String(player.id));
    }, [code, player?.playerToken, player?.id]);

    const handleOpenReview = async () => {
        if (!code || !player?.id) return;
        setShowReviewModal(true);
        setLoadingReview(true);
        try {
            const res = await api.get(`/games/${code}/players/${player.id}/review`);
            setReviewData(res.data);
        } catch (err: any) {
            alert(err.response?.data?.message || "Não foi possível carregar o gabarito.");
            setShowReviewModal(false);
        } finally {
            setLoadingReview(false);
        }
    };

    const refreshOpponents = () => {
        if (!code || !player?.id) return;
        api.get(`/games/${code}/players/${player.id}/state`).then(res => {
            if (res.data?.players) {
                setOpponents(res.data.players.filter((p: any) => Number(p.id) !== Number(player.id)));
            }
        }).catch(() => {});
    };

    useEffect(() => {
        handleGameEventRef.current = (event: any) => {
            switch (event.type) {
                case 'PLAYER_REMOVED':
                    if (Number(event.payload) === Number(player?.id)) {
                        alert('O organizador removeu você desta arena.'); navigate('/');
                    } else setOpponents(previous => previous.filter(opponent => Number(opponent.id) !== Number(event.payload)));
                    break;
                case 'EXPIRED':
                    alert('Esta arena expirou. Peça um novo código ao organizador.'); navigate('/');
                    break;
                case 'POWERS_TOGGLED':
                    setPowersEnabled(event.payload);
                    break;
                case 'PLAYER_JOINED':
                    if (event.payload && Number(event.payload.id) !== Number(player?.id)) {
                        setOpponents(prev => {
                            if (prev.some(p => Number(p.id) === Number(event.payload.id))) return prev;
                            return [...prev, event.payload];
                        });
                    }
                    break;
                case 'PLAYER_BLINDED':
                    if (Number(event.payload) === Number(player?.id)) {
                        soundManager.playBlind();
                        setIsBlinded(true);
                        setBlindSecondsLeft(2);
                        setBlindDeadline(Date.now() + 2000);
                        if (typeof navigator !== 'undefined' && navigator.vibrate) {
                            try { navigator.vibrate([120, 60, 200]); } catch (_) {}
                        }
                    }
                    break;
                case 'GAME_STARTED':
                    setStatus('STARTING');
                    setCountdown(3);
                    setCountdownDeadline(Date.now() + Math.max(0, 3000 - (event.payload.serverTime - event.payload.startTime)));
                    refreshOpponents();
                    break;
                case 'QUESTION_STARTED':
                    activeQuestionIdRef.current = event.payload.id;
                    soundManager.playStartFanfare();
                    setStatus('QUESTION_ACTIVE');
                    setCurrentQuestion(event.payload);
                    setAnswered(false);
                    setFeedback(null);
                    setActiveHint(null);
                    answerResultRef.current = null;
                    setQuestionStartTime(Date.now() - Math.max(0, event.payload.serverTime - event.payload.startTime));
                    setShowBlindModal(false);
                    refreshOpponents();
                    vibrate([50, 40, 70]);
                    if (ttsAutoPlay && event.payload?.text) {
                        speakQuestion(event.payload.text, event.payload.options, event.payload.timeLimitSeconds);
                    }
                    break;
                case 'QUESTION_ENDED':
                    refreshGameRef.current();
                    stopSpeaking();
                    setStatus('QUESTION_ENDED');
                    const playersList = Array.isArray(event.payload)
                        ? event.payload
                        : (event.payload?.leaderboard || []);
                    setLeaderboard(playersList);
                    const me = playersList.find((p: any) => Number(p.id) === Number(player?.id));
                    if (!answerResultRef.current) {
                        soundManager.playWrong();
                        setFeedback('WRONG');
                        setScoreAwarded(0);
                        setStreakInfo({ streakBonus: 0, currentStreak: 0 });
                        vibrate(200);
                    } else if (answerResultRef.current.correct) {
                        soundManager.playCorrect();
                        vibrate([80, 50, 120]);
                        if (answerResultRef.current.streakBonus > 0 || answerResultRef.current.currentStreak > 1) {
                            setTimeout(() => soundManager.playStreak(), 350);
                        }
                    } else {
                        soundManager.playWrong();
                        vibrate(200);
                    }
                    if (me) setPlayer(me);
                    break;
                case 'FINISHED':
                    stopSpeaking();
                    soundManager.playVictory();
                    setStatus('FINISHED');
                    const finalPlayers = Array.isArray(event.payload)
                        ? event.payload
                        : (event.payload?.leaderboard || []);
                    setLeaderboard(finalPlayers);
                    const meFinal = finalPlayers.find((p: any) => Number(p.id) === Number(player?.id));
                    if (meFinal) setPlayer(meFinal);
                    break;
            }
        };
    });

    const refreshGame = useGameConnection(player ? code : undefined, player?.id, game => {
        setPlayer(game.player);
        setStatus(game.status);
        setPowersEnabled(game.powersEnabled);
        setOpponents((game.players || []).filter((p: any) => p.id !== game.player.id));
        setLeaderboard(game.leaderboard || []);
        const question = game.currentQuestion;
        activeQuestionIdRef.current = question?.id;
        setCurrentQuestion(question || null);
        if (game.status === 'STARTING') {
            const remaining = Math.max(0, game.currentQuestionStartTime + 3000 - game.serverTime);
            setCountdown(Math.ceil(remaining / 1000));
            setCountdownDeadline(game.receivedAt + remaining);
        }
        if (question) setQuestionStartTime(game.receivedAt - Math.max(0, game.serverTime - game.currentQuestionStartTime));
        setAnswered(Boolean(game.answer));
        setFeedback(game.answer ? (game.answer.correct ? 'CORRECT' : 'WRONG') : null);
        setScoreAwarded(game.answer?.pointsAwarded || 0);
        setStreakInfo({ streakBonus: game.answer?.streakBonus || 0, currentStreak: game.answer?.currentStreak || 0 });
        answerResultRef.current = game.answer || null;
        setActiveHint(game.activeHint || null);
        const blindRemaining = Math.max(0, (game.player.blindUntil || 0) - game.serverTime);
        setBlindDeadline(game.receivedAt + blindRemaining);
        setIsBlinded(blindRemaining > 0);
        setBlindSecondsLeft(Math.ceil(blindRemaining / 1000));
    }, event => handleGameEventRef.current?.(event), error => {
        if ([403, 404, 410].includes(error.response?.status)) {
            alert(error.response.data.message || 'Não foi possível recuperar seu acesso à arena.');
            navigate('/');
        }
    });

    useEffect(() => { refreshGameRef.current = refreshGame; }, [refreshGame]);
    useEffect(() => { if (!player?.id) navigate('/'); }, [player?.id, navigate]);
    useEffect(() => () => stopSpeaking(), [stopSpeaking]);

    useEffect(() => {
        if (!isBlinded) return;
        const timer = setInterval(() => {
            const seconds = Math.max(0, Math.ceil((blindDeadline - Date.now()) / 1000));
            setBlindSecondsLeft(seconds);
            if (seconds === 0) setIsBlinded(false);
        }, 100);
        return () => clearInterval(timer);
    }, [isBlinded, blindDeadline]);

    // Countdown
    useEffect(() => {
        if (status === 'STARTING' && countdown > 0) {
            soundManager.playTick(600 + (3 - countdown) * 200);
        }
    }, [countdown, status]);

    useEffect(() => {
        if (status !== 'STARTING') return;
        const timer = setInterval(() => setCountdown(Math.max(0, Math.ceil((countdownDeadline - Date.now()) / 1000))), 100);
        return () => clearInterval(timer);
    }, [countdownDeadline, status]);

    const submitAnswer = async (optionId: number) => {
        if (answered || status !== 'QUESTION_ACTIVE') return;
        const submittedQuestionId = currentQuestion?.id;
        vibrate(40);
        soundManager.playAnswerClick();
        stopSpeaking();
        setAnswered(true);
        const timeTakenMs = Math.max(0, Date.now() - questionStartTime);
        try {
            const res = await api.post(`/games/${code}/answer`, {
                playerId: player.id,
                questionId: submittedQuestionId,
                optionId,
                timeTakenMs
            });
            if (activeQuestionIdRef.current !== submittedQuestionId) { refreshGame(); return; }
            const { correct, pointsAwarded, streakBonus, currentStreak } = res.data;
            setFeedback(correct ? 'CORRECT' : 'WRONG');
            setScoreAwarded(pointsAwarded);
            setStreakInfo({ streakBonus, currentStreak });
            answerResultRef.current = { correct, streakBonus, currentStreak };
        } catch (error: any) {
            if (error.response?.status !== 409) alert(error.response?.data?.message || 'Erro ao enviar resposta.');
            refreshGame();
        }
    };

    const activateBlindPower = async (targetId: number) => {
        try {
            await api.post(`/games/${code}/power/blind`, { attackerId: player.id, targetId, questionId: currentQuestion?.id });
            soundManager.playBlind();
            setPlayer((previous: any) => ({ ...previous, usedBlind: true }));
            setShowBlindModal(false);
        } catch (error: any) {
            alert(error.response?.data?.message || "Erro ao usar poder.");
        }
    };

    const activateHintPower = async () => {
        const hintQuestionId = currentQuestion?.id;
        try {
            const res = await api.post(`/games/${code}/power/hint`, { playerId: player.id, questionId: hintQuestionId });
            soundManager.playHint();
            if (activeQuestionIdRef.current === hintQuestionId) setActiveHint(res.data.hint);
            setPlayer((previous: any) => ({ ...previous, usedHint: true }));
        } catch (error: any) {
            alert(error.response?.data?.message || "Erro ao usar poder.");
        }
    };

    // ──── LOBBY DO JOGADOR ────
    if (status === 'WAITING') {
        return (
            <div className="flex flex-col items-center justify-center pt-16 animate-fade-in">
                <div className="card-arena p-8 text-center w-full max-w-sm glow-gold animate-scale-in">
                    <div className="w-24 h-24 mx-auto mb-4 bg-arena-500/10 rounded-2xl flex items-center justify-center border border-arena-500/30 p-2 shadow-lg animate-float">
                        <AvatarImage avatar={player?.avatar} className="w-20 h-20 ring-2 ring-arena-400/80 shadow-md" />
                    </div>
                    <h2 className="text-xl font-bold text-white mb-1">Você está na arena!</h2>
                    <div className="text-3xl font-black text-gradient-gold py-2">{player?.nickname}</div>
                    <div className="flex items-center justify-center gap-2 text-dark-400 mt-4">
                        <Loader2 className="w-4 h-4 animate-spin text-arena-500" />
                        <p className="text-sm font-medium">Aguardando o host iniciar...</p>
                    </div>
                </div>
            </div>
        );
    }

    // ──── CONTAGEM REGRESSIVA ────
    if (status === 'STARTING') {
        return (
            <div className="flex flex-col items-center justify-center min-h-[55vh]">
                {countdown > 0 ? (
                    <div key={countdown} className="animate-count-pop">
                        <span className="text-[10rem] font-black text-gradient-gold leading-none">{countdown}</span>
                    </div>
                ) : (
                    <div className="flex flex-col items-center animate-bounce-in">
                        <Swords className="w-16 h-16 text-arena-400 mb-4" />
                        <h2 className="text-4xl font-black text-gradient-fire">VALENDO!</h2>
                    </div>
                )}
            </div>
        );
    }

    // ──── ALTERNATIVAS ────
    if (status === 'QUESTION_ACTIVE' && currentQuestion) {
        if (answered) {
            return (
                <div className="flex flex-col items-center justify-center min-h-[55vh] animate-fade-in">
                    <div className="card-arena p-10 text-center">
                        <Loader2 className="w-10 h-10 text-arena-500 mx-auto mb-4 animate-spin" />
                        <h2 className="text-xl font-bold text-white mb-1">Resposta enviada!</h2>
                        <p className="text-dark-400 text-sm">Aguarde os outros gladiadores...</p>
                    </div>
                </div>
            );
        }

        return (
            <div className="flex flex-col h-[calc(100vh-100px)] pt-2 animate-fade-in relative">

                {isBlinded && (
                    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center p-6 bg-[#1a0f07]/95 backdrop-blur-xl animate-screen-shake overflow-hidden shadow-[inset_0_0_120px_rgba(239,68,68,0.55)]">
                        {/* Sandstorm particles / Swirling background */}
                        <div className="absolute inset-0 bg-radial from-amber-600/25 via-orange-950/50 to-black/90 pointer-events-none" />
                        <div className="absolute w-[500px] h-[500px] rounded-full border-4 border-dashed border-amber-500/30 animate-sand-swirl pointer-events-none" />
                        <div className="absolute w-[350px] h-[350px] rounded-full border-2 border-dashed border-red-500/30 animate-sand-swirl pointer-events-none" style={{ animationDirection: 'reverse', animationDuration: '2.5s' }} />

                        {/* Floating Dust Particles */}
                        <div className="absolute inset-0 pointer-events-none overflow-hidden">
                            {[...Array(14)].map((_, i) => (
                                <div
                                    key={i}
                                    className="absolute w-3 h-3 bg-amber-400/40 rounded-full blur-[1px] animate-sand-float"
                                    style={{
                                        top: `${10 + (i * 6)}%`,
                                        left: `${8 + (i * 7)}%`,
                                        animationDelay: `${i * 0.12}s`,
                                        animationDuration: `${0.8 + (i % 3) * 0.3}s`
                                    }}
                                />
                            ))}
                        </div>

                        {/* Main Impact Card */}
                        <div className="relative z-10 flex flex-col items-center text-center max-w-sm card-arena p-8 border-2 border-red-500/70 shadow-[0_0_60px_rgba(239,68,68,0.45)] animate-bounce-in">
                            <div className="relative mb-3">
                                <span className="text-7xl block animate-pulse">😵‍💫</span>
                                <span className="absolute -top-2 -right-3 text-3xl animate-bounce">🌪️</span>
                                <span className="absolute -bottom-2 -left-3 text-3xl animate-bounce" style={{ animationDelay: '0.2s' }}>💨</span>
                            </div>

                            <span className="text-[11px] font-black uppercase tracking-[0.25em] text-orange-400 mb-1 flex items-center gap-1.5">
                                <span>⚠️</span> GOLPE BAIXO DA ARENA <span>⚠️</span>
                            </span>

                            <h2 className="text-3xl font-black text-gradient-fire tracking-wider mb-2">
                                AREIA NOS OLHOS!
                            </h2>

                            <p className="text-amber-200/90 text-sm font-semibold mb-6 leading-relaxed">
                                Um gladiador oponente atirou areia quente nos seus olhos! Sua visão foi bloqueada.
                            </p>

                            {/* Progress / Countdown Badge */}
                            <div className="flex items-center gap-3 bg-black/70 border border-amber-500/40 px-5 py-2.5 rounded-full shadow-inner">
                                <div className="w-3 h-3 rounded-full bg-red-500 animate-ping" />
                                <span className="text-xs font-black text-amber-300 uppercase tracking-wider">
                                    Limpando visão em: <strong className="text-white text-base font-black">{blindSecondsLeft}s</strong>
                                </span>
                            </div>
                        </div>
                    </div>
                )}

                {/* HUD Poderes */}
                {powersEnabled && !answered && (
                    <div className="flex gap-2 mb-3 px-1">
                        <button
                            onClick={() => {
                                if (!player.usedBlind) {
                                    refreshOpponents();
                                    setShowBlindModal(true);
                                }
                            }}
                            disabled={player.usedBlind}
                            className={`flex-1 py-2 rounded-xl border flex flex-col items-center justify-center transition-all ${player.usedBlind ? 'opacity-30 border-dark-600 bg-dark-800' : 'border-orange-500/50 bg-gradient-to-t from-orange-600/40 to-transparent hover:from-orange-500/50 text-white shadow-[0_0_15px_rgba(249,115,22,0.2)]'}`}
                        >
                            <span className="text-xl mb-1 drop-shadow-md">👁️</span>
                            <span className="text-[10px] font-black uppercase tracking-wider text-orange-200">Cegar</span>
                        </button>
                        <button
                            onClick={() => !player.usedHint && activateHintPower()}
                            disabled={player.usedHint}
                            className={`flex-1 py-2 rounded-xl border flex flex-col items-center justify-center transition-all ${player.usedHint ? 'opacity-30 border-dark-600 bg-dark-800' : 'border-blue-500/50 bg-gradient-to-t from-blue-600/40 to-transparent hover:from-blue-500/50 text-white shadow-[0_0_15px_rgba(59,130,246,0.2)]'}`}
                        >
                            <span className="text-xl mb-1 drop-shadow-md">💡</span>
                            <span className="text-[10px] font-black uppercase tracking-wider text-blue-200">Dica</span>
                        </button>
                    </div>
                )}

                {/* Pergunta no celular do aluno */}
                <div className="card-arena p-5 mb-4 glow-gold border-arena-700/30">
                    <div className="flex items-center justify-between gap-3 mb-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-arena-400 bg-arena-500/10 border border-arena-500/20 px-3 py-1 rounded-full">
                            Questão
                        </span>
                        <button
                            type="button"
                            onClick={() => {
                                if (isSpeaking) {
                                    stopSpeaking();
                                } else {
                                    const elapsed = questionStartTime > 0 ? (Date.now() - questionStartTime) / 1000 : 0;
                                    const rem = currentQuestion.timeLimitSeconds ? Math.max(0, Math.ceil(currentQuestion.timeLimitSeconds - elapsed)) : undefined;
                                    speakQuestion(currentQuestion.text, currentQuestion.options, rem);
                                }
                            }}
                            title={isSpeaking ? "Parar leitura por voz" : "Ouvir pergunta e alternativas em voz alta (pt-BR)"}
                            aria-label={isSpeaking ? "Parar leitura por voz" : "Ouvir pergunta e alternativas em voz alta"}
                            className="p-2 rounded-xl bg-dark-700/80 hover:bg-dark-600 border border-dark-500/40 text-arena-400 hover:text-white transition-all shadow-md active:scale-95 flex items-center gap-1.5"
                        >
                            {isSpeaking ? (
                                <>
                                    <VolumeX className="w-4 h-4 text-red-400 animate-pulse" />
                                    <span className="text-[11px] font-bold text-red-300">Parar</span>
                                </>
                            ) : (
                                <>
                                    <Volume2 className="w-4 h-4 text-arena-400" />
                                    <span className="text-[11px] font-bold text-arena-300">Ouvir</span>
                                </>
                            )}
                        </button>
                    </div>

                    <h2 className="text-xl md:text-2xl font-black text-white text-center leading-tight">
                        {currentQuestion.text}
                    </h2>
                    {activeHint && (
                        <div className="mt-4 bg-blue-500/20 border border-blue-400/30 rounded-lg p-3 text-blue-200 font-bold text-sm animate-bounce-in shadow-[0_0_15px_rgba(59,130,246,0.2)] text-left">
                            <span className="block text-blue-400 text-[10px] uppercase tracking-wider mb-1">Dica da sabedoria</span>
                            {activeHint}
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 flex-1 pb-4">
                    {currentQuestion.options.map((opt: any, i: number) => {
                        const visual = getOptionVisuals(i);
                        return (
                            <button
                                key={opt.id}
                                onClick={() => submitAnswer(opt.id)}
                                aria-label={`Opção ${visual.shapeName}: ${opt.text}`}
                                className={`${visual.bgClass} ${visual.textClass} ${visual.borderClass} rounded-2xl shadow-xl active:scale-[0.97] transition-all duration-100 flex items-center justify-start gap-4 font-bold text-lg md:text-2xl p-4 md:p-5`}
                            >
                                <span className="w-11 h-11 rounded-xl bg-black/30 border border-white/20 flex items-center justify-center text-2xl font-black shrink-0 shadow-inner">
                                    {visual.shapeIcon}
                                </span>
                                <span className="text-left flex-1 leading-snug">
                                    {opt.text}
                                </span>
                            </button>
                        );
                    })}
                </div>

                {/* Blind Modal */}
                {showBlindModal && (
                    <div className="absolute inset-0 bg-dark-900/95 z-50 p-6 flex flex-col rounded-2xl animate-fade-in-up border border-orange-500/30 shadow-[0_0_30px_rgba(249,115,22,0.2)]">
                        <h3 className="text-orange-400 font-black text-2xl mb-1 text-center">👁️ Cegar</h3>
                        <p className="text-dark-400 text-sm text-center mb-6">Escolha quem não verá a pergunta por 2s</p>

                        <div className="flex-1 overflow-y-auto space-y-3 mb-4 custom-scrollbar">
                            {opponents.length === 0 ? (
                                <div className="text-center text-dark-500 mt-10">Nenhum oponente disponível.</div>
                            ) : opponents.map(opp => (
                                <button key={opp.id} onClick={() => activateBlindPower(opp.id)}
                                    className="w-full bg-dark-800 border border-dark-600 hover:border-orange-500 hover:bg-orange-500/20 p-4 rounded-xl font-bold text-left flex justify-between items-center transition-colors shadow-md">
                                    <div className="flex items-center gap-3">
                                        <AvatarImage avatar={opp.avatar} className="w-8 h-8 ring-1 ring-arena-400/50 shrink-0" />
                                        <span className="text-white text-lg">{opp.nickname}</span>
                                    </div>
                                    <span className="text-orange-500 text-sm tracking-wider uppercase font-black bg-orange-500/10 px-3 py-1 rounded-lg">Cegar ⚡</span>
                                </button>
                            ))}
                        </div>

                        <button onClick={() => setShowBlindModal(false)} className="btn-secondary w-full py-4 text-lg">
                            Cancelar
                        </button>
                    </div>
                )}
            </div>
        );
    }

    // ──── FEEDBACK ────
    if (status === 'QUESTION_ENDED') {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] animate-fade-in">
                <div className={`card-arena p-10 text-center w-full max-w-sm ${
                    feedback === 'CORRECT' ? 'border-green-500/30' : 'border-red-500/30'
                }`}>
                    {feedback === 'CORRECT' ? (
                        <>
                            <CheckCircle2 className="w-20 h-20 text-green-500 mx-auto mb-4 animate-bounce-in" />
                            <h2 className="text-4xl font-black text-green-400 mb-3">CORRETO!</h2>
                            <div className="inline-block bg-green-500/20 border border-green-500/30 text-green-300 font-black px-6 py-2 rounded-full text-2xl">
                                +{scoreAwarded}
                            </div>

                            {streakInfo.currentStreak > 1 && (
                                <div className="flex flex-col items-center animate-fade-in-up mt-4">
                                    <div className="flex items-center gap-2 text-orange-500 font-black text-xl">
                                        <span className="text-2xl animate-pulse">🔥</span> STREAK {streakInfo.currentStreak}x!
                                    </div>
                                    {streakInfo.streakBonus > 0 && (
                                        <div className="text-orange-300 text-sm font-bold bg-orange-500/20 border border-orange-500/30 px-3 py-1 rounded-full mt-2">
                                            +{streakInfo.streakBonus} Bônus
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    ) : (
                        <>
                            <XCircle className="w-20 h-20 text-red-500 mx-auto mb-4 animate-scale-in" />
                            <h2 className="text-4xl font-black text-red-400 mb-3">ERRADO</h2>
                            <p className="text-dark-400 text-sm">Nenhum ponto nesta rodada.</p>
                        </>
                    )}

                    <div className="mt-8 pt-6 border-t border-dark-600/30">
                        <div className="text-dark-400 text-xs font-bold uppercase tracking-widest mb-1">Pontuação Total</div>
                        <div className="text-3xl font-black text-gradient-gold">{player?.score}</div>
                    </div>
                </div>
            </div>
        );
    }

    // ──── FINALIZADO COM TÍTULO ROMANO ────
    if (status === 'FINISHED') {
        const myRank = leaderboard && leaderboard.length > 0
            ? leaderboard.findIndex((p: any) => Number(p.id) === Number(player?.id)) + 1
            : 0;
        const myTitle = getRomanTitle(myRank > 0 ? myRank : 1);

        return (
            <div className="flex flex-col items-center justify-center pt-8 pb-12 animate-fade-in px-4">
                <Trophy className="w-16 h-16 text-arena-400 mb-3 animate-bounce-in drop-shadow-[0_0_20px_rgba(245,197,24,0.4)]" />
                <span className="text-xs font-bold uppercase tracking-[0.25em] text-arena-400 mb-1">Glória de Roma</span>
                <h2 className="text-3xl md:text-4xl font-black text-gradient-gold mb-2 text-center">ARENA ENCERRADA</h2>
                <p className="text-dark-400 mb-6 text-sm text-center">Obrigado por lutar bravamente no Coliseu!</p>

                {/* Roman Title Award Card */}
                <div className="card-arena p-6 text-center w-full max-w-sm mb-6 glow-gold border border-arena-600/40">
                    <div className="flex justify-center mb-3">
                        <AvatarImage avatar={player?.avatar} className="w-20 h-20 ring-2 ring-arena-400 shadow-xl" />
                    </div>
                    <h3 className="text-xl font-black text-white mb-2">{player?.nickname}</h3>

                    {/* Honor Badge */}
                    <div className={`px-3 py-1.5 rounded-full border text-xs font-black tracking-wider uppercase mb-1 inline-flex items-center gap-1.5 shadow-md ${myTitle.badgeClass}`}>
                        <span>{myTitle.icon}</span> {myTitle.title}
                    </div>
                    <p className="text-[11px] italic text-dark-300 font-serif mb-4">{myTitle.subtitle}</p>

                    {myRank > 0 && (
                        <div className="inline-block bg-dark-900/80 px-4 py-1.5 rounded-xl border border-dark-600/50 text-xs font-bold text-dark-300 mb-4 shadow-inner">
                            Classificação: <strong className="text-arena-400 font-black text-sm">{myRank}º Lugar</strong>
                        </div>
                    )}

                    <div className="pt-4 border-t border-dark-600/30">
                        <div className="text-dark-400 text-xs font-bold uppercase tracking-widest mb-1">Pontuação Final</div>
                        <div className="text-5xl font-black text-gradient-gold">{player?.score || 0}</div>
                    </div>
                </div>

                <div className="w-full max-w-sm flex flex-col gap-3">
                    <button
                        onClick={handleOpenReview}
                        className="btn-primary w-full flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-arena-500/20 text-dark-950 font-black text-sm py-3.5 tracking-wider uppercase transition-all hover:scale-105 active:scale-95"
                    >
                        <BookOpen className="w-5 h-5" /> VER MEU GABARITO & REVISÃO
                    </button>
                    <button
                        onClick={() => navigate('/')}
                        className="btn-secondary w-full cursor-pointer"
                    >
                        VOLTAR AO INÍCIO
                    </button>
                </div>

                {showReviewModal && (
                    <PlayerReviewModal
                        review={reviewData}
                        loading={loadingReview}
                        onClose={() => setShowReviewModal(false)}
                    />
                )}
            </div>
        );
    }

    return null;
}
