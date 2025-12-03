import styles from './StatsCard.module.css';

interface StatsCardProps {
    title: string;
    value: string | number;
    icon: React.ReactNode;
}

export default function StatsCard({ title, value, icon }: StatsCardProps) {
    return (
        <div className={styles.card}>
            <div className={styles.content}>
                <div className={styles.text}>
                    <p className={styles.title}>{title}</p>
                    <p className={styles.value}>{value}</p>
                </div>
                <div className={styles.icon}>
                    {icon}
                </div>
            </div>
        </div>
    );
}
