import { useState, useEffect } from 'react';

/**
 * useDebounce hook
 * Delays updating the debounced value until after delayMs milliseconds 
 * have passed since the last time the input value changed.
 * Prevents firing multiple rapid HTTP requests while the user is typing.
 */
export function useDebounce<T>(value: T, delayMs: number = 350): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delayMs);

        return () => {
            clearTimeout(handler);
        };
    }, [value, delayMs]);

    return debouncedValue;
}
