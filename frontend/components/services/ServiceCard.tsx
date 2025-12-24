'use client';

import { useRouter } from 'next/navigation';
import { Service } from '@/lib/types';
import styles from './ServiceCard.module.css';

interface ServiceCardProps {
    service: Service;
    onClick?: () => void;
}

export default function ServiceCard({ service, onClick }: ServiceCardProps) {
    const router = useRouter();

    const getLanguageDotClass = (language: string) => {
        const lang = language.toLowerCase();
        if (lang === 'go') return styles.dotGo;
        if (lang === 'react' || lang === 'javascript') return styles.dotReact;
        if (lang === 'python') return styles.dotPython;
        return styles.dotDefault;
    };

    const getEnvironmentClass = (env: string) => {
        if (env === 'Production') return styles.badgeProduction;
        if (env === 'Experimental') return styles.badgeExperimental;
        return styles.badgeStaging;
    };

    const handleClick = () => {
        if (onClick) {
            onClick();
        } else {
            router.push(`/services/${service.id}`);
        }
    };

    return (
        <div className={styles.card} onClick={handleClick}>
            <div className={styles.header}>
                <div className={styles.titleRow}>
                    <h3 className={styles.title}>{service.name}</h3>
                    <span className={`${styles.badge} ${getEnvironmentClass(service.environment)}`}>
                        {service.environment}
                    </span>
                </div>
            </div>

            <p className={styles.description}>{service.description}</p>

            <div className={styles.footer}>
                <div className={styles.language}>
                    <span className={`${styles.languageDot} ${getLanguageDotClass(service.language)}`}></span>
                    <span>{service.language}</span>
                </div>
                <div className={styles.tags}>
                    {service.tags.map((tag) => (
                        <span key={tag} className={styles.tag}>#{tag}</span>
                    ))}
                </div>
            </div>
        </div>
    );
}
