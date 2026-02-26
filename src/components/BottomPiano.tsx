'use client';

import { useEffect, useMemo, useState } from 'react';
import { Piano, KeyboardShortcuts, MidiNumbers } from 'react-piano';

interface BottomPianoProps {
  noteName?: string;
}

interface NoteHit {
  midi: number;
  time: number;
}

const TRAIL_MS = 900;
const MAX_TRAIL = 8;

export function BottomPiano({ noteName }: BottomPianoProps) {
  const [trail, setTrail] = useState<NoteHit[]>([]);

  useEffect(() => {
    if (!noteName) return;
    const midi = noteNameToMidi(noteName);
    if (midi === null) return;
    const now = Date.now();
    setTrail((prev) => {
      const next = [{ midi, time: now }, ...prev].slice(0, MAX_TRAIL);
      return next;
    });
  }, [noteName]);

  useEffect(() => {
    const id = setInterval(() => {
      const cutoff = Date.now() - TRAIL_MS;
      setTrail((prev) => prev.filter((t) => t.time >= cutoff));
    }, 100);
    return () => clearInterval(id);
  }, []);

  const firstNote = MidiNumbers.fromNote('c2');
  const lastNote = MidiNumbers.fromNote('c6');
  const keyboardShortcuts = useMemo(
    () =>
      KeyboardShortcuts.create({
        firstNote,
        lastNote,
        keyboardConfig: KeyboardShortcuts.HOME_ROW
      }),
    [firstNote, lastNote]
  );

  const activeNotes = useMemo(() => {
    const now = Date.now();
    return trail
      .filter((t) => now - t.time <= TRAIL_MS)
      .map((t) => t.midi);
  }, [trail]);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white/95 shadow-lg backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 py-3">
        <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
          <span>Piano visualizer</span>
          <span>{noteName ?? '—'}</span>
        </div>
        <div className="h-32 w-full">
          <Piano
            noteRange={{ first: firstNote, last: lastNote }}
            playNote={() => {}}
            stopNote={() => {}}
            disabled
            activeNotes={activeNotes}
            keyboardShortcuts={keyboardShortcuts}
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
          <span>Detected note: {noteName ?? '—'}</span>
          <span>C2–C6</span>
        </div>
      </div>
    </div>
  );
}

function noteNameToMidi(noteName: string): number | null {
  const match = noteName.match(/^([A-G])([#b]?)(-?\\d+)$/);
  if (!match) return null;
  const letter = match[1];
  const accidental = match[2] || '';
  const octave = Number(match[3]);
  const name = `${letter}${accidental}`;
  const pcMap: Record<string, number> = {
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
  const pc = pcMap[name];
  if (pc === undefined) return null;
  return (octave + 1) * 12 + pc;
}
