import '../css/app.css';

import { createInertiaApp } from '@inertiajs/react';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { createRoot } from 'react-dom/client';

const defaultAppName = import.meta.env.VITE_APP_NAME || 'Unique Distributors';

createInertiaApp({
    title: (title) => {
        const resolvedName = (typeof window !== 'undefined' && (window as any).__appName) || defaultAppName;
        return title ? `${title} - ${resolvedName}` : resolvedName;
    },
    resolve: (name) =>
        resolvePageComponent<any>(
            `./Pages/${name}.tsx`,
            import.meta.glob('./Pages/**/*.tsx'),
        ),
    setup({ el, App, props }) {
        if (typeof window !== 'undefined') {
            const pageProps = props.initialPage.props as any;
            (window as any).__appName = pageProps?.identity?.name || pageProps?.appName || defaultAppName;
        }
        const root = createRoot(el);
        root.render(<App {...props} />);
    },
    progress: {
        color: '#2563eb',
    },
});
