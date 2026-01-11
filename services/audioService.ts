export class AudioService {
  private audioContext: AudioContext | null = null;
  private audioBuffer: AudioBuffer | null = null;
  private sourceNode: AudioBufferSourceNode | null = null;
  private analyser: AnalyserNode | null = null;
  private gainNode: GainNode | null = null;
  
  // FX Chain
  private lowpassFilter: BiquadFilterNode | null = null;
  private highpassFilter: BiquadFilterNode | null = null;
  private peakingFilter: BiquadFilterNode | null = null; // For speech clarity (simulating AI reconstruction)
  private compressor: DynamicsCompressorNode | null = null;

  // State
  private isBypassed: boolean = false;
  private currentStrength: number = 0;
  private currentPrecision: boolean = false;

  constructor() {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    this.audioContext = new AudioContextClass();
  }

  async decodeAudio(fileData: ArrayBuffer): Promise<AudioBuffer> {
    if (!this.audioContext) throw new Error("AudioContext not initialized");
    const decoded = await this.audioContext.decodeAudioData(fileData);
    this.audioBuffer = decoded;
    return decoded;
  }

  play(onEnded?: () => void) {
    if (!this.audioContext || !this.audioBuffer) return;
    
    // Resume context if suspended
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }

    // Stop existing source
    this.stop();

    this.sourceNode = this.audioContext.createBufferSource();
    this.sourceNode.buffer = this.audioBuffer;
    
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.6;

    this.gainNode = this.audioContext.createGain();
    
    // Initialize Filters
    this.lowpassFilter = this.audioContext.createBiquadFilter();
    this.lowpassFilter.type = 'lowpass';
    this.lowpassFilter.frequency.value = 22000; 

    this.highpassFilter = this.audioContext.createBiquadFilter();
    this.highpassFilter.type = 'highpass';
    this.highpassFilter.frequency.value = 0; 

    this.peakingFilter = this.audioContext.createBiquadFilter();
    this.peakingFilter.type = 'peaking';
    this.peakingFilter.frequency.value = 3500; // Human speech presence
    this.peakingFilter.Q.value = 1.0;
    this.peakingFilter.gain.value = 0;

    this.compressor = this.audioContext.createDynamicsCompressor();
    this.compressor.threshold.value = -24;
    this.compressor.knee.value = 30;
    this.compressor.ratio.value = 1; // 1:1 initially (no compression)
    this.compressor.attack.value = 0.003;
    this.compressor.release.value = 0.25;

    // Chain: Source -> HP -> LP -> Peaking -> Compressor -> Gain -> Analyser -> Dest
    this.sourceNode.connect(this.highpassFilter);
    this.highpassFilter.connect(this.lowpassFilter);
    this.lowpassFilter.connect(this.peakingFilter);
    this.peakingFilter.connect(this.compressor);
    this.compressor.connect(this.gainNode);
    this.gainNode.connect(this.analyser);
    this.analyser.connect(this.audioContext.destination);

    // Apply current settings immediately (in case play is called after settings changed)
    this.updateNodes();

    this.sourceNode.onended = () => {
      if (onEnded) onEnded();
    };

    this.sourceNode.start(0);
  }

  stop() {
    if (this.sourceNode) {
      try {
        this.sourceNode.stop();
        this.sourceNode.disconnect();
      } catch (e) {
        // ignore if already stopped
      }
      this.sourceNode = null;
    }
  }

  getAnalyser(): AnalyserNode | null {
    return this.analyser;
  }

  /**
   * Updates the simulated DeepFilterNet parameters
   */
  setDeepFilterNetConfig(strength: number, highPrecision: boolean) {
    this.currentStrength = strength; // 0.0 - 1.0
    this.currentPrecision = highPrecision;
    this.updateNodes();
  }

  toggleBypass(bypass: boolean) {
    this.isBypassed = bypass;
    this.updateNodes();
  }

  private updateNodes() {
    if (!this.audioContext || !this.lowpassFilter || !this.highpassFilter || !this.peakingFilter || !this.compressor) return;

    const t = this.audioContext.currentTime;
    const rampTime = 0.2;

    if (this.isBypassed) {
      this.lowpassFilter.frequency.setTargetAtTime(22000, t, rampTime);
      this.highpassFilter.frequency.setTargetAtTime(0, t, rampTime);
      this.peakingFilter.gain.setTargetAtTime(0, t, rampTime);
      this.compressor.ratio.setTargetAtTime(1, t, rampTime);
      return;
    }

    const s = this.currentStrength;
    const hp = this.currentPrecision;

    // DeepFilterNet Characteristic Simulation
    // 1. Bandwidth limitation (Noise suppression usually kills very high freqs)
    // High Precision attempts to keep more high end while being smarter about noise.
    // Standard mode is more aggressive on the LP.
    const lpTarget = hp ? 20000 - (s * 4000) : 16000 - (s * 8000); 
    
    // 2. Low end rumble removal
    const hpTarget = hp ? 50 + (s * 100) : 100 + (s * 300);

    // 3. Speech Clarity (Peaking) - AI reconstruction tends to boost presence
    const peakGain = hp ? s * 4 : s * 2; // Subtle boost in HP mode

    // 4. Dynamics - "Denoising" often acts like a downward expander/gate, but here we simulate the evenness of AI output
    const compRatio = hp ? 12 : 4; // High precision = tighter control (simulated)
    const compThresh = hp ? -30 : -24;

    this.lowpassFilter.frequency.setTargetAtTime(Math.max(2000, lpTarget), t, rampTime);
    this.highpassFilter.frequency.setTargetAtTime(Math.min(1000, hpTarget), t, rampTime);
    this.peakingFilter.gain.setTargetAtTime(peakGain, t, rampTime);
    
    this.compressor.ratio.setTargetAtTime(1 + (s * (compRatio - 1)), t, rampTime);
    this.compressor.threshold.setTargetAtTime(compThresh, t, rampTime);
  }

  /**
   * Renders the audio to a Blob using OfflineAudioContext
   */
  async renderProcessedAudio(denoiseStrength: number, highPrecision: boolean): Promise<Blob> {
    if (!this.audioBuffer) throw new Error("No audio loaded");

    const offlineCtx = new OfflineAudioContext(
      this.audioBuffer.numberOfChannels,
      this.audioBuffer.length,
      this.audioBuffer.sampleRate
    );

    const source = offlineCtx.createBufferSource();
    source.buffer = this.audioBuffer;

    const lp = offlineCtx.createBiquadFilter();
    lp.type = 'lowpass';
    const hp = offlineCtx.createBiquadFilter();
    hp.type = 'highpass';
    const peak = offlineCtx.createBiquadFilter();
    peak.type = 'peaking';
    peak.frequency.value = 3500;
    peak.Q.value = 1.0;
    const comp = offlineCtx.createDynamicsCompressor();

    // Logic duplicating updateNodes for offline render
    const s = denoiseStrength;
    const isHp = highPrecision;

    lp.frequency.value = Math.max(2000, isHp ? 20000 - (s * 4000) : 16000 - (s * 8000));
    hp.frequency.value = Math.min(1000, isHp ? 50 + (s * 100) : 100 + (s * 300));
    peak.gain.value = isHp ? s * 4 : s * 2;
    comp.ratio.value = 1 + (s * (isHp ? 11 : 3));
    comp.threshold.value = isHp ? -30 : -24;
    comp.attack.value = 0.003;
    comp.release.value = 0.25;

    // Chain
    source.connect(hp);
    hp.connect(lp);
    lp.connect(peak);
    peak.connect(comp);
    comp.connect(offlineCtx.destination);

    source.start(0);

    const renderedBuffer = await offlineCtx.startRendering();
    return this.bufferToWave(renderedBuffer, renderedBuffer.length);
  }

  // Helper to convert AudioBuffer to WAV Blob
  private bufferToWave(abuffer: AudioBuffer, len: number) {
    let numOfChan = abuffer.numberOfChannels,
        length = len * numOfChan * 2 + 44,
        buffer = new ArrayBuffer(length),
        view = new DataView(buffer),
        channels = [], i, sample,
        offset = 0,
        pos = 0;

    // write WAVE header
    setUint32(0x46464952);                         // "RIFF"
    setUint32(length - 8);                         // file length - 8
    setUint32(0x45564157);                         // "WAVE"

    setUint32(0x20746d66);                         // "fmt " chunk
    setUint32(16);                                 // length = 16
    setUint16(1);                                  // PCM (uncompressed)
    setUint16(numOfChan);
    setUint32(abuffer.sampleRate);
    setUint32(abuffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
    setUint16(numOfChan * 2);                      // block-align
    setUint16(16);                                 // 16-bit (hardcoded in this example)

    setUint32(0x61746164);                         // "data" - chunk
    setUint32(length - pos - 4);                   // chunk length

    // write interleaved data
    for(i = 0; i < abuffer.numberOfChannels; i++)
      channels.push(abuffer.getChannelData(i));

    while(pos < len) {
      for(i = 0; i < numOfChan; i++) {             // interleave channels
        sample = Math.max(-1, Math.min(1, channels[i][pos])); // clamp
        sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767)|0; // scale to 16-bit signed int
        view.setInt16(44 + offset, sample, true); // write 16-bit sample
        offset += 2;
      }
      pos++;
    }

    return new Blob([buffer], {type: "audio/wav"});

    function setUint16(data: any) {
      view.setUint16(pos, data, true);
      pos += 2;
    }

    function setUint32(data: any) {
      view.setUint32(pos, data, true);
      pos += 4;
    }
  }
}