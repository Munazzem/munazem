/**
 * Audio cues for attendance scanning using Web Audio API synthesis.
 * Zero external files, zero latency, works completely offline.
 */

class SoundEffects {
    private ctx: AudioContext | null = null;
    private isMuted: boolean = false;

    constructor() {
        if (typeof window !== 'undefined') {
            try {
                this.isMuted = localStorage.getItem('monazem_scanner_muted') === 'true';
            } catch {
                this.isMuted = false;
            }

            // Unlock audio context on first user interaction
            const unlock = () => {
                this.resume();
                window.removeEventListener('click', unlock);
                window.removeEventListener('touchstart', unlock);
            };
            window.addEventListener('click', unlock, { once: true });
            window.addEventListener('touchstart', unlock, { once: true });
        }
    }

    private getContext(): AudioContext | null {
        if (typeof window === 'undefined') return null;
        if (!this.ctx) {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            if (AudioContextClass) {
                this.ctx = new AudioContextClass();
            }
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume().catch(() => {});
        }
        return this.ctx;
    }

    public resume() {
        if (typeof window === 'undefined') return;
        const ctx = this.getContext();
        if (ctx && ctx.state === 'suspended') {
            ctx.resume().catch(() => {});
        }
    }

    public setMuted(muted: boolean) {
        this.isMuted = muted;
        if (typeof window !== 'undefined') {
            try {
                localStorage.setItem('monazem_scanner_muted', String(muted));
            } catch {}
        }
    }

    public toggleMute(): boolean {
        this.setMuted(!this.isMuted);
        return this.isMuted;
    }

    public getMuted(): boolean {
        return this.isMuted;
    }

    /**
     * Positive, crisp chime for regular attendance when student has no dues.
     * Musical note: D5 (587.3Hz) to A5 (880Hz)
     */
    public playSuccess() {
        if (this.isMuted) return;
        try {
            const ctx = this.getContext();
            if (!ctx) return;

            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(587.33, now);
            osc.frequency.exponentialRampToValueAtTime(880, now + 0.12);

            gain.gain.setValueAtTime(0.18, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(now);
            osc.stop(now + 0.28);
        } catch {
            // Audio policy / autoplay restrictions fallback silently
        }
    }

    /**
     * Distinct alert chime when student is marked present BUT has dues/debt.
     * Two-tone alert pulse (E5 -> C5)
     */
    public playWarning() {
        if (this.isMuted) return;
        try {
            const ctx = this.getContext();
            if (!ctx) return;

            const now = ctx.currentTime;

            // Tone 1: 659Hz
            const osc1 = ctx.createOscillator();
            const gain1 = ctx.createGain();
            osc1.type = 'triangle';
            osc1.frequency.setValueAtTime(659.25, now);
            gain1.gain.setValueAtTime(0.22, now);
            gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
            osc1.connect(gain1);
            gain1.connect(ctx.destination);
            osc1.start(now);
            osc1.stop(now + 0.15);

            // Tone 2: 523Hz
            const osc2 = ctx.createOscillator();
            const gain2 = ctx.createGain();
            osc2.type = 'triangle';
            osc2.frequency.setValueAtTime(523.25, now + 0.16);
            gain2.gain.setValueAtTime(0.25, now + 0.16);
            gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
            osc2.connect(gain2);
            gain2.connect(ctx.destination);
            osc2.start(now + 0.16);
            osc2.stop(now + 0.42);
        } catch {
            // Fallback silently
        }
    }
}

export const soundEffects = new SoundEffects();
