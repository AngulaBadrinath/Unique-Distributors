import React, { lazy, Suspense } from 'react';

// Development-only dynamic import of Agentation to guarantee zero production bundle overhead
const AgentationComponent = import.meta.env.DEV
    ? lazy(() => import('agentation').then((m) => ({ default: m.Agentation })))
    : null;

export default function DevAgentation() {
    if (!import.meta.env.DEV || !AgentationComponent) {
        return null;
    }

    return (
        <Suspense fallback={null}>
            <AgentationComponent
                appName="Unique Jersey Wholesale"
                endpoint="http://localhost:4747"
                enableKeyboardShortcuts={true}
            />
        </Suspense>
    );
}
