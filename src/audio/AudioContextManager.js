/**
 * Singleton class to manage the Web Audio API context.
 * Handles:
 * - AudioContext creation and existing check (browser policy).
 * - AnalyserNode for visualization and lip-sync.
 * - GainNode for volume control.
 */
class AudioContextManager {
    constructor() {
        this.audioContext = null;
        this.analyser = null;
        this.gainNode = null;
        this.isInitialized = false;
    }

    initialize() {
        if (this.isInitialized) return;

        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.audioContext = new AudioContext();

        // Create Analyser for lip-sync data
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 256; // High enough for vocal frequencies, low enough for performance

        // Create Gain for volume
        this.gainNode = this.audioContext.createGain();
        this.gainNode.connect(this.audioContext.destination);

        // Default connection for analysis (will be connected to source later)
        // Note: Source -> Analyser -> Gain -> Destination

        this.isInitialized = true;
        console.log('AudioContextManager initialized');
    }

    /**
     * Resumes the AudioContext if suspended (browser autoplay policy).
     */
    async resume() {
        if (this.audioContext && this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
            console.log('AudioContext resumed');
        }
    }

    getAnalyser() {
        if (!this.isInitialized) this.initialize();
        return this.analyser;
    }

    getContext() {
        if (!this.isInitialized) this.initialize();
        return this.audioContext;
    }

    /**
     * Connects an audio source (e.g., from an <audio> element) to the graph.
     * @param {HTMLMediaElement} mediaElement 
     */
    connectSource(mediaElement) {
        if (!this.isInitialized) this.initialize();

        // Create MediaElementSource if not already created/managed
        // Note: Be careful not to create multiple sources for the same element
        try {
            const source = this.audioContext.createMediaElementSource(mediaElement);
            source.connect(this.analyser);
            this.analyser.connect(this.gainNode);
        } catch (e) {
            console.warn('Source potentially already connected:', e);
        }
    }
}

export const audioManager = new AudioContextManager();
