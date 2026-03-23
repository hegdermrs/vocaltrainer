'use client';

import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardShortcuts, MidiNumbers, Piano } from 'react-piano';

interface BottomPianoProps {
  noteName?: string;
  targetNoteName?: string;
  playDetectedAudio?: boolean;
}

interface NoteHit {
  midi: number;
  time: number;
}

const TRAIL_MS = 700;
const HOLD_MS = 420;
const MAX_TRAIL = 10;
const MIN_PLAY_INTERVAL_MS = 120;
const NOTE_RELEASE_MS = 260;

export const BottomPiano = memo(function BottomPiano({ noteName, targetNoteName, playDetectedAudio = true }: BottomPianoProps) {
  const [trail, setTrail] = useState<NoteHit[]>([]);
  const [heldNote, setHeldNote] = useState<number | null>(null);
  const [width, setWidth] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const instrumentRef = useRef<any>(null);
  const activeNodeRef = useRef<any>(null);
  const activeMidiRef = useRef<number | null>(null);
  const noteOffTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPlayedRef = useRef<{ midi: number; time: number } | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const resize = () => setWidth(Math.max(320, Math.floor(el.clientWidth)));
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!noteName) return;
    const midi = noteNameToMidi(noteName);
    if (midi === null) return;
    const now = Date.now();
    setTrail((prev) => [{ midi, time: now }, ...prev].slice(0, MAX_TRAIL));
    setHeldNote(midi);
  }, [noteName]);

  useEffect(() => {
    let mounted = true;
    const loadInstrument = async () => {
      try {
        const mod = await import('soundfont-player');
        const Soundfont = mod.default ?? mod;
        if (!audioContextRef.current) {
          audioContextRef.current = new AudioContext();
        }
        const ctx = audioContextRef.current;
        const instrument = await Soundfont.instrument(ctx, 'acoustic_grand_piano', {
          format: 'mp3',
          soundfont: 'MusyngKite',
          nameToUrl: (name: string, soundfont: string, format: string) =>
            `https://d1pzp51pvbm36p.cloudfront.net/${soundfont}/${name}-${format}.js`
        });
        if (mounted) {
          instrumentRef.current = instrument;
        }
      } catch {
        // Ignore loading errors; visualization still works without audio.
      }
    };
    loadInstrument();
    return () => {
      mounted = false;
      if (activeNodeRef.current && typeof activeNodeRef.current.stop === 'function') {
        try {
          activeNodeRef.current.stop();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  useEffect(() => {
    if (!playDetectedAudio) {
      stopActiveNote(activeNodeRef, activeMidiRef);
      return;
    }
    const ctx = audioContextRef.current;
    const instrument = instrumentRef.current;
    if (!ctx || !instrument) return;

    const midi = noteName ? noteNameToMidi(noteName) : null;
    const now = Date.now();
    const last = lastPlayedRef.current;

    if (noteOffTimerRef.current) {
      clearTimeout(noteOffTimerRef.current);
      noteOffTimerRef.current = null;
    }

    if (midi === null) {
      noteOffTimerRef.current = setTimeout(() => {
        stopActiveNote(activeNodeRef, activeMidiRef);
      }, NOTE_RELEASE_MS);
      return;
    }

    const isSameNote = activeMidiRef.current === midi;
    if (isSameNote) {
      return;
    }
    if (last && last.midi === midi && now - last.time < MIN_PLAY_INTERVAL_MS) {
      return;
    }

    void ctx.resume();
    stopActiveNote(activeNodeRef, activeMidiRef);
    try {
      activeNodeRef.current = instrument.play(midi, ctx.currentTime, {
        gain: 0.85
      });
      activeMidiRef.current = midi;
      lastPlayedRef.current = { midi, time: now };
    } catch {
      // ignore playback errors
    }
  }, [noteName, playDetectedAudio]);

  useEffect(() => {
    return () => {
      if (noteOffTimerRef.current) {
        clearTimeout(noteOffTimerRef.current);
      }
      stopActiveNote(activeNodeRef, activeMidiRef);
    };
  }, []);

  useEffect(() => {
    if (heldNote === null) return;
    const id = setTimeout(() => setHeldNote(null), HOLD_MS);
    return () => clearTimeout(id);
  }, [heldNote]);

  useEffect(() => {
    const id = setInterval(() => {
      const cutoff = Date.now() - TRAIL_MS;
      setTrail((prev) => prev.filter((entry) => entry.time >= cutoff));
    }, 90);
    return () => clearInterval(id);
  }, []);

  const first = MidiNumbers.fromNote('c2');
  const last = MidiNumbers.fromNote('c6');

  const keyboardShortcuts = useMemo(
    () =>
      KeyboardShortcuts.create({
        firstNote: first,
        lastNote: last,
        keyboardConfig: KeyboardShortcuts.HOME_ROW
      }),
    [first, last]
  );

  const activeNotes = useMemo(() => {
    const now = Date.now();
    const trailNotes = trail
      .filter((entry) => now - entry.time <= TRAIL_MS)
      .map((entry) => entry.midi);
    const all = heldNote !== null ? [heldNote, ...trailNotes] : trailNotes;
    return Array.from(new Set(all));
  }, [trail, heldNote]);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto max-w-7xl px-3 py-2">
        <div className="mb-1 flex items-center justify-between text-[11px] text-slate-500">
          <span className="flex items-center gap-2">
            <span>Piano</span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-orange-500" />
              You: {noteName ?? '-'}
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-blue-500" />
              Target: {targetNoteName ?? '-'}
            </span>
          </span>
          <span>{playDetectedAudio ? 'Detected audio on' : 'Detected audio muted'}</span>
        </div>
        <div ref={containerRef} className="h-[100px] w-full overflow-hidden rounded border border-slate-200 bg-white">
          {width > 0 && (
            <Piano
              width={width}
              noteRange={{ first, last }}
              playNote={() => {}}
              stopNote={() => {}}
              activeNotes={activeNotes}
              keyboardShortcuts={keyboardShortcuts}
            />
          )}
        </div>
      </div>
    </div>
  );
});

function noteNameToMidi(noteName: string): number | null {
  const match = noteName.match(/^([A-G])([#b]?)(-?\d+)$/);
  if (!match) return null;

  const letter = match[1];
  const accidental = match[2] || '';
  const octave = Number(match[3]);
  const key = `${letter}${accidental}`;

  const map: Record<string, number> = {
    C: 0,
    'C#': 1,
    Db: 1,
    D: 2,
    'D#': 3,
    Eb: 3,
    E: 4,
    F: 5,
    'F#': 6,
    Gb: 6,
    G: 7,
    'G#': 8,
    Ab: 8,
    A: 9,
    'A#': 10,
    Bb: 10,
    B: 11
  };

  const pitchClass = map[key];
  if (pitchClass === undefined) return null;

  return (octave + 1) * 12 + pitchClass;
}

function stopActiveNote(
  activeNodeRef: { current: any },
  activeMidiRef: { current: number | null }
): void {
  if (activeNodeRef.current && typeof activeNodeRef.current.stop === 'function') {
    try {
      activeNodeRef.current.stop();
    } catch {
      // ignore
    }
  }
  activeNodeRef.current = null;
  activeMidiRef.current = null;
}
