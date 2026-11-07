/**
 * Chiptune Hardware Workstation - Main Application Entrypoint
 * Controls MIDInes, 8-chip MIDIbox SID, MOTU/AVB ASIO mixing,
 * external FX loops, mastering return capture, and RPG Maker MV OGG Vorbis export.
 */

import React, { useState, useEffect } from 'react';
import { HeaderTransport } from './components/HeaderTransport.tsx';
import { DashboardView } from './components/DashboardView.tsx';
import { MidiImportView } from './components/MidiImportView.tsx';
import { MidinesEditorView } from './components/MidinesEditorView.tsx';
import { SidEditorView } from './components/SidEditorView.tsx';
import { MixerView } from './components/MixerView.tsx';
import { PatchbayView } from './components/PatchbayView.tsx';
import { MasteringExportView } from './components/MasteringExportView.tsx';
import { AiComposerView } from './components/AiComposerView.tsx';
import { ProtocolDocsView } from './components/ProtocolDocsView.tsx';

import {
  ExportSettings,
  LoopRegion,
  MidiRoute,
  MidiSongModel,
  MidinesState,
  MixerStrip,
  RoutingConfig,
  SidCorePatch,
  SYSTEM_VOICES
} from './types/index.ts';

import { createChiptuneDemoSmf } from './data/demoSongs.ts';
import { DEFAULT_SID_PATCHES } from './data/defaultSidPatches.ts';
import { MidiParser } from './services/midiParser.ts';
import { audioEngine } from './services/audioEngine.ts';
import { createRoutesForSong } from './services/midiRouting.ts';


