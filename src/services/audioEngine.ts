/**
 * Chiptune Hardware Workstation - Audio Engine & Studio Simulator
 * Provides real-time WebAudio synthesis, MOTU/AVB ASIO emulation,
 * multichannel mixing, dual external FX loops, and stereo mastering return capture.
 */

import { MidiSongModel, MixerStrip, VoiceId } from '../types/index.ts';

// Note to Frequency helper
export function midiNoteToFrequency(note: number): number {
  return 440 * Math.pow(2, (note - 69) / 12);
}

export interface MeterData {
  stripId: string;
  peakL: number;
  peakR: number;
  rmsL: number;
  rmsR: number;
  clipL: boolean;
  clipR: boolean;
}

export class StudioAudioEngine {
  private ctx: AudioContext | null = null;
  private isRunning = false;
  private isPaused = false;
  private startTime = 0;
  private pauseOffset = 0;
  private songModel: MidiSongModel | null = null;

  // Strips gain & pan nodes
  private stripNodes = new Map<
    string,
    {
      input: GainNode;
      trim: GainNode;
      pan: StereoPannerNode;
      fader: GainNode;
      sendA: GainNode;
      sendB: GainNode;
      analyserL: AnalyserNode;
      analyserR: AnalyserNode;
    }
  >();

  // FX Loop Nodes
  private fxASendGain: GainNode | null = null;
  private fxBSendGain: GainNode | null = null;
  private fxAReturnGain: GainNode | null = null;
  private fxBReturnGain: GainNode | null = null;
  private fxADelayNode: DelayNode | null = null;
  private fxBReverbNode: ConvolverNode | null = null;

  // Master bus & Mastering hardware loop
  private masterSendGain: GainNode | null = null;
  private masteringProcessorGain: GainNode | null = null;
  private masteringReturnGain: GainNode | null = null;
  private masterOutputGain: GainNode | null = null;
  private masteringAnalyserL: AnalyserNode | null = null;
  private masteringAnalyserR: AnalyserNode | null = null;

  // Recording capture buffer
  private recordingNode: ScriptProcessorNode | null = null;
  private isRecording = false;
  private recordedChunksL: Float32Array[] = [];
  private recordedChunksR: Float32Array[] = [];
  private recordedSampleCount = 0;

  // Active playing voices
  private activeOscillators = new Map<string, { osc: OscillatorNode | AudioNode; gain: GainNode }>();

  // Event dispatchers
  private onPlaybackProgress?: (currentSec: number, totalSec: number, currentTick: number) => void;
  private onMeterUpdate?: (meters: MeterData[]) => void;
  private timerHandle: number | null = null;

  constructor() {
    // Lazy AudioContext initialization on first user interaction
  }

