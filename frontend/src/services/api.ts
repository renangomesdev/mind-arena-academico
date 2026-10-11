
import axios from 'axios';

const getBaseUrl = () => {
    if (import.meta.env.VITE_BACKEND_URL) return import.meta.env.VITE_BACKEND_URL;
    return '/api';
};

export const api = axios.create({
    baseURL: getBaseUrl(),
    withCredentials: true,
});

// Interceptor transparente: anexa X-Host-Token ou X-Player-Token sem expor nada visualmente
api.interceptors.request.use((config) => {
    if (typeof window !== 'undefined' && config.url) {
        const organizerToken = sessionStorage.getItem('organizer_token');
        if (organizerToken && (config.url.startsWith('/quizzes') || config.url.startsWith('/games/quiz/'))) {
            config.headers['X-Organizer-Token'] = organizerToken;
        }
        const gameMatch = config.url.match(/\/games\/([A-Za-z0-9]{6})/);
        if (gameMatch) {
            const code = gameMatch[1].toUpperCase();
            const hostToken = sessionStorage.getItem(`host_token_${code}`);
            if (hostToken) {
                config.headers['X-Host-Token'] = hostToken;
            }
            const playerToken = sessionStorage.getItem(`player_token_${code}`);
            if (playerToken) {
                config.headers['X-Player-Token'] = playerToken;
                const playerId = sessionStorage.getItem(`player_id_${code}`);
                if (playerId) config.headers['X-Player-Id'] = playerId;
            }
        }
    }
    return config;
});

api.interceptors.response.use(response => response, error => {
    if (error.response?.status === 401 && error.config?.url !== '/organizer/login') {
        sessionStorage.removeItem('organizer_token');
        sessionStorage.removeItem('organizer_expires');
    }
    return Promise.reject(error);
});