export default function App() {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [songModel, setSongModel] = useState<MidiSongModel | null>(null);
  const [isSimulatorMode, setIsSimulatorMode] = useState<boolean>(true);

  // Playback & Transport State
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [isRecordingArmed, setIsRecordingArmed] = useState<boolean>(false);
  const [isLooping, setIsLooping] = useState<boolean>(true);
  const [currentTimeSec, setCurrentTimeSec] = useState<number>(0);
  const [totalTimeSec, setTotalTimeSec] = useState<number>(0);
  const [currentTick, setCurrentTick] = useState<number>(0);
  const [statusNotification, setStatusNotification] = useState<string | null>(null);

  // 1. Midi Routes (8 Primary Tracks + 1 DPCM Aux Lane)
  const [routes, setRoutes] = useState<MidiRoute[]>([
    { trackIndex: 1, trackName: 'Track 1 - NES Pulse 1 (Lead Arp)', voiceId: 'nes.pulse1', outputPortId: 'port_a', midiChannel: 1, muted: false, soloed: false },
    { trackIndex: 2, trackName: 'Track 2 - NES Pulse 2 (Counter Melody)', voiceId: 'nes.pulse2', outputPortId: 'port_a', midiChannel: 2, muted: false, soloed: false },
    { trackIndex: 3, trackName: 'Track 3 - NES Triangle (Walking Bass)', voiceId: 'nes.triangle', outputPortId: 'port_a', midiChannel: 3, muted: false, soloed: false },
    { trackIndex: 4, trackName: 'Track 4 - NES Noise (Percussion / Hats)', voiceId: 'nes.noise', outputPortId: 'port_a', midiChannel: 4, muted: false, soloed: false },
    { trackIndex: 5, trackName: 'Track 5 - SID Core 1 (Heavy 6581 Bass)', voiceId: 'sid.core1', outputPortId: 'port_b', midiChannel: 6, muted: false, soloed: false },
    { trackIndex: 6, trackName: 'Track 6 - SID Core 2 (Stereo PWM Arp)', voiceId: 'sid.core2', outputPortId: 'port_b', midiChannel: 7, muted: false, soloed: false },
    { trackIndex: 7, trackName: 'Track 7 - SID Core 3 (Poly Synth Brass)', voiceId: 'sid.core3', outputPortId: 'port_b', midiChannel: 8, muted: false, soloed: false },
    { trackIndex: 8, trackName: 'Track 8 - SID Core 4 (Ambient Noise Pad)', voiceId: 'sid.core4', outputPortId: 'port_b', midiChannel: 9, muted: false, soloed: false },
    { trackIndex: 9, trackName: 'Track 9 - NES DPCM Aux (256 Drum Kit)', voiceId: 'nes.dpcm', outputPortId: 'port_a', midiChannel: 5, muted: false, soloed: false }
  ]);

  // 2. MIDInes State
  const [midinesState, setMidinesState] = useState<MidinesState>({
    pulse1: { duty: 2, volume: 14, decayRate: 0, decayLoop: false, sweepEnabled: false, sweepPeriod: 0, sweepShift: 0, sweepDirection: 'up', finePitch: 64 },
    pulse2: { duty: 1, volume: 12, decayRate: 0, decayLoop: false, sweepEnabled: false, sweepPeriod: 0, sweepShift: 0, sweepDirection: 'up', finePitch: 64 },
    triangle: { volume: 15, linearCounter: 127, finePitch: 64 },
    noise: { volume: 12, mode: 'long', pitchIndex: 8, decayLoop: false },
    dpcm: { activeBank: 1, sampleRate: 15, loop: false, volume: 15 }
  });

  // 3. MIDIbox SID Patches (4 Stereo Cores with Full V2 Engine Models)
  const [sidPatches, setSidPatches] = useState<[SidCorePatch, SidCorePatch, SidCorePatch, SidCorePatch]>(DEFAULT_SID_PATCHES);

  // 4. Physical Routing Configuration
  const [routing, setRouting] = useState<RoutingConfig>({
    nesInput: { kind: 'mono', channelId: 'in_1' },
    sidInputs: [
      { kind: 'stereo', leftId: 'in_2', rightId: 'in_3' },
      { kind: 'stereo', leftId: 'in_4', rightId: 'in_5' },
      { kind: 'stereo', leftId: 'in_6', rightId: 'in_7' },
      { kind: 'stereo', leftId: 'in_8', rightId: 'in_9' }
    ],
    effectA: {
      sendOutput: { leftId: 'out_3', rightId: 'out_4' },
      returnInput: { kind: 'stereo', leftId: 'in_10', rightId: 'in_11' }
    },
    effectB: {
      sendOutput: { leftId: 'out_5', rightId: 'out_6' },
      returnInput: { kind: 'stereo', leftId: 'in_12', rightId: 'in_13' }
    },
    masterSend: { leftId: 'out_1', rightId: 'out_2' },
    masterReturn: { kind: 'stereo', leftId: 'in_14', rightId: 'in_15' }
  });

  // 5. Mixer Strips
  const [mixerStrips, setMixerStrips] = useState<MixerStrip[]>([
    { id: 'nes_mono', title: '1. MIDInes Mono', sourceType: 'nes_mono', gainTrimDb: 0, pan: 0, faderDb: -1.5, muted: false, soloed: false, sendADb: -12, sendAPre: false, sendBDb: -18, sendBPre: false, meterPeakL: 0, meterPeakR: 0, meterRmsL: 0, meterRmsR: 0, clipL: false, clipR: false },
    { id: 'sid_core1', title: '2. SID Core 1 (Pair 1)', sourceType: 'sid_stereo', gainTrimDb: 0, pan: -0.2, faderDb: -2.0, muted: false, soloed: false, sendADb: -15, sendAPre: false, sendBDb: -20, sendBPre: false, meterPeakL: 0, meterPeakR: 0, meterRmsL: 0, meterRmsR: 0, clipL: false, clipR: false },
    { id: 'sid_core2', title: '3. SID Core 2 (Pair 2)', sourceType: 'sid_stereo', gainTrimDb: 0, pan: 0.25, faderDb: -3.0, muted: false, soloed: false, sendADb: -9, sendAPre: false, sendBDb: -14, sendBPre: false, meterPeakL: 0, meterPeakR: 0, meterRmsL: 0, meterRmsR: 0, clipL: false, clipR: false },
    { id: 'sid_core3', title: '4. SID Core 3 (Pair 3)', sourceType: 'sid_stereo', gainTrimDb: 0, pan: -0.4, faderDb: -4.0, muted: false, soloed: false, sendADb: -18, sendAPre: false, sendBDb: -10, sendBPre: false, meterPeakL: 0, meterPeakR: 0, meterRmsL: 0, meterRmsR: 0, clipL: false, clipR: false },
    { id: 'sid_core4', title: '5. SID Core 4 (Pair 4)', sourceType: 'sid_stereo', gainTrimDb: 0, pan: 0.5, faderDb: -5.0, muted: false, soloed: false, sendADb: -6, sendAPre: false, sendBDb: -8, sendBPre: false, meterPeakL: 0, meterPeakR: 0, meterRmsL: 0, meterRmsR: 0, clipL: false, clipR: false },
    { id: 'fx_return_a', title: '6. FX Return A (Tape Delay)', sourceType: 'fx_return', gainTrimDb: 0, pan: 0, faderDb: -4.5, muted: false, soloed: false, sendADb: -60, sendAPre: false, sendBDb: -60, sendBPre: false, meterPeakL: 0, meterPeakR: 0, meterRmsL: 0, meterRmsR: 0, clipL: false, clipR: false },
    { id: 'fx_return_b', title: '7. FX Return B (Plate Reverb)', sourceType: 'fx_return', gainTrimDb: 0, pan: 0, faderDb: -6.0, muted: false, soloed: false, sendADb: -60, sendAPre: false, sendBDb: -60, sendBPre: false, meterPeakL: 0, meterPeakR: 0, meterRmsL: 0, meterRmsR: 0, clipL: false, clipR: false },
    { id: 'master_send', title: '8. Master Bus (Send Out)', sourceType: 'master_send', gainTrimDb: 0, pan: 0, faderDb: 0.0, muted: false, soloed: false, sendADb: -60, sendAPre: false, sendBDb: -60, sendBPre: false, meterPeakL: 0, meterPeakR: 0, meterRmsL: 0, meterRmsR: 0, clipL: false, clipR: false },
    { id: 'mastering_return', title: '9. Mastering Return (Capture)', sourceType: 'mastering_return', gainTrimDb: 0, pan: 0, faderDb: 0.0, muted: false, soloed: false, sendADb: -60, sendAPre: false, sendBDb: -60, sendBPre: false, meterPeakL: 0, meterPeakR: 0, meterRmsL: 0, meterRmsR: 0, clipL: false, clipR: false }
  ]);

  // 6. Loop Region (RPG Maker MV)
  const [loop, setLoop] = useState<LoopRegion>({
    startTick: 0,
    endTick: 7680,
    startSample: 0,
    lengthSamples: 48000 * 8, // 8 seconds default
    startBar: 1,
    startBeat: 1,
    endBar: 5,
    endBeat: 1,
    tailCrossfadeMs: 25
  });

  // 7. Export Settings
  const [exportSettings, setExportSettings] = useState<ExportSettings>({
    format: 'both',
    oggQuality: 6,
    sampleRate: 48000,
    bitDepth: 24,
    fileName: 'chiptune_boss_theme',
    titleTag: 'Chiptune Boss Battle BGM',
    artistTag: 'MIDInes & MIDIbox SID Workstation',
    targetMvProjectFolder: 'my_rpg_project/audio/bgm/',
    applyLoopTags: true
  });

  // 8. Calibration Offsets
  const [calibration, setCalibration] = useState({
    midiOffsetMs: 1.5,
    fxLoopRoundtripMs: 6.8,
    masterRoundtripMs: 4.2
  });

  // Load default demo song on startup
  useEffect(() => {
    loadDemoSong();

    // Wire up live meter updates
    audioEngine.onMeters((levels) => {
      setMixerStrips((prev) =>
        prev.map((strip) => {
          let key = strip.id;
          if (strip.sourceType === 'nes_mono') key = 'nes_mono';
          else if (strip.id.includes('sid1') || strip.id.includes('core1')) key = 'sid_core1';
          else if (strip.id.includes('sid2') || strip.id.includes('core2')) key = 'sid_core2';
          else if (strip.id.includes('sid3') || strip.id.includes('core3')) key = 'sid_core3';
          else if (strip.id.includes('sid4') || strip.id.includes('core4')) key = 'sid_core4';
          else if (strip.id.includes('fx_a')) key = 'fx_return_a';
          else if (strip.id.includes('fx_b')) key = 'fx_return_b';

          const match = levels[key];
          if (match) {
            return {
              ...strip,
              meterPeakL: match.peakL,
              meterPeakR: match.peakR,
              meterRmsL: match.rmsL,
              meterRmsR: match.rmsR,
              clipL: match.peakL >= 1.0,
              clipR: match.peakR >= 1.0
            };
          }
          return strip;
        })
      );
    });
  }, []);

  const loadDemoSong = () => {
    try {
      const demoBytes = createChiptuneDemoSmf();
      const parser = new MidiParser(demoBytes);
      const parsed = parser.parse();
      setSongModel(parsed);
      setTotalTimeSec(parsed.durationSec);
      setRoutes(createRoutesForSong(parsed));
      showNotification('Loaded 8-Track + DPCM Chiptune Demo Arrangement');
    } catch (e) {
      console.error('Failed to load demo song', e);
    }
  };

  const showNotification = (msg: string) => {
    setStatusNotification(msg);
    setTimeout(() => setStatusNotification(null), 3000);
  };

  // Transport Handlers
  const handlePlay = () => {
    if (!songModel) return;
    setIsPlaying(true);
    setIsPaused(false);
    audioEngine.playSong(
      songModel,
      routes,
      isPaused ? currentTimeSec : 0,
      (sec) => {
        setCurrentTimeSec(sec);
        setCurrentTick(Math.floor(sec * (songModel.ppq * 2)));
      },
      () => {
        setIsPlaying(false);
        setIsPaused(false);
      }
    );
  };

  const handlePause = () => {
    setIsPaused(true);
    audioEngine.pausePlayback();
  };

  const handleStop = () => {
    setIsPlaying(false);
    setIsPaused(false);
    setCurrentTimeSec(0);
    setCurrentTick(0);
    audioEngine.stopPlayback();
  };

  const handleRewind = () => {
    setCurrentTimeSec(0);
    setCurrentTick(0);
    if (isPlaying && songModel) {
      audioEngine.playSong(
        songModel,
        routes,
        0,
        (sec) => {
          setCurrentTimeSec(sec);
          setCurrentTick(Math.floor(sec * (songModel.ppq * 2)));
        },
        () => {
          setIsPlaying(false);
          setIsPaused(false);
        }
      );
    }
  };

  const handlePanic = () => {
    audioEngine.panicAll();
    showNotification('PANIC: All notes off & sound reset sent to all channels');
  };

  const handleToggleRecordArm = () => {
    setIsRecordingArmed(!isRecordingArmed);
    showNotification(
      !isRecordingArmed
        ? 'Master Return Armed for 24-bit WAV & RPG Maker MV OGG recording'
        : 'Master Return Disarmed'
    );
  };

  const handleToggleLoop = () => {
    setIsLooping(!isLooping);
    showNotification(isLooping ? 'Seamless loop disabled' : 'Seamless BGM loop enabled');
  };

  const handleSaveProject = () => {
    const session = {
      schemaVersion: 1,
      id: 'chiptune_session_01',
      title: exportSettings.titleTag,
      routes,
      midinesState,
      sidPatches,
      routing,
      mixer: mixerStrips,
      loop,
      exportSettings,
      calibration
    };
    const blob = new Blob([JSON.stringify(session, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${exportSettings.fileName}.chipstudio.json`;
    a.click();
    URL.revokeObjectURL(url);
    showNotification('Project session saved successfully');
  };

  const handleLoadProject = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const loaded = JSON.parse(ev.target?.result as string);
          if (loaded.routes) setRoutes(loaded.routes);
          if (loaded.midinesState) setMidinesState(loaded.midinesState);
          if (loaded.sidPatches) setSidPatches(loaded.sidPatches);
          if (loaded.routing) setRouting(loaded.routing);
          if (loaded.loop) setLoop(loaded.loop);
          if (loaded.exportSettings) setExportSettings(loaded.exportSettings);
          showNotification('Project session loaded successfully');
        } catch (err) {
          alert('Failed to parse project JSON file');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  // Route updates
  const handleUpdateRoute = (trackIndex: number, partial: Partial<MidiRoute>) => {
    setRoutes((prev) =>
      prev.map((r, i) => (i === trackIndex ? { ...r, ...partial } : r))
    );
  };

  // Mixer strip updates
  const handleUpdateMixerStrip = (index: number, partial: Partial<MixerStrip>) => {
    setMixerStrips((prev) => {
      const updated = prev.map((s, i) => (i === index ? { ...s, ...partial } : s));
      audioEngine.updateMixerStrip(updated[index]);
      return updated;
    });
  };

  // SID Patch updates
  const handleUpdateSidPatch = (coreIndex: number, patch: SidCorePatch) => {
    setSidPatches((prev) => {
      const updated = [...prev] as typeof prev;
      updated[coreIndex] = patch;
      return updated;
    });
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-black">
      {/* Top Transport & Studio Rack Header */}
      <HeaderTransport
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        songModel={songModel}
        isPlaying={isPlaying}
        isPaused={isPaused}
        isRecordingArmed={isRecordingArmed}
        isLooping={isLooping}
        currentTimeSec={currentTimeSec}
        totalTimeSec={totalTimeSec}
        currentTick={currentTick}
        isSimulatorMode={isSimulatorMode}
        setIsSimulatorMode={setIsSimulatorMode}
        onPlay={handlePlay}
        onPause={handlePause}
        onStop={handleStop}
        onRewind={handleRewind}
        onToggleRecordArm={handleToggleRecordArm}
        onToggleLoop={handleToggleLoop}
        onPanic={handlePanic}
        onSaveProject={handleSaveProject}
        onLoadProject={handleLoadProject}
      />

      {/* Ephemeral Toast Notification */}
      {statusNotification && (
        <div className="fixed bottom-5 right-5 z-50 px-4 py-2 rounded-lg bg-neutral-900 border border-neutral-700 text-xs font-mono text-emerald-400 shadow-xl flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span>{statusNotification}</span>
        </div>
      )}

      {/* Main View Area */}
      <main className="flex-1 overflow-y-auto">
        {activeTab === 'dashboard' && (
          <DashboardView
            songModel={songModel}
            onLoadDemo={loadDemoSong}
            onNavigateTab={setActiveTab}
            isSimulatorMode={isSimulatorMode}
          />
        )}

        {activeTab === 'midi' && (
          <MidiImportView
            songModel={songModel}
            routes={routes}
            onSongLoaded={(parsed, name) => {
              setSongModel(parsed);
              setTotalTimeSec(parsed.durationSec);
              setRoutes(createRoutesForSong(parsed));
              showNotification(`Imported MIDI: ${name} (${parsed.tracks.length} tracks, format ${parsed.format})`);
            }}
            onUpdateRoute={handleUpdateRoute}
            onLoadDemo={loadDemoSong}
            currentTimeSec={currentTimeSec}
          />
        )}

        {activeTab === 'midines' && (
          <MidinesEditorView
            midinesState={midinesState}
            onUpdateState={(partial) => setMidinesState((prev) => ({ ...prev, ...partial }))}
          />
        )}

        {activeTab === 'sid' && (
          <SidEditorView
            sidPatches={sidPatches}
            onUpdatePatch={handleUpdateSidPatch}
          />
        )}

        {activeTab === 'mixer' && (
          <MixerView
            mixerStrips={mixerStrips}
            onUpdateStrip={handleUpdateMixerStrip}
          />
        )}

        {activeTab === 'patchbay' && (
          <PatchbayView
            routing={routing}
            onUpdateRouting={setRouting}
            calibration={calibration}
            onUpdateCalibration={setCalibration}
          />
        )}

        {activeTab === 'mastering' && (
          <MasteringExportView
            loop={loop}
            onUpdateLoop={setLoop}
            exportSettings={exportSettings}
            onUpdateExportSettings={(partial) =>
              setExportSettings((prev) => ({ ...prev, ...partial }))
            }
            isRecordingArmed={isRecordingArmed}
            onToggleRecordArm={handleToggleRecordArm}
          />
        )}

        {activeTab === 'composer' && (
          <AiComposerView songModel={songModel} />
        )}

        {activeTab === 'protocol' && (
          <ProtocolDocsView />
        )}
      </main>
    </div>
  );
}
