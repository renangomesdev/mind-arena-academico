import React from 'react';
import { getAvatarInfo } from '../constants/avatars';

interface AvatarImageProps {
    avatar?: string;
    className?: string;
    alt?: string;
}

export const AvatarImage: React.FC<AvatarImageProps> = ({ 
    avatar, 
    className = 'w-8 h-8 rounded-full', 
    alt 
}) => {
    const info = getAvatarInfo(avatar);
    return (
        <img 
            src={info.image} 
            alt={alt || info.name} 
            className={`object-cover rounded-full select-none pointer-events-none ${className}`}
            loading="lazy"
            onError={(e) => {
                // Em caso de falha de carregamento, usa o fallback
                const target = e.currentTarget;
                target.src = '/avatars/centurion.png';
            }}
        />
    );
};
