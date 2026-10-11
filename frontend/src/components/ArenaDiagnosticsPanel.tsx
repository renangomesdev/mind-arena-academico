import { useEffect, useRef, useState } from 'react';
import { Activity, LockKeyhole, UnlockKeyhole, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { api } from '../services/api';

type HealthLevel = 'NORMAL' | 'ATTENTION' | 'UNAVAILABLE';
interface Diagnostics {
    health: { overall: HealthLevel; memory: HealthLevel; processing: HealthLevel; connections: HealthLevel };
    activity: { requestsLastMinute: number; limitedRequestsLastMinute: number; failedRequestsLastMinute: number; newPlayersLastMinute: number; connectedSessions: number };
    admission: { activePlayers: number; joinLocked: boolean; canChangeEntries: boolean };
}
interface Props { code: string; onClose: () => void; onEntriesChanged: () => void }

const levelLabels: Record<HealthLevel, string> = { NORMAL: 'Normal', ATTENTION: 'Atenção', UNAVAILABLE: 'Sem leitura' };
const levelColors: Record<HealthLevel, string> = { NORMAL: 'text-emerald-300', ATTENTION: 'text-amber-300', UNAVAILABLE: 'text-dark-300' };

export default function ArenaDiagnosticsPanel({ code, onClose, onEntriesChanged }: Props) {
    const [data, setData] = useState<Diagnostics | null>(null);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [refreshVersion, setRefreshVersion] = useState(0);
    const [responseTime, setResponseTime] = useState(0);
    const [updatedAt, setUpdatedAt] = useState('');
    const dialog = useRef<HTMLDivElement>(null);
    const closeButton = useRef<HTMLButtonElement>(null);
    const actionController = useRef<AbortController | null>(null);

    useEffect(() => {
        closeButton.current?.focus();
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = previousOverflow; actionController.current?.abort(); };
    }, []);

    useEffect(() => {
        let active = true;
        let fetching = false;
        const controller = new AbortController();
        const update = async () => {
            if (!active || fetching || document.visibilityState !== 'visible') return;
            fetching = true;
            const started = performance.now();
            try {
                const response = await api.get<Diagnostics>(`/games/${code}/diagnostics`, { signal: controller.signal, timeout: 8000 });
                if (active) {
                    setData(response.data);
                    setResponseTime(Math.round(performance.now() - started));
                    setUpdatedAt(new Date().toLocaleTimeString());
                    setError('');
                }
            } catch {
                if (active) setError('Não foi possível atualizar. Verifique a conexão; os dados anteriores podem estar desatualizados.');
            } finally { fetching = false; }
        };
        void update();
        const interval = window.setInterval(() => { void update(); }, 5000);
        const onVisible = () => { if (document.visibilityState === 'visible') void update(); };
        document.addEventListener('visibilitychange', onVisible);
        window.addEventListener('online', onVisible);
        return () => {
            active = false; controller.abort(); window.clearInterval(interval);
            document.removeEventListener('visibilitychange', onVisible);
            window.removeEventListener('online', onVisible);
        };
    }, [code, refreshVersion]);

    const changeEntries = async () => {
        if (!data?.admission.canChangeEntries || busy) return;
        setBusy(true); setError('');
        const controller = new AbortController();
        actionController.current = controller;
        try {
            await api.post(`/games/${code}/lobby-lock`, { enable: !data.admission.joinLocked }, { signal: controller.signal, timeout: 8000 });
            if (!controller.signal.aborted) { onEntriesChanged(); setRefreshVersion(previous => previous + 1); }
        } catch {
            if (!controller.signal.aborted) setError('Não foi possível alterar as entradas. A partida pode já ter começado.');
        } finally { if (!controller.signal.aborted) setBusy(false); }
    };

    const badge = (label: string, level: HealthLevel) => <div className="bg-dark-900/70 rounded-xl p-3 border border-dark-600/40">
        <dt className="text-xs text-dark-300 mb-2">{label}</dt>
        <dd className={`text-sm font-bold ${levelColors[level]}`}>{levelLabels[level]}</dd>
    </div>;
    const counter = (label: string, value: number) => <div className="bg-dark-900/70 rounded-xl p-3">
        <dt className="text-xs text-dark-300 mb-1">{label}</dt>
        <dd className="text-xl font-black text-arena-300">{value}</dd>
    </div>;

    return createPortal(<div className="no-print fixed inset-0 z-[100] bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5"
        onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
        <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="arena-diagnostics-heading"
            className="card-arena w-full max-w-xl max-h-[90vh] overflow-y-auto p-5 sm:p-6 text-left shadow-2xl"
            onKeyDown={event => {
                if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose(); }
                if (event.key === 'Tab') {
                    const controls = Array.from(dialog.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') || []);
                    const first = controls[0], last = controls[controls.length - 1];
                    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
                    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
                }
            }}>
            <div className="flex items-start justify-between gap-4 mb-5">
                <div>
                    <h2 id="arena-diagnostics-heading" className="text-xl font-black text-arena-300 flex items-center gap-2"><Activity className="w-5 h-5" /> Diagnóstico da arena</h2>
                    <p className="text-xs text-dark-300 mt-2">Visão reservada ao professor. Indicadores gerais, sem dados pessoais.</p>
                </div>
                <button ref={closeButton} type="button" onClick={onClose} aria-label="Fechar diagnóstico" className="p-2 rounded-lg hover:bg-dark-700 text-dark-200"><X className="w-5 h-5" /></button>
            </div>

            {error && <p role="alert" className="mb-4 text-sm text-amber-300 bg-amber-500/10 p-3 rounded-xl">{error}</p>}
            {!data && !error && <p className="text-dark-300 py-6">Consultando indicadores...</p>}
            {data && <>
                <section aria-labelledby="arena-health-heading" className="mb-5">
                    <div className="flex items-center justify-between gap-2 mb-3">
                        <h3 id="arena-health-heading" className="font-bold text-sm">Saúde do aplicativo</h3>
                        <span className={`text-xs font-bold ${error ? 'text-dark-300' : levelColors[data.health.overall]}`}>{error ? 'Leitura desatualizada' : data.health.overall === 'NORMAL' ? 'Funcionando' : data.health.overall === 'ATTENTION' ? 'Carga elevada' : 'Leitura parcial'}</span>
                    </div>
                    <dl className="grid grid-cols-3 gap-2">
                        {badge('Memória', data.health.memory)}
                        {badge('Processamento', data.health.processing)}
                        {badge('Conexões', data.health.connections)}
                    </dl>
                    <p className="text-xs text-dark-300 mt-3">A resposta desta consulta levou {responseTime} ms. Estes sinais não cobrem toda a infraestrutura da hospedagem.</p>
                </section>

                <section aria-labelledby="arena-activity-heading" className="mb-5">
                    <h3 id="arena-activity-heading" className="font-bold text-sm mb-3">Atividade desta sala · último minuto</h3>
                    <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {counter('Requisições', data.activity.requestsLastMinute)}
                        {counter('Limitadas por excesso', data.activity.limitedRequestsLastMinute)}
                        {counter('Falhas de atendimento', data.activity.failedRequestsLastMinute)}
                        {counter('Novos participantes', data.activity.newPlayersLastMinute)}
                    </dl>
                    <p className="text-xs text-dark-300 mt-3">{data.activity.connectedSessions} {data.activity.connectedSessions === 1 ? 'conexão' : 'conexões'} em tempo real nesta sala. Picos de atividade ajudam a observar a partida; não identificam uma pessoa nem comprovam abuso.</p>
                </section>

                <section aria-labelledby="arena-admission-heading" className="bg-dark-900/70 rounded-xl p-4">
                    <h3 id="arena-admission-heading" className="font-bold text-sm mb-2">Entrada dos alunos</h3>
                    <p className="text-sm text-dark-200 mb-3">{data.admission.activePlayers} {data.admission.activePlayers === 1 ? 'participante' : 'participantes'} na sala · {!data.admission.canChangeEntries ? 'Partida iniciada ou encerrada' : data.admission.joinLocked ? 'Entradas fechadas' : 'Entradas liberadas'}</p>
                    <button type="button" disabled={busy || !data.admission.canChangeEntries} onClick={changeEntries}
                        className="w-full py-3 px-4 rounded-xl bg-dark-700 hover:bg-dark-600 text-arena-300 font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                        {data.admission.joinLocked ? <UnlockKeyhole className="w-4 h-4" /> : <LockKeyhole className="w-4 h-4" />}
                        {busy ? 'Atualizando...' : data.admission.joinLocked ? 'Liberar novas entradas' : 'Fechar novas entradas'}
                    </button>
                    <p className="text-xs text-dark-300 mt-3">Fechar entradas mantém os alunos já admitidos. Após o início, novas entradas ficam indisponíveis pela regra do jogo.</p>
                </section>
                <p className="text-xs text-dark-300 mt-4">Atualizado às {updatedAt}. A consulta automática funciona apenas com este painel aberto e a aba visível.</p>
            </>}
        </div>
    </div>, document.body);
}
