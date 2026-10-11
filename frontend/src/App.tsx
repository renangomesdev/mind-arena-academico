import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import CreateQuiz from './pages/CreateQuiz';
import GameHost from './pages/GameHost';
import GamePlayer from './pages/GamePlayer';
import logo from './assets/logo.png';
import bgImage from './assets/bg-colosseum.jpg';
import SoundToggle from './components/SoundToggle';
import AccessibilityModal from './components/AccessibilityModal';
import VersionUpdateBanner from './components/VersionUpdateBanner';
import { AccessibilityProvider } from './contexts/AccessibilityContext';
import { OrganizerProvider } from './contexts/OrganizerContext';
import './index.css';

function App() {
  return (
    <AccessibilityProvider>
      <OrganizerProvider>
      <Router>
        <VersionUpdateBanner />
        <div className="no-print fixed inset-0 z-[-1] overflow-hidden pointer-events-none">
          <div className="absolute inset-0 bg-dark-900/75 z-10 backdrop-blur-[2px]" />
          <img src={bgImage} alt="" className="w-full h-full object-cover blur-sm opacity-40 scale-105" />
        </div>

        <div className="min-h-screen flex flex-col relative z-0">
          <header className="no-print px-3 sm:px-5 py-2.5 sm:py-3 sticky top-0 z-50 bg-dark-800/80 backdrop-blur-xl border-b border-dark-600/60 max-w-5xl mx-auto w-full rounded-none sm:rounded-b-2xl shadow-lg transition-all pt-[max(0.625rem,env(safe-area-inset-top))]">
            <div className="flex items-center justify-between gap-2 w-full">
              {/* Marca & Logotipo (Seguro contra colisões e quebras no mobile) */}
              <a 
                href="/" 
                aria-label="Mind Arena - Voltar para Página Inicial"
                className="flex items-center gap-2.5 sm:gap-3 group select-none active:scale-95 transition-transform touch-manipulation focus-visible:ring-2 focus-visible:ring-arena-400 focus-visible:outline-none rounded-xl p-1 -m-1"
              >
                <img
                  src={logo}
                  alt="Mind Arena Logo"
                  className="h-9 w-9 sm:h-11 sm:w-11 rounded-xl object-contain drop-shadow-[0_4px_12px_rgba(234,179,8,0.25)] group-hover:scale-105 transition-transform"
                />
                <div className="flex flex-col">
                  <span className="text-base sm:text-xl font-black tracking-wider text-gradient-gold leading-tight">
                    MIND ARENA
                  </span>
                  <span className="text-[9px] font-bold text-arena-400/70 tracking-widest uppercase hidden xs:block sm:hidden">
                    Coliseu do Saber
                  </span>
                </div>
              </a>

              {/* Controles de Utilidade (Área de toque >= 44x44px garantida) */}
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                <AccessibilityModal />
                <SoundToggle />
              </div>
            </div>
          </header>
          <main className="flex-1 w-full p-3 sm:p-4 md:p-6 max-w-5xl mx-auto">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/create-quiz" element={<CreateQuiz />} />
              <Route path="/host/:code" element={<GameHost />} />
              <Route path="/play/:code" element={<GamePlayer />} />
            </Routes>
          </main>
        </div>
      </Router>
      </OrganizerProvider>
    </AccessibilityProvider>
  );
}

export default App;
