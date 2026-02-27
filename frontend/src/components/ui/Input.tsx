import React, { InputHTMLAttributes } from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', label, error, ...props }, ref) => {
    return (
        <div className="flex flex-col gap-1.5 w-full">
            {label && (
                <label className="text-sm font-medium text-gray-700">
                    {label}
                </label>
            )}
            <input
                type={type}
                className={cn(
                    "flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50 transition-colors",
                    error && "border-red-500 focus:ring-red-500",
                    className
                )}
                ref={ref}
                {...props}
            />
            {error && <span className="text-xs text-red-500 mt-1">{error}</span>}
        </div>
    );
  }
);
Input.displayName = 'Input';
