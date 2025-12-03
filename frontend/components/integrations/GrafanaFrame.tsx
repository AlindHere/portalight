interface IFrameProps {
    url: string;
    title: string;
    height?: string;
}

export default function GrafanaFrame({ url, title, height = '600px' }: IFrameProps) {
    if (!url) {
        return (
            <div style={{
                padding: '2rem',
                textAlign: 'center',
                color: 'var(--text-secondary)',
                border: '1px dashed var(--text-tertiary)',
                borderRadius: 'var(--radius-lg)'
            }}>
                <p>No Grafana dashboard configured for this service</p>
            </div>
        );
    }

    return (
        <div style={{
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
            boxShadow: 'var(--shadow-md)'
        }}>
            <iframe
                src={url}
                title={title}
                width="100%"
                height={height}
                style={{ border: 'none', display: 'block' }}
                loading="lazy"
            />
        </div>
    );
}
