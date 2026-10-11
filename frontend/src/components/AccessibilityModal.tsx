import { useState, useEffect } from 'react';
import { 
    Accessibility, 
    X, 
    Type, 
    Eye, 
    Volume2, 
    RotateCcw, 
    Check, 
    Sparkles,
    Vibrate
} from 'lucide-react';
import { useAccessibility, type FontSize, type ColorMode, type TtsSpeed } from '../contexts/AccessibilityContext';

export default function AccessibilityModal() {
    const [isOpen, setIsOpen] = useState(false);
    const {
        fontSize,
        setFontSize,
        colorMode,
        setColorMode,
        ttsAutoPlay,
        setTtsAutoPlay,
        ttsSpeed,
        setTtsSpeed,
        ttsAutoAdjust,
        setTtsAutoAdjust,
        reducedMotion,
        setReducedMotion,
        hapticFeedback,
        setHapticFeedback,
        resetToDefaults,
        speak,
        stopSpeaking,
        isSpeaking,
        vibrate
    } = useAccessibility();

    // Fechar gaveta ao pressionar tecla ESC (WCAG 2.1)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                stopSpeaking();
                setIsOpen(false);
            }
        };
        if (isOpen) {
            window.addEventListener('keydown', handleKeyDown);
            // Bloqueia rolagem do body quando a gaveta está aberta
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = '';
        };
    }, [isOpen, stopSpeaking]);

    const handleTestTts = () => {
        if (isSpeaking) {
            stopSpeaking();
        } else {
            speak("Bem-vindo ao Coliseu da Mente! Esta é a narração em voz alta de acessibilidade. Pergunta de teste: Qual o princípio de responsabilidade única no SOLID?");
        }
    };

    const handleTestVibration = () => {
        vibrate([80, 60, 120]);
    };

    return (
        <>
            {/* Botão de Disparo no Cabeçalho */}
            <button
                onClick={() => setIsOpen(true)}
                title="Abrir Painel de Acessibilidade"
                aria-label="Abrir Painel de Acessibilidade (Tamanho do texto, voz, cores, vibração)"
                aria-haspopup="dialog"
                aria-expanded={isOpen}
                className="p-2.5 rounded-xl bg-dark-700/80 hover:bg-dark-600 border border-dark-500/40 text-arena-400 hover:text-white transition-all flex items-center gap-1.5 shadow-md active:scale-95 group"
            >
                <Accessibility className="w-5 h-5 text-arena-400 group-hover:scale-110 transition-transform" />
                <span className="text-xs font-bold text-arena-300 hidden lg:inline">Acessibilidade</span>
            </button>

            {/* Backdrop / Scrim Escurecido */}
            {isOpen && (
                <div 
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="a11y-panel-title"
                    className="fixed inset-0 z-[999] flex justify-end bg-black/80 backdrop-blur-sm animate-fade-in"
                    onClick={() => {
                        stopSpeaking();
                        setIsOpen(false);
                    }}
                >
                    {/* Gaveta Lateral Deslizante (Slide-Over Sheet) - NUNCA CORTA */}
                    <div 
                        className="w-full max-w-md sm:max-w-lg md:max-w-xl h-[100dvh] flex flex-col bg-[#14120f] border-l border-arena-500/40 shadow-[-15px_0_50px_rgba(0,0,0,0.9)] overflow-hidden animate-slide-left text-left"
                        style={{ overscrollBehavior: 'contain' }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* ──── 1. CABEÇALHO FIXO (Sempre Visível no Topo) ──── */}
                        <div className="shrink-0 p-4 sm:p-5 border-b border-dark-600/80 flex items-center justify-between bg-[#1a1714] sticky top-0 z-20">
                            <div className="flex items-center gap-3">
                                <div className="w-11 h-11 rounded-xl bg-arena-500/20 border border-arena-500/50 flex items-center justify-center text-arena-300 shadow-md">
                                    <Accessibility className="w-6 h-6" />
                                </div>
                                <div>
                                    <h2 id="a11y-panel-title" className="text-lg sm:text-xl font-black text-white flex items-center gap-2">
                                        Acessibilidade Universal
                                        <span className="text-[11px] font-black uppercase tracking-wider bg-arena-500/20 text-arena-300 px-2.5 py-0.5 rounded-full border border-arena-500/40">
                                            WCAG 2.2
                                        </span>
                                    </h2>
                                    <p className="text-xs sm:text-sm text-neutral-300 font-medium">
                                        Ajuste fontes, voz, contrastes e estímulos
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => {
                                    stopSpeaking();
                                    setIsOpen(false);
                                }}
                                aria-label="Fechar painel de acessibilidade"
                                className="w-10 h-10 rounded-xl flex items-center justify-center text-neutral-300 hover:text-white bg-dark-700/60 hover:bg-dark-600 border border-dark-500/40 transition-colors cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* ──── 2. CORPO ROLÁVEL COM ROLAGEM PERFEITA ──── */}
                        <div className="flex-1 min-h-0 overflow-y-auto p-5 sm:p-6 space-y-7 custom-scrollbar">
                            
                            {/* 1. Tamanho do Texto */}
                            <section className="bg-dark-800/40 border border-dark-600/60 p-4 sm:p-5 rounded-2xl shadow-sm">
                                <div className="flex items-center gap-2.5 mb-3">
                                    <Type className="w-5 h-5 text-arena-400" />
                                    <h3 className="text-base font-bold uppercase tracking-wider text-arena-300">
                                        Tamanho da Fonte
                                    </h3>
                                </div>
                                <p className="text-sm text-neutral-300 mb-4 leading-relaxed font-medium">
                                    Aumente o texto para ler com maior facilidade e sem forçar a visão.
                                </p>
                                <div className="grid grid-cols-3 gap-3">
                                    {[
                                        { id: 'normal' as FontSize, label: 'Padrão', sample: 'Aa', desc: '100%' },
                                        { id: 'large' as FontSize, label: 'Grande', sample: 'Aa+', desc: '125%' },
                                        { id: 'xlarge' as FontSize, label: 'Extra', sample: 'Aa++', desc: '145%' }
                                    ].map(item => (
                                        <button
                                            key={item.id}
                                            onClick={() => setFontSize(item.id)}
                                            className={`p-3.5 sm:p-4 rounded-xl border min-h-[72px] flex flex-col items-center justify-center transition-all cursor-pointer ${
                                                fontSize === item.id
                                                    ? 'bg-arena-500/25 border-arena-400 text-white shadow-[0_0_18px_rgba(245,197,24,0.25)] font-bold'
                                                    : 'bg-dark-800/90 border-dark-600 text-neutral-200 hover:border-dark-500 hover:text-white'
                                            }`}
                                        >
                                            <span className="text-2xl font-black mb-1">{item.sample}</span>
                                            <span className="text-sm font-bold">{item.label}</span>
                                            <span className="text-xs text-amber-200/90 font-medium">{item.desc}</span>
                                        </button>
                                    ))}
                                </div>
                            </section>

                            {/* 2. Modos de Cor e Daltonismo */}
                            <section className="bg-dark-800/40 border border-dark-600/60 p-4 sm:p-5 rounded-2xl shadow-sm">
                                <div className="flex items-center gap-2.5 mb-3">
                                    <Eye className="w-5 h-5 text-arena-400" />
                                    <h3 className="text-base font-bold uppercase tracking-wider text-arena-300">
                                        Paleta de Cores e Daltonismo
                                    </h3>
                                </div>
                                <p className="text-sm text-neutral-300 mb-4 leading-relaxed font-medium">
                                    Escolha a paleta mais nítida para sua visão. Todos os modos contam com formas geométricas universais (▲ ◆ ● ■).
                                </p>
                                <div className="space-y-3">
                                    {[
                                        {
                                            id: 'normal' as ColorMode,
                                            title: 'Padrão (Coliseu)',
                                            desc: 'Cores vibrantes: Vermelho, Azul, Dourado e Verde.',
                                            shapes: ['bg-red-500', 'bg-blue-500', 'bg-yellow-500', 'bg-emerald-500']
                                        },
                                        {
                                            id: 'colorblind' as ColorMode,
                                            title: 'Modo Daltônico (Protanopia / Deuteranopia)',
                                            desc: 'Otimizado para quem não distingue verde de vermelho: Laranja, Azul, Amarelo e Ciano.',
                                            shapes: ['bg-orange-500', 'bg-blue-600', 'bg-yellow-400', 'bg-teal-500']
                                        },
                                        {
                                            id: 'high-contrast' as ColorMode,
                                            title: 'Alto Contraste (WCAG AAA)',
                                            desc: 'Fundo preto profundo com bordas espessas luminosas para baixa visão.',
                                            shapes: ['border-2 border-yellow-400 bg-black', 'border-2 border-white bg-black', 'border-2 border-cyan-400 bg-black', 'border-2 border-orange-400 bg-black']
                                        }
                                    ].map(item => (
                                        <button
                                            key={item.id}
                                            onClick={() => setColorMode(item.id)}
                                            className={`w-full p-4 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                                                colorMode === item.id
                                                    ? 'bg-arena-500/20 border-arena-400 text-white shadow-md'
                                                    : 'bg-dark-800/90 border-dark-600 text-neutral-200 hover:border-dark-500 hover:text-white'
                                            }`}
                                        >
                                            <div className="flex-1 pr-3">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-base font-bold text-white">{item.title}</span>
                                                    {colorMode === item.id && (
                                                        <span className="text-arena-400"><Check className="w-5 h-5 inline font-black" /></span>
                                                    )}
                                                </div>
                                                <p className="text-sm text-neutral-300 leading-relaxed font-medium">{item.desc}</p>
                                            </div>
                                            <div className="flex gap-2 shrink-0">
                                                {item.shapes.map((s, idx) => (
                                                    <span key={idx} className={`w-5 h-5 rounded-full ${s} shadow-sm`} />
                                                ))}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </section>

                            {/* 3. Narração por Voz (Text-to-Speech) */}
                            <section className="bg-dark-800/40 border border-dark-600/60 p-4 sm:p-5 rounded-2xl shadow-sm space-y-4">
                                <div className="flex items-center gap-2.5">
                                    <Volume2 className="w-5 h-5 text-arena-400" />
                                    <h3 className="text-base font-bold uppercase tracking-wider text-arena-300">
                                        Leitura de Questões por Voz
                                    </h3>
                                </div>
                                <p className="text-sm text-neutral-300 leading-relaxed font-medium">
                                    O sintetizador nativo do navegador lê o enunciado e as opções em voz alta em português do Brasil (pt-BR).
                                </p>

                                {/* Velocidade da Voz */}
                                <div className="space-y-2 pt-1">
                                    <label className="text-xs font-bold text-neutral-300 uppercase tracking-wider block">
                                        Velocidade da Leitura
                                    </label>
                                    <div className="grid grid-cols-3 gap-2.5">
                                        {[
                                            { id: 'normal' as TtsSpeed, label: 'Normal', rate: '1.0x', desc: 'Clara' },
                                            { id: 'fast' as TtsSpeed, label: 'Rápida', rate: '1.25x', desc: 'Fluida' },
                                            { id: 'very-fast' as TtsSpeed, label: 'Muito rápida', rate: '1.5x', desc: 'Ágil' }
                                        ].map(item => (
                                            <button
                                                key={item.id}
                                                type="button"
                                                onClick={() => setTtsSpeed(item.id)}
                                                className={`p-3 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center ${
                                                    ttsSpeed === item.id
                                                        ? 'bg-arena-500/25 border-arena-400 text-white shadow-[0_0_15px_rgba(245,197,24,0.2)] font-bold'
                                                        : 'bg-dark-900/80 border-dark-600/80 text-neutral-300 hover:border-dark-500 hover:text-white'
                                                }`}
                                            >
                                                <span className="text-sm font-black text-arena-300 mb-0.5">{item.rate}</span>
                                                <span className="text-xs font-bold">{item.label}</span>
                                                <span className="text-[10px] text-neutral-400 mt-0.5">{item.desc}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Ajuste dinâmico ao tempo restante */}
                                <div className="flex items-center justify-between gap-4 p-4 rounded-xl bg-dark-900/70 border border-dark-600/60">
                                    <div>
                                        <div className="text-base font-bold text-white mb-0.5">Ajustar ao tempo restante</div>
                                        <div className="text-sm text-neutral-300 font-medium leading-relaxed">
                                            Acelera moderadamente a leitura se o tempo da questão for curto, mantendo a voz compreensível
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        role="switch"
                                        aria-checked={ttsAutoAdjust}
                                        onClick={() => setTtsAutoAdjust(!ttsAutoAdjust)}
                                        className={`w-14 h-8 rounded-full transition-colors relative shrink-0 p-1 cursor-pointer ${
                                            ttsAutoAdjust ? 'bg-arena-500' : 'bg-dark-600'
                                        }`}
                                    >
                                        <span className={`block w-6 h-6 rounded-full bg-white shadow-md transition-transform ${
                                            ttsAutoAdjust ? 'translate-x-6' : 'translate-x-0'
                                        }`} />
                                    </button>
                                </div>

                                {/* Auto-leitura ao iniciar */}
                                <div className="flex items-center justify-between gap-4 p-4 rounded-xl bg-dark-900/70 border border-dark-600/60">
                                    <div>
                                        <div className="text-base font-bold text-white mb-0.5">Auto-leitura ao Iniciar Questão</div>
                                        <div className="text-sm text-neutral-300 font-medium leading-relaxed">
                                            Narra a pergunta automaticamente assim que a rodada começa
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        role="switch"
                                        aria-checked={ttsAutoPlay}
                                        onClick={() => setTtsAutoPlay(!ttsAutoPlay)}
                                        className={`w-14 h-8 rounded-full transition-colors relative shrink-0 p-1 cursor-pointer ${
                                            ttsAutoPlay ? 'bg-arena-500' : 'bg-dark-600'
                                        }`}
                                    >
                                        <span className={`block w-6 h-6 rounded-full bg-white shadow-md transition-transform ${
                                            ttsAutoPlay ? 'translate-x-6' : 'translate-x-0'
                                        }`} />
                                    </button>
                                </div>

                                <div className="pt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                                    <span className="text-sm text-neutral-300 font-medium">Testar leitura por voz:</span>
                                    <button
                                        onClick={handleTestTts}
                                        className="px-4 py-2.5 rounded-xl bg-arena-500/20 hover:bg-arena-500/30 border border-arena-500/50 text-arena-300 text-sm font-bold flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
                                    >
                                        <Volume2 className={`w-4 h-4 ${isSpeaking ? 'animate-pulse text-arena-400' : ''}`} />
                                        {isSpeaking ? 'Parar Leitura' : 'Ouvir Demonstração'}
                                    </button>
                                </div>
                            </section>

                            {/* 4. Conforto Visual / Redução de Movimento */}
                            <section className="bg-dark-800/40 border border-dark-600/60 p-4 sm:p-5 rounded-2xl shadow-sm">
                                <div className="flex items-center gap-2.5 mb-3">
                                    <Sparkles className="w-5 h-5 text-arena-400" />
                                    <h3 className="text-base font-bold uppercase tracking-wider text-arena-300">
                                        Conforto Visual e Baixo Estímulo
                                    </h3>
                                </div>
                                <div className="flex items-center justify-between gap-4 p-4 rounded-xl bg-dark-900/70 border border-dark-600/60">
                                    <div>
                                        <div className="text-base font-bold text-white mb-0.5">Reduzir Movimentos e Efeitos</div>
                                        <div className="text-sm text-neutral-300 font-medium leading-relaxed">
                                            Desativa tremores de tela, poeira de areia giratória e rotações intensas (ideal para TDAH, autismo e labirintite)
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        role="switch"
                                        aria-checked={reducedMotion}
                                        onClick={() => setReducedMotion(!reducedMotion)}
                                        className={`w-14 h-8 rounded-full transition-colors relative shrink-0 p-1 cursor-pointer ${
                                            reducedMotion ? 'bg-arena-500' : 'bg-dark-600'
                                        }`}
                                    >
                                        <span className={`block w-6 h-6 rounded-full bg-white shadow-md transition-transform ${
                                            reducedMotion ? 'translate-x-6' : 'translate-x-0'
                                        }`} />
                                    </button>
                                </div>
                            </section>

                            {/* 5. Feedback Háptico (Vibração no Celular) */}
                            <section className="bg-dark-800/40 border border-dark-600/60 p-4 sm:p-5 rounded-2xl shadow-sm space-y-4">
                                <div className="flex items-center gap-2.5">
                                    <Vibrate className="w-5 h-5 text-arena-400" />
                                    <h3 className="text-base font-bold uppercase tracking-wider text-arena-300">
                                        Vibração Tátil no Celular (Háptica)
                                    </h3>
                                </div>
                                <div className="flex items-center justify-between gap-4 p-4 rounded-xl bg-dark-900/70 border border-dark-600/60">
                                    <div>
                                        <div className="text-base font-bold text-white mb-0.5">Vibração ao Interagir</div>
                                        <div className="text-sm text-neutral-300 font-medium leading-relaxed">
                                            Emite uma leve resposta tátil ao selecionar respostas e nos últimos 5s do cronômetro
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        role="switch"
                                        aria-checked={hapticFeedback}
                                        onClick={() => setHapticFeedback(!hapticFeedback)}
                                        className={`w-14 h-8 rounded-full transition-colors relative shrink-0 p-1 cursor-pointer ${
                                            hapticFeedback ? 'bg-arena-500' : 'bg-dark-600'
                                        }`}
                                    >
                                        <span className={`block w-6 h-6 rounded-full bg-white shadow-md transition-transform ${
                                            hapticFeedback ? 'translate-x-6' : 'translate-x-0'
                                        }`} />
                                    </button>
                                </div>
                                <div className="pt-1 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                                    <span className="text-sm text-neutral-300 font-medium">Testar vibração do smartphone:</span>
                                    <button
                                        onClick={handleTestVibration}
                                        className="px-4 py-2.5 rounded-xl bg-arena-500/20 hover:bg-arena-500/30 border border-arena-500/50 text-arena-300 text-sm font-bold flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
                                    >
                                        <Vibrate className="w-4 h-4" />
                                        Testar Vibração
                                    </button>
                                </div>
                            </section>

                        </div>

                        {/* ──── 3. RODAPÉ FIXO (Sempre Visível na Base) ──── */}
                        <div className="shrink-0 p-4 sm:p-5 border-t border-dark-600/80 flex items-center justify-between bg-[#1a1714] sticky bottom-0 z-20">
                            <button
                                onClick={resetToDefaults}
                                className="text-sm text-neutral-400 hover:text-arena-400 transition-colors flex items-center gap-2 font-bold cursor-pointer py-2 px-3 rounded-lg hover:bg-dark-800"
                            >
                                <RotateCcw className="w-4 h-4" />
                                Restaurar Padrões
                            </button>
                            <button
                                onClick={() => {
                                    stopSpeaking();
                                    setIsOpen(false);
                                }}
                                className="btn-primary py-2.5 px-7 text-base font-black flex items-center gap-2 cursor-pointer shadow-lg"
                            >
                                Concluir
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
