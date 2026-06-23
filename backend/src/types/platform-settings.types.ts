import type { Document } from 'mongoose';

export interface IPlatformSettings {
    key: string;
    value: Record<string, any>;
    updatedAt: Date;
}

export interface IPlatformSettingsDocument extends IPlatformSettings, Document {}