  public initAudio(): AudioContext {
    if (!this.ctx) {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtxClass();
      this.buildTopology();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  private buildTopology() {
    if (!this.ctx) return;
    const ctx = this.ctx;

    // 1. External FX Loop A: Stereo Ping-Pong / Tape Delay
    this.fxASendGain = ctx.createGain();
    this.fxAReturnGain = ctx.createGain();
    this.fxADelayNode = ctx.createDelay(2.0);
    this.fxADelayNode.delayTime.value = 0.25; // 1/8th note delay
    const delayFeedback = ctx.createGain();
    delayFeedback.gain.value = 0.45;
    const delayFilter = ctx.createBiquadFilter();
    delayFilter.type = 'lowpass';
    delayFilter.frequency.value = 4500;

    this.fxASendGain.connect(this.fxADelayNode);
    this.fxADelayNode.connect(delayFilter);
    delayFilter.connect(delayFeedback);
    delayFeedback.connect(this.fxADelayNode);
    delayFilter.connect(this.fxAReturnGain);

    // 2. External FX Loop B: Stereo Plate / Ambient Reverb
    this.fxBSendGain = ctx.createGain();
    this.fxBReturnGain = ctx.createGain();
    this.fxBReverbNode = ctx.createConvolver();
    this.generateSyntheticImpulse(ctx, 1.8, 2.0);
    this.fxBSendGain.connect(this.fxBReverbNode);
    this.fxBReverbNode.connect(this.fxBReturnGain);

    // 3. Master Bus Summation
    this.masterSendGain = ctx.createGain();

    // 4. External Mastering Chain Simulation (Saturation & Analog Limiting)
    const waveshaper = ctx.createWaveShaper();
    waveshaper.curve = this.createMasteringCurve(4096) as Float32Array<ArrayBuffer>;
    waveshaper.oversample = '2x';
    this.masteringProcessorGain = ctx.createGain();
    this.masteringProcessorGain.gain.value = 1.05;

    this.masterSendGain.connect(waveshaper);
    waveshaper.connect(this.masteringProcessorGain);

    // 5. Dedicated Stereo Mastering Return (Capture source)
    this.masteringReturnGain = ctx.createGain();
    this.masteringProcessorGain.connect(this.masteringReturnGain);

    // Mastering Return Analysers
    const splitter = ctx.createChannelSplitter(2);
    this.masteringAnalyserL = ctx.createAnalyser();
    this.masteringAnalyserR = ctx.createAnalyser();
    this.masteringAnalyserL.fftSize = 256;
    this.masteringAnalyserR.fftSize = 256;

    this.masteringReturnGain.connect(splitter);
    splitter.connect(this.masteringAnalyserL, 0);
    splitter.connect(this.masteringAnalyserR, 1);

    // Connect mastering return to monitor speakers
    this.masterOutputGain = ctx.createGain();
    this.masterOutputGain.gain.value = 0.9;
    this.masteringReturnGain.connect(this.masterOutputGain);
    this.masterOutputGain.connect(ctx.destination);

    // Create channel strips for all 5 sources + 2 FX returns
    const stripIds = ['nes_mono', 'sid_core1', 'sid_core2', 'sid_core3', 'sid_core4', 'fx_return_a', 'fx_return_b'];
    const fxA = this.fxASendGain;
    const fxB = this.fxBSendGain;

    stripIds.forEach((id) => {
      const input = ctx.createGain();
      const trim = ctx.createGain();
      const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : (null as unknown as StereoPannerNode);
      const fader = ctx.createGain();
      const sendA = ctx.createGain();
      const sendB = ctx.createGain();

      const anL = ctx.createAnalyser();
      const anR = ctx.createAnalyser();
      anL.fftSize = 256;
      anR.fftSize = 256;

      input.connect(trim);
      if (pan) {
        trim.connect(pan);
        pan.connect(fader);
      } else {
        trim.connect(fader);
      }

      // Sends (Post fader default)
      fader.connect(sendA);
      fader.connect(sendB);
      if (fxA) sendA.connect(fxA);
      if (fxB) sendB.connect(fxB);

      // Direct mix to Master Send
      if (this.masterSendGain) {
        fader.connect(this.masterSendGain);
      }

      // Connect to meters
      const stripSplitter = ctx.createChannelSplitter(2);
      fader.connect(stripSplitter);
      stripSplitter.connect(anL, 0);
      stripSplitter.connect(anR, 1);

      this.stripNodes.set(id, {
        input,
        trim,
        pan,
        fader,
        sendA,
        sendB,
        analyserL: anL,
        analyserR: anR
      });
    });

    // Also connect FX Returns to master send
    if (this.fxAReturnGain) {
      const aStrip = this.stripNodes.get('fx_return_a');
      if (aStrip) this.fxAReturnGain.connect(aStrip.input);
    }
    if (this.fxBReturnGain) {
      const bStrip = this.stripNodes.get('fx_return_b');
      if (bStrip) this.fxBReturnGain.connect(bStrip.input);
    }

    this.startMeterLoop();
  }

  private generateSyntheticImpulse(ctx: AudioContext, durationSec: number, decay: number) {
    if (!this.fxBReverbNode) return;
    const rate = ctx.sampleRate;
    const length = Math.floor(rate * durationSec);
    const impulse = ctx.createBuffer(2, length, rate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);

    for (let i = 0; i < length; i++) {
      const t = i / rate;
      const factor = Math.exp(-t * decay);
      left[i] = (Math.random() * 2 - 1) * factor;
      right[i] = (Math.random() * 2 - 1) * factor;
    }
    this.fxBReverbNode.buffer = impulse;
  }

  private createMasteringCurve(samples: number): Float32Array {
    const curve = new Float32Array(samples);
    const deg = Math.PI / 180;
    const k = 1.2;
    for (let i = 0; i < samples; ++i) {
      const x = (i * 2) / samples - 1;
      curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }

  // Set Mixer Strip Parameters
  public updateMixerStrip(strip: MixerStrip) {
    let nodeKey = strip.id;
    if (strip.sourceType === 'nes_mono') nodeKey = 'nes_mono';
    else if (strip.id.includes('sid1') || strip.id.includes('core1')) nodeKey = 'sid_core1';
    else if (strip.id.includes('sid2') || strip.id.includes('core2')) nodeKey = 'sid_core2';
    else if (strip.id.includes('sid3') || strip.id.includes('core3')) nodeKey = 'sid_core3';
    else if (strip.id.includes('sid4') || strip.id.includes('core4')) nodeKey = 'sid_core4';
    else if (strip.id.includes('fx_a')) nodeKey = 'fx_return_a';
    else if (strip.id.includes('fx_b')) nodeKey = 'fx_return_b';

    const nodes = this.stripNodes.get(nodeKey);
    if (!nodes || !this.ctx) return;

    // Gain Trim
    const trimLinear = Math.pow(10, strip.gainTrimDb / 20);
    nodes.trim.gain.setTargetAtTime(trimLinear, this.ctx.currentTime, 0.02);

    // Pan
    if (nodes.pan) {
      nodes.pan.pan.setTargetAtTime(strip.pan, this.ctx.currentTime, 0.02);
    }

    // Fader & Mute
    let faderLinear = strip.muted ? 0 : Math.pow(10, strip.faderDb / 20);
    if (strip.faderDb <= -60) faderLinear = 0;
    nodes.fader.gain.setTargetAtTime(faderLinear, this.ctx.currentTime, 0.02);

    // Sends
    const sendALinear = strip.sendADb <= -60 ? 0 : Math.pow(10, strip.sendADb / 20);
    const sendBLinear = strip.sendBDb <= -60 ? 0 : Math.pow(10, strip.sendBDb / 20);
    nodes.sendA.gain.setTargetAtTime(sendALinear, this.ctx.currentTime, 0.02);
    nodes.sendB.gain.setTargetAtTime(sendBLinear, this.ctx.currentTime, 0.02);
  }

  // --- Voice Triggering (Hardware Synthesis Simulation) ---
  public triggerNoteOn(voiceId: VoiceId, note: number, velocity: number) {
    const ctx = this.initAudio();
    const freq = midiNoteToFrequency(note);
    const velScale = velocity / 127;
    const key = `${voiceId}_${note}`;

    // Stop existing note if monophonic
    if (voiceId.startsWith('nes.')) {
      this.panicVoice(voiceId);
    }

    let targetStrip = 'nes_mono';
    if (voiceId === 'sid.core1') targetStrip = 'sid_core1';
    else if (voiceId === 'sid.core2') targetStrip = 'sid_core2';
    else if (voiceId === 'sid.core3') targetStrip = 'sid_core3';
    else if (voiceId === 'sid.core4') targetStrip = 'sid_core4';

    const strip = this.stripNodes.get(targetStrip);
    if (!strip) return;

    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.connect(strip.input);

    if (voiceId === 'nes.pulse1' || voiceId === 'nes.pulse2') {
      // NES Pulse with square waveform
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      osc.connect(gainNode);
      osc.start();

      // Quick punchy chiptune attack/decay
      gainNode.gain.setValueAtTime(0, ctx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.22 * velScale, ctx.currentTime + 0.005);
      gainNode.gain.exponentialRampToValueAtTime(0.18 * velScale, ctx.currentTime + 0.05);

      this.activeOscillators.set(key, { osc, gain: gainNode });
    } else if (voiceId === 'nes.triangle') {
      // Stepped quantized triangle approximation
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      osc.connect(gainNode);
      osc.start();

      gainNode.gain.setValueAtTime(0.3 * velScale, ctx.currentTime);
      this.activeOscillators.set(key, { osc, gain: gainNode });
    } else if (voiceId === 'nes.noise') {
      // Metallic/white noise buffer source
      const bufferSize = ctx.sampleRate * 0.5;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }
      const whiteNoise = ctx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;

      const maxFilterFreq = (ctx.sampleRate || 48000) * 0.42;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(Math.min(maxFilterFreq, Math.max(120, freq * 2.5)), ctx.currentTime);
      filter.Q.value = 2.0;

      whiteNoise.connect(filter);
      filter.connect(gainNode);
      whiteNoise.start();

      gainNode.gain.setValueAtTime(0.25 * velScale, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);

      this.activeOscillators.set(key, { osc: whiteNoise, gain: gainNode });
    } else if (voiceId === 'nes.dpcm') {
      // DPCM drum synthesis (Kick, snare, tom or pitched click)
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(140, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(35, ctx.currentTime + 0.12);
      osc.connect(gainNode);
      osc.start();

      gainNode.gain.setValueAtTime(0.4 * velScale, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);

      this.activeOscillators.set(key, { osc, gain: gainNode });
    } else {
      // MIDIbox SID Stereo Core (Sawtooth + Pulse with resonant filter)
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      osc1.type = 'sawtooth';
      osc2.type = 'square';
      osc1.frequency.setValueAtTime(Math.min(8000, Math.max(30, freq)), ctx.currentTime);
      osc2.frequency.setValueAtTime(Math.min(8000, Math.max(30, freq * 1.003)), ctx.currentTime); // Slight detune for analog warmth

      const maxFilterFreq = (ctx.sampleRate || 48000) * 0.42;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(Math.min(maxFilterFreq, Math.max(150, freq * 2.2)), ctx.currentTime);
      filter.Q.value = 3.5; // Resonant SID 6581/8580 peak

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(gainNode);
      osc1.start();
      osc2.start();

      gainNode.gain.setValueAtTime(0.001, ctx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.25 * velScale, ctx.currentTime + 0.015);
      gainNode.gain.exponentialRampToValueAtTime(0.18 * velScale, ctx.currentTime + 0.1);

      this.activeOscillators.set(key, { osc: osc1, gain: gainNode });
    }
  }

  public triggerNoteOff(voiceId: VoiceId, note: number) {
    const key = `${voiceId}_${note}`;
    const active = this.activeOscillators.get(key);
    if (!active || !this.ctx) return;

    active.gain.gain.setValueAtTime(active.gain.gain.value, this.ctx.currentTime);
    active.gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.06);

    setTimeout(() => {
      try {
        if ('stop' in active.osc && typeof (active.osc as OscillatorNode).stop === 'function') {
          (active.osc as OscillatorNode).stop();
        }
      } catch {
        // Safe ignore
      }
      this.activeOscillators.delete(key);
    }, 70);
  }

  public panicVoice(voicePrefix: string) {
    if (!this.ctx) return;
    for (const [k, v] of this.activeOscillators.entries()) {
      if (k.startsWith(voicePrefix)) {
        try {
          if ('stop' in v.osc && typeof (v.osc as OscillatorNode).stop === 'function') {
            (v.osc as OscillatorNode).stop();
          }
        } catch {
          // ignore
        }
        this.activeOscillators.delete(k);
      }
    }
  }

  public panicAll() {
    if (!this.ctx) return;
    for (const [, v] of this.activeOscillators.entries()) {
      try {
        if ('stop' in v.osc && typeof (v.osc as OscillatorNode).stop === 'function') {
          (v.osc as OscillatorNode).stop();
        }
      } catch {
        // ignore
      }
    }
    this.activeOscillators.clear();
  }

  // --- Transport Playback of SMF Song Model ---
  public playSong(song: MidiSongModel, startSec = 0) {
    this.initAudio();
    this.stopPlayback();

    this.songModel = song;
    this.isRunning = true;
    this.isPaused = false;
    this.pauseOffset = startSec;
    this.startTime = this.ctx!.currentTime - startSec;

    // Schedule all MIDI events using precise WebAudio scheduling
    const voiceMap: Record<number, VoiceId> = {
      0: 'nes.pulse1',
      1: 'nes.pulse2',
      2: 'nes.triangle',
      3: 'nes.noise',
      4: 'nes.dpcm',
      5: 'sid.core1',
      6: 'sid.core2',
      7: 'sid.core3',
      8: 'sid.core4'
    };

    song.tracks.forEach((track, trkIdx) => {
      const voiceId = voiceMap[trkIdx] || (trkIdx === 8 ? 'nes.dpcm' : 'nes.pulse1');
      for (const ev of track.events) {
        if (ev.timeSec < startSec) continue;
        const eventAudioTime = this.startTime + ev.timeSec;

        if (ev.type === 'noteOn' && ev.note !== undefined && ev.velocity && ev.velocity > 0) {
          const delayMs = Math.max(0, (eventAudioTime - this.ctx!.currentTime) * 1000);
          setTimeout(() => {
            if (this.isRunning && !this.isPaused) {
              this.triggerNoteOn(voiceId, ev.note!, ev.velocity!);
            }
          }, delayMs);
        } else if (ev.type === 'noteOff' && ev.note !== undefined) {
          const delayMs = Math.max(0, (eventAudioTime - this.ctx!.currentTime) * 1000);
          setTimeout(() => {
            if (this.isRunning && !this.isPaused) {
              this.triggerNoteOff(voiceId, ev.note!);
            }
          }, delayMs);
        }
      }
    });

    this.startProgressLoop();
  }

  public pausePlayback() {
    if (!this.isRunning || this.isPaused || !this.ctx) return;
    this.isPaused = true;
    this.pauseOffset = this.ctx.currentTime - this.startTime;
    this.panicAll();
  }

  public resumePlayback() {
    if (!this.songModel || !this.isPaused) return;
    this.playSong(this.songModel, this.pauseOffset);
  }

  public stopPlayback() {
    this.isRunning = false;
    this.isPaused = false;
    this.pauseOffset = 0;
    this.panicAll();
  }

  // --- Mastering Return Recording Capture ---
  public startRecording() {
    const ctx = this.initAudio();
    if (this.isRecording) return;

    this.isRecording = true;
    this.recordedChunksL = [];
    this.recordedChunksR = [];
    this.recordedSampleCount = 0;

    // Use ScriptProcessor / AudioWorklet for buffer capture
    this.recordingNode = ctx.createScriptProcessor(4096, 2, 2);
    this.recordingNode.onaudioprocess = (e) => {
      if (!this.isRecording) return;
      const left = e.inputBuffer.getChannelData(0);
      const right = e.inputBuffer.getChannelData(1);
      this.recordedChunksL.push(new Float32Array(left));
      this.recordedChunksR.push(new Float32Array(right));
      this.recordedSampleCount += left.length;
    };

    // Connect from dedicated Mastering Return Gain
    if (this.masteringReturnGain) {
      this.masteringReturnGain.connect(this.recordingNode);
      this.recordingNode.connect(ctx.destination);
    }
  }

  public stopRecording(): { left: Float32Array; right: Float32Array; sampleRate: number } {
    this.isRecording = false;
    if (this.recordingNode && this.masteringReturnGain) {
      try {
        this.masteringReturnGain.disconnect(this.recordingNode);
        this.recordingNode.disconnect();
      } catch {
        // ignore
      }
    }

    const totalSamples = this.recordedSampleCount;
    const finalL = new Float32Array(totalSamples);
    const finalR = new Float32Array(totalSamples);
    let offset = 0;

    for (let i = 0; i < this.recordedChunksL.length; i++) {
      finalL.set(this.recordedChunksL[i], offset);
      finalR.set(this.recordedChunksR[i], offset);
      offset += this.recordedChunksL[i].length;
    }

    return {
      left: finalL,
      right: finalR,
      sampleRate: this.ctx ? this.ctx.sampleRate : 48000
    };
  }

  // --- Monitoring & Progress Loops ---
  public setOnPlaybackProgress(cb: (currentSec: number, totalSec: number, currentTick: number) => void) {
    this.onPlaybackProgress = cb;
  }

  public setOnMeterUpdate(cb: (meters: MeterData[]) => void) {
    this.onMeterUpdate = cb;
  }

  private startProgressLoop() {
    const loop = () => {
      if (this.isRunning && !this.isPaused && this.ctx && this.songModel) {
        const curSec = this.ctx.currentTime - this.startTime;
        const totalSec = this.songModel.durationSec;
        const curTick = Math.floor((curSec / (totalSec || 1)) * this.songModel.totalTicks);

        if (this.onPlaybackProgress) {
          this.onPlaybackProgress(Math.max(0, curSec), totalSec, Math.min(this.songModel.totalTicks, curTick));
        }

        if (curSec >= totalSec + 0.5) {
          this.stopPlayback();
          return;
        }
      }
      if (this.isRunning) {
        requestAnimationFrame(loop);
      }
    };
    requestAnimationFrame(loop);
  }

  private startMeterLoop() {
    if (this.timerHandle) return;

    const dataArrayL = new Uint8Array(128);
    const dataArrayR = new Uint8Array(128);

    const checkMeters = () => {
      if (!this.onMeterUpdate) {
        this.timerHandle = window.setTimeout(checkMeters, 50);
        return;
      }

      const results: MeterData[] = [];
      this.stripNodes.forEach((nodes, id) => {
        nodes.analyserL.getByteTimeDomainData(dataArrayL);
        nodes.analyserR.getByteTimeDomainData(dataArrayR);

        let sumL = 0;
        let sumR = 0;
        let peakL = 0;
        let peakR = 0;

        for (let i = 0; i < 128; i++) {
          const sampleL = (dataArrayL[i] - 128) / 128;
          const sampleR = (dataArrayR[i] - 128) / 128;
          sumL += sampleL * sampleL;
          sumR += sampleR * sampleR;
          const absL = Math.abs(sampleL);
          const absR = Math.abs(sampleR);
          if (absL > peakL) peakL = absL;
          if (absR > peakR) peakR = absR;
        }

        const rmsL = Math.sqrt(sumL / 128);
        const rmsR = Math.sqrt(sumR / 128);

        results.push({
          stripId: id,
          peakL: peakL * 1.4,
          peakR: peakR * 1.4,
          rmsL: rmsL * 1.4,
          rmsR: rmsR * 1.4,
          clipL: peakL > 0.96,
          clipR: peakR > 0.96
        });
      });

      // Also measure Mastering Return
      if (this.masteringAnalyserL && this.masteringAnalyserR) {
        this.masteringAnalyserL.getByteTimeDomainData(dataArrayL);
        this.masteringAnalyserR.getByteTimeDomainData(dataArrayR);
        let sumL = 0;
        let sumR = 0;
        let peakL = 0;
        let peakR = 0;
        for (let i = 0; i < 128; i++) {
          const sampleL = (dataArrayL[i] - 128) / 128;
          const sampleR = (dataArrayR[i] - 128) / 128;
          sumL += sampleL * sampleL;
          sumR += sampleR * sampleR;
          const absL = Math.abs(sampleL);
          const absR = Math.abs(sampleR);
          if (absL > peakL) peakL = absL;
          if (absR > peakR) peakR = absR;
        }
        results.push({
          stripId: 'mastering_return',
          peakL: peakL * 1.3,
          peakR: peakR * 1.3,
          rmsL: Math.sqrt(sumL / 128) * 1.3,
          rmsR: Math.sqrt(sumR / 128) * 1.3,
          clipL: peakL > 0.97,
          clipR: peakR > 0.97
        });
      }

      this.onMeterUpdate(results);
      this.timerHandle = window.setTimeout(checkMeters, 50);
    };

    checkMeters();
  }
}

// Global Audio Engine Singleton
export const audioEngine = new StudioAudioEngine();
