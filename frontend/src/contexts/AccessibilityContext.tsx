import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export type FontSize = 'normal' | 'large' | 'xlarge';
export type ColorMode = 'normal' | 'colorblind' | 'high-contrast';
export type TtsSpeed = 'normal' | 'fast' | 'very-fast';

export interface OptionVisual {
    bgClass: string;
    textClass: string;
    borderClass: string;
    shapeIcon: string;
    shapeName: string;
    accentColor: string;
}

interface AccessibilityContextType {
    fontSize: FontSize;
    setFontSize: (size: FontSize) => void;
    colorMode: ColorMode;
    setColorMode: (mode: ColorMode) => void;
    ttsAutoPlay: boolean;
    setTtsAutoPlay: (enabled: boolean) => void;
    ttsSpeed: TtsSpeed;
    setTtsSpeed: (speed: TtsSpeed) => void;
    ttsAutoAdjust: boolean;
    setTtsAutoAdjust: (enabled: boolean) => void;
    reducedMotion: boolean;
    setReducedMotion: (enabled: boolean) => void;
    hapticFeedback: boolean;
    setHapticFeedback: (enabled: boolean) => void;
    resetToDefaults: () => void;
    // TTS
    isSpeaking: boolean;
    speak: (text: string, onEnd?: () => void, remainingSeconds?: number) => void;
    stopSpeaking: () => void;
    speakQuestion: (questionText: string, options?: { text: string }[], remainingSeconds?: number) => void;
    // Haptics
    vibrate: (pattern?: number | number[]) => void;
    // Helpers
    getOptionVisuals: (index: number) => OptionVisual;
}

const STORAGE_KEY = 'mind_arena_accessibility_v1';

const SHAPES = [
    { icon: '▲', name: 'Triângulo' },
    { icon: '◆', name: 'Losango' },
    { icon: '●', name: 'Círculo' },
    { icon: '■', name: 'Quadrado' }
];

const AccessibilityContext = createContext<AccessibilityContextType | undefined>(undefined);

