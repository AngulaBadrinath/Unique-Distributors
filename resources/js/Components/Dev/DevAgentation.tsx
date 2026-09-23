import React, { useEffect, useState } from 'react';
import { Agentation } from 'agentation';

export default function DevAgentation() {
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    if (!import.meta.env.DEV || !isMounted) {
        return null;
    }

    return (
        <Agentation
            appName="Unique Jersey Wholesale"
            endpoint="http://localhost:4747"
            enableKeyboardShortcuts={true}
        />
    );
}
