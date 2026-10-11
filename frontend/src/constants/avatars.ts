export interface AvatarOption {
    id: string;
    name: string;
    title: string;
    motto: string;
    image: string;
    fallbackEmoji: string;
    elementColor: string;
    icon: string; // Retrocompatibilidade para quem lê .icon
}

export const GLADIATOR_AVATARS: AvatarOption[] = [
    {
        id: 'centurion',
        name: 'Centurião',
        title: 'Legionário',
        motto: 'Disciplina & Honra Imperial',
        image: '/avatars/centurion.png',
        fallbackEmoji: '🛡️',
        icon: '🛡️',
        elementColor: '#ef4444'
    },
    {
        id: 'gladiator',
        name: 'Gladiador',
        title: 'Murmillo',
        motto: 'Força Bruta & Glória da Arena',
        image: '/avatars/gladiator.png',
        fallbackEmoji: '⚔️',
        icon: '⚔️',
        elementColor: '#f59e0b'
    },
    {
        id: 'assassin',
        name: 'Sicária',
        title: 'Lâmina Oculta',
        motto: 'Velocidade & Precisão Letal',
        image: '/avatars/assassin.png',
        fallbackEmoji: '🗡️',
        icon: '🗡️',
        elementColor: '#0d9488'
    },
    {
        id: 'berserker',
        name: 'Berserker',
        title: 'Fúria Nórdica',
        motto: 'Impacto & Selvageria Tribal',
        image: '/avatars/berserker.png',
        fallbackEmoji: '🪓',
        icon: '🪓',
        elementColor: '#16a34a'
    },
    {
        id: 'pharaoh',
        name: 'Faraó',
        title: 'Guardião Solar',
        motto: 'Sabedoria Milenar do Nilo',
        image: '/avatars/pharaoh.png',
        fallbackEmoji: '🏺',
        icon: '🏺',
        elementColor: '#eab308'
    },
    {
        id: 'valkyrie',
        name: 'Valquíria',
        title: 'Guerreira Celeste',
        motto: 'Coragem & Destino Implacável',
        image: '/avatars/valkyrie.png',
        fallbackEmoji: '🏹',
        icon: '🏹',
        elementColor: '#ea580c'
    },
    {
        id: 'executioner',
        name: 'Carrasco',
        title: 'Gladiador Sombrio',
        motto: 'Terror da Arena & Força Obscura',
        image: '/avatars/executioner.png',
        fallbackEmoji: '💀',
        icon: '💀',
        elementColor: '#991b1b'
    },
    {
        id: 'hoplite',
        name: 'Hoplita',
        title: 'Falange Sagrada',
        motto: 'Técnica & Escudo Inabalável',
        image: '/avatars/hoplite.png',
        fallbackEmoji: '⚡',
        icon: '⚡',
        elementColor: '#2563eb'
    },
    {
        id: 'emperor',
        name: 'Imperador',
        title: 'Caesar Supremo',
        motto: 'Glória Máxima & Triunfo Eterno',
        image: '/avatars/emperor.png',
        fallbackEmoji: '👑',
        icon: '👑',
        elementColor: '#a855f7'
    }
];

export const DEFAULT_AVATAR = 'centurion';

// Mapeamento completo com retrocompatibilidade para emojis antigos ou strings legadas
const LEGACY_AVATAR_MAP: Record<string, string> = {
    '⚔️': 'gladiator',
    '🛡️': 'centurion',
    '🦁': 'berserker',
    '🦅': 'pharaoh',
    '👑': 'emperor',
    '⚡': 'hoplite',
    '🏹': 'valkyrie',
    '🔥': 'executioner',
    'swords': 'gladiator',
    'shield': 'centurion',
    'lion': 'berserker',
    'eagle': 'pharaoh',
    'crown': 'emperor',
    'lightning': 'hoplite',
    'bow': 'valkyrie',
    'fire': 'executioner'
};

export function getAvatarInfo(avatarIdOrIcon?: string): AvatarOption {
    if (!avatarIdOrIcon) return GLADIATOR_AVATARS[0];

    const trimmed = avatarIdOrIcon.trim();

    // 1. Busca direta por ID ou Nome
    const directMatch = GLADIATOR_AVATARS.find(a => 
        a.id.toLowerCase() === trimmed.toLowerCase() ||
        a.name.toLowerCase() === trimmed.toLowerCase() ||
        a.image === trimmed
    );
    if (directMatch) return directMatch;

    // 2. Busca por emoji de fallback
    const emojiMatch = GLADIATOR_AVATARS.find(a => 
        a.fallbackEmoji === trimmed || a.icon === trimmed
    );
    if (emojiMatch) return emojiMatch;

    // 3. Mapeamento legado
    const mappedId = LEGACY_AVATAR_MAP[trimmed];
    if (mappedId) {
        const legacy = GLADIATOR_AVATARS.find(a => a.id === mappedId);
        if (legacy) return legacy;
    }

    return GLADIATOR_AVATARS[0];
}