export const AccessibilityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // 1. Estados salvos em LocalStorage
    const [fontSize, setFontSizeState] = useState<FontSize>(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (['normal', 'large', 'xlarge'].includes(parsed.fontSize)) return parsed.fontSize;
            }
        } catch (_) {}
        return 'normal';
    });

    const [colorMode, setColorModeState] = useState<ColorMode>(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (['normal', 'colorblind', 'high-contrast'].includes(parsed.colorMode)) return parsed.colorMode;
            }
        } catch (_) {}
        return 'normal';
    });

    const [ttsAutoPlay, setTtsAutoPlayState] = useState<boolean>(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                return !!parsed.ttsAutoPlay;
            }
        } catch (_) {}
        return false;
    });

    const [ttsSpeed, setTtsSpeedState] = useState<TtsSpeed>(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (['normal', 'fast', 'very-fast'].includes(parsed.ttsSpeed)) return parsed.ttsSpeed;
            }
        } catch (_) {}
        return 'normal';
    });

    const [ttsAutoAdjust, setTtsAutoAdjustState] = useState<boolean>(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                return !!parsed.ttsAutoAdjust;
            }
        } catch (_) {}
        return false;
    });

    const [reducedMotion, setReducedMotionState] = useState<boolean>(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                return !!parsed.reducedMotion;
            }
        } catch (_) {}
        return false;
    });

    const [hapticFeedback, setHapticFeedbackState] = useState<boolean>(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                return parsed.hapticFeedback !== undefined ? !!parsed.hapticFeedback : true;
            }
        } catch (_) {}
        return true;
    });

    const [isSpeaking, setIsSpeaking] = useState(false);
    const speechSequenceRef = React.useRef(0);

    // Salvar no localStorage sempre que houver alteração
    const saveSettings = useCallback((updates: Partial<{
        fontSize: FontSize;
        colorMode: ColorMode;
        ttsAutoPlay: boolean;
        ttsSpeed: TtsSpeed;
        ttsAutoAdjust: boolean;
        reducedMotion: boolean;
        hapticFeedback: boolean;
    }>) => {
        try {
            const current = {
                fontSize,
                colorMode,
                ttsAutoPlay,
                ttsSpeed,
                ttsAutoAdjust,
                reducedMotion,
                hapticFeedback,
                ...updates
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
        } catch (_) {}
    }, [fontSize, colorMode, ttsAutoPlay, ttsSpeed, ttsAutoAdjust, reducedMotion, hapticFeedback]);

    const setFontSize = (size: FontSize) => {
        setFontSizeState(size);
        saveSettings({ fontSize: size });
    };

    const setColorMode = (mode: ColorMode) => {
        setColorModeState(mode);
        saveSettings({ colorMode: mode });
    };

    const setTtsAutoPlay = (enabled: boolean) => {
        setTtsAutoPlayState(enabled);
        saveSettings({ ttsAutoPlay: enabled });
    };

    const setTtsSpeed = (speed: TtsSpeed) => {
        setTtsSpeedState(speed);
        saveSettings({ ttsSpeed: speed });
    };

    const setTtsAutoAdjust = (enabled: boolean) => {
        setTtsAutoAdjustState(enabled);
        saveSettings({ ttsAutoAdjust: enabled });
    };

    const setReducedMotion = (enabled: boolean) => {
        setReducedMotionState(enabled);
        saveSettings({ reducedMotion: enabled });
    };

    const setHapticFeedback = (enabled: boolean) => {
        setHapticFeedbackState(enabled);
        saveSettings({ hapticFeedback: enabled });
    };

    const resetToDefaults = () => {
        setFontSizeState('normal');
        setColorModeState('normal');
        setTtsAutoPlayState(false);
        setTtsSpeedState('normal');
        setTtsAutoAdjustState(false);
        setReducedMotionState(false);
        setHapticFeedbackState(true);
        try {
            localStorage.removeItem(STORAGE_KEY);
        } catch (_) {}
        stopSpeaking();
    };

    // Aplicar classes no documento HTML para fontes e movimento
    useEffect(() => {
        const root = document.documentElement;
        
        // Font sizes
        root.classList.remove('a11y-font-large', 'a11y-font-xlarge');
        if (fontSize === 'large') root.classList.add('a11y-font-large');
        if (fontSize === 'xlarge') root.classList.add('a11y-font-xlarge');

        // Reduced motion
        if (reducedMotion) {
            root.classList.add('a11y-reduced-motion');
        } else {
            root.classList.remove('a11y-reduced-motion');
        }

        // High contrast
        if (colorMode === 'high-contrast') {
            root.classList.add('a11y-high-contrast');
        } else {
            root.classList.remove('a11y-high-contrast');
        }
    }, [fontSize, reducedMotion, colorMode]);

    // Cleanup de fala ao desmontar
    useEffect(() => {
        return () => {
            if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
                try { window.speechSynthesis.cancel(); } catch (_) {}
            }
        };
    }, []);

    // 🔊 Text-To-Speech
    const stopSpeaking = useCallback(() => {
        speechSequenceRef.current += 1;
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
            try {
                window.speechSynthesis.cancel();
            } catch (_) {}
        }
        setIsSpeaking(false);
    }, []);

    const speak = useCallback((text: string, onEnd?: () => void, remainingSeconds?: number) => {
        if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
        speechSequenceRef.current += 1;
        const currentSeq = speechSequenceRef.current;
        try {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'pt-BR';

            // Velocidade base configurada
            let baseRate = 1.0;
            if (ttsSpeed === 'fast') baseRate = 1.25;
            else if (ttsSpeed === 'very-fast') baseRate = 1.5;

            // Ajuste dinâmico moderado ao tempo restante da questão (se habilitado)
            let effectiveRate = baseRate;
            if (ttsAutoAdjust && remainingSeconds !== undefined && remainingSeconds > 0) {
                // Se restar tempo para leitura confortável (>= 3s), acelera moderadamente sem ultrapassar 1.5x
                if (remainingSeconds >= 3) {
                    const estimatedSeconds = text.length / (16 * baseRate);
                    if (estimatedSeconds > remainingSeconds) {
                        const neededRate = (estimatedSeconds / remainingSeconds) * baseRate;
                        effectiveRate = Math.min(1.5, Math.max(baseRate, neededRate));
                    }
                }
                // Se restarem menos de 3s, preserva clareza sobre pressa extrema mantendo a taxa base
            }

            utterance.rate = Math.round(effectiveRate * 100) / 100;
            utterance.pitch = 1.0;

            const voices = window.speechSynthesis.getVoices();
            const ptVoice = voices.find(v => v.lang.startsWith('pt'));
            if (ptVoice) utterance.voice = ptVoice;

            utterance.onstart = () => {
                if (speechSequenceRef.current === currentSeq) {
                    setIsSpeaking(true);
                }
            };
            utterance.onend = () => {
                if (speechSequenceRef.current === currentSeq) {
                    setIsSpeaking(false);
                    if (onEnd) onEnd();
                }
            };
            utterance.onerror = () => {
                if (speechSequenceRef.current === currentSeq) {
                    setIsSpeaking(false);
                }
            };

            window.speechSynthesis.speak(utterance);
        } catch (_) {
            if (speechSequenceRef.current === currentSeq) {
                setIsSpeaking(false);
            }
        }
    }, [ttsSpeed, ttsAutoAdjust]);

    const speakQuestion = useCallback((questionText: string, options?: { text: string }[], remainingSeconds?: number) => {
        let fullScript = `Pergunta: ${questionText}. `;
        if (options && options.length > 0) {
            const letters = ['A', 'B', 'C', 'D'];
            fullScript += options.map((opt, idx) => `Opção ${letters[idx]}: ${opt.text}.`).join(' ');
        }
        speak(fullScript, undefined, remainingSeconds);
    }, [speak]);

    // 📳 Feedback Háptico
    const vibrate = useCallback((pattern: number | number[] = 50) => {
        if (!hapticFeedback) return;
        if (typeof window !== 'undefined' && 'vibrate' in navigator) {
            try {
                navigator.vibrate(pattern);
            } catch (_) {}
        }
    }, [hapticFeedback]);

    // 🎨 Obter visuais das alternativas de acordo com o modo de acessibilidade
    const getOptionVisuals = useCallback((index: number): OptionVisual => {
        const shape = SHAPES[index % 4];

        if (colorMode === 'high-contrast') {
            const contrastPalettes = [
                {
                    bgClass: 'bg-black active:bg-neutral-900',
                    textClass: 'text-yellow-300',
                    borderClass: 'border-4 border-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.5)]',
                    accentColor: '#facc15'
                },
                {
                    bgClass: 'bg-black active:bg-neutral-900',
                    textClass: 'text-white',
                    borderClass: 'border-4 border-white shadow-[0_0_20px_rgba(255,255,255,0.4)]',
                    accentColor: '#ffffff'
                },
                {
                    bgClass: 'bg-black active:bg-neutral-900',
                    textClass: 'text-cyan-300',
                    borderClass: 'border-4 border-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.5)]',
                    accentColor: '#22d3ee'
                },
                {
                    bgClass: 'bg-black active:bg-neutral-900',
                    textClass: 'text-orange-300',
                    borderClass: 'border-4 border-orange-400 shadow-[0_0_20px_rgba(251,146,60,0.5)]',
                    accentColor: '#fb923c'
                }
            ];
            const p = contrastPalettes[index % 4];
            return {
                bgClass: p.bgClass,
                textClass: p.textClass,
                borderClass: p.borderClass,
                shapeIcon: shape.icon,
                shapeName: shape.name,
                accentColor: p.accentColor
            };
        }

        if (colorMode === 'colorblind') {
            // Paleta otimizada para daltonismo (Protanopia/Deuteranopia: Laranja Vivo, Azul Escuro, Amarelo Ouro, Turquesa)
            const colorblindPalettes = [
                {
                    bgClass: 'bg-gradient-to-br from-orange-500 to-amber-600 active:from-orange-600 active:to-amber-700 shadow-orange-500/30',
                    textClass: 'text-white',
                    borderClass: 'border-2 border-orange-300/60',
                    accentColor: '#f97316'
                },
                {
                    bgClass: 'bg-gradient-to-br from-blue-600 to-indigo-700 active:from-blue-700 active:to-indigo-800 shadow-blue-600/30',
                    textClass: 'text-white',
                    borderClass: 'border-2 border-blue-300/60',
                    accentColor: '#2563eb'
                },
                {
                    bgClass: 'bg-gradient-to-br from-yellow-400 to-amber-500 active:from-yellow-500 active:to-amber-600 shadow-yellow-400/30',
                    textClass: 'text-black font-extrabold',
                    borderClass: 'border-2 border-yellow-200/90',
                    accentColor: '#facc15'
                },
                {
                    bgClass: 'bg-gradient-to-br from-teal-500 to-cyan-700 active:from-teal-600 active:to-cyan-800 shadow-teal-500/30',
                    textClass: 'text-white',
                    borderClass: 'border-2 border-cyan-300/60',
                    accentColor: '#14b8a6'
                }
            ];
            const p = colorblindPalettes[index % 4];
            return {
                bgClass: p.bgClass,
                textClass: p.textClass,
                borderClass: p.borderClass,
                shapeIcon: shape.icon,
                shapeName: shape.name,
                accentColor: p.accentColor
            };
        }

        // Padrão Mind Arena (Coliseu Vermelho, Azul, Dourado, Verde)
        const defaultPalettes = [
            {
                bgClass: 'bg-gradient-to-br from-red-500 to-red-600 active:from-red-600 active:to-red-700 shadow-red-500/30',
                textClass: 'text-white',
                borderClass: 'border border-red-400/30',
                accentColor: '#ef4444'
            },
            {
                bgClass: 'bg-gradient-to-br from-blue-500 to-blue-600 active:from-blue-600 active:to-blue-700 shadow-blue-500/30',
                textClass: 'text-white',
                borderClass: 'border border-blue-400/30',
                accentColor: '#3b82f6'
            },
            {
                bgClass: 'bg-gradient-to-br from-yellow-500 to-amber-600 active:from-amber-600 active:to-amber-700 shadow-yellow-500/30',
                textClass: 'text-white',
                borderClass: 'border border-yellow-400/30',
                accentColor: '#f59e0b'
            },
            {
                bgClass: 'bg-gradient-to-br from-green-500 to-emerald-600 active:from-emerald-600 active:to-emerald-700 shadow-green-500/30',
                textClass: 'text-white',
                borderClass: 'border border-green-400/30',
                accentColor: '#10b981'
            }
        ];
        const p = defaultPalettes[index % 4];
        return {
            bgClass: p.bgClass,
            textClass: p.textClass,
            borderClass: p.borderClass,
            shapeIcon: shape.icon,
            shapeName: shape.name,
            accentColor: p.accentColor
        };
    }, [colorMode]);

    return (
        <AccessibilityContext.Provider
            value={{
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
                isSpeaking,
                speak,
                stopSpeaking,
                speakQuestion,
                vibrate,
                getOptionVisuals
            }}
        >
            {children}
        </AccessibilityContext.Provider>
    );
};

export const useAccessibility = (): AccessibilityContextType => {
    const context = useContext(AccessibilityContext);
    if (!context) {
        throw new Error('useAccessibility must be used within an AccessibilityProvider');
    }
    return context;
};
