# The `.song` format

A song is a plain-text file. It is designed to read clearly, diff cleanly in
git, and play back **deterministically** — the same file always produces the
same sound.

## Anatomy

```
// comments start with two slashes and run to end of line

title: My Song          // header: the song's name
tempo: 120              // header: beats per minute (a beat = one quarter note)

track melody: piano     // a track: name + instrument
  C4 D4 E4 F4           // events, grouped however you like across lines
  G4 A4:h | B4 C5       // '|' is a visual barline and is ignored

track bass: bass        // a second track plays at the same time
  C2:h  G2:h
```

Everything before the first `track` is header metadata. Everything after a
`track` line, until the next `track`, is that track's musical events.

## Events

An event is one token separated by whitespace.

### Notes

A note is a letter `A`–`G`, an optional accidental, and an octave number:

```
C4      middle C
A4      concert A (440 Hz)
F#3     F sharp, octave 3   (or 'Fs3')
Eb5     E flat, octave 5
```

Octave `4` contains middle C. Higher number = higher pitch.

### Durations

Add `:code` to set how long an event lasts. Without one, it defaults to a
**quarter note**.

| code | length          | beats |
|------|-----------------|-------|
| `w`  | whole note      | 4     |
| `h`  | half note       | 2     |
| `q`  | quarter (default) | 1   |
| `e`  | eighth          | 0.5   |
| `s`  | sixteenth       | 0.25  |
| `t`  | thirty-second   | 0.125 |

Append a dot for dotted (×1.5): `q.` = 1.5 beats. You can also write raw
beats: `C4:1.5`.

```
C4        a quarter-note C4
C4:h      a half-note C4
C4:e      an eighth-note C4
C4:q.     a dotted quarter
```

### Rests

`R` (or `.`) is a rest — silence for its duration.

```
C4 R E4 R          play, rest, play, rest
C4 R:h E4          a half-note of silence
```

### Chords

Wrap notes in `[ ]` to play them together. A duration after the bracket
applies to the whole chord.

```
[C4 E4 G4]         a C-major triad, quarter note
[C4 E4 G4]:w       held for a whole note
```

## Instruments

Each track names an instrument, which selects a waveform:

`sine`, `triangle`, `square`, `sawtooth`

Friendlier aliases: `piano` (triangle), `bass` (sine), `lead` (sawtooth),
`pluck` (square), `organ` (sine).

## Tips for good diffs

- One musical phrase per line keeps changes readable in a pull request.
- Use `|` barlines consistently so lines stay aligned.
- Keep track order stable; reordering tracks makes noisy diffs.

## Timing model

`tempo` is quarter-notes per minute. A beat is one quarter note, so a note's
duration in seconds is `beats × 60 / tempo`. All tracks start together at time
zero and advance independently by summing their event durations. There is no
hidden state — this is what makes playback reproducible.
