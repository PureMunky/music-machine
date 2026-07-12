# music-machine

**Songs as version-controlled code.** A song is a plain-text file you can
diff, review, and merge like any other source — and play back reliably with
nothing but a web browser.

```
title: Twinkle Twinkle Little Star
tempo: 120

track melody: piano
  C4 C4 G4 G4 | A4 A4 G4:h
  F4 F4 E4 E4 | D4 D4 C4:h
```

## Why this exists

Most music formats are a poor fit for version control: MIDI is binary,
MusicXML is verbose XML built for engraving, and DAW project files are opaque.
`music-machine` uses a tiny, human-readable text format designed so that a
one-note change is a one-line diff — and so the same file sounds the same on
every machine, forever.

Two halves:

- **Playback for humans** — a self-contained web player using the Web Audio
  API. No install, no soundfonts, no audio drivers. Open it and press Play.
- **Validation for machines** — a Node script that parses every song with the
  *same* parser the player uses, so a malformed song can't slip into the repo.

## Play a song

Open the player in a browser:

```
player/index.html
```

Pick an example or load a `.song` file, edit the text, and hit **▶ Play**.
Everything runs locally in the page.

> Some browsers restrict audio when a page is opened directly via `file://`.
> If you hear nothing, serve the folder instead:
> `python3 -m http.server` then visit `http://localhost:8000/player/`.

## Validate songs (the "code" side)

```
node tools/validate.js            # check everything in songs/
node tools/validate.js songs/canon.song
npm test                          # validate + run parser unit tests
```

`validate.js` reports parse errors with line numbers and prints a summary
(track count, note count, duration) for each valid song. It's meant to run in
CI or a pre-commit hook.

## Repository layout

```
songs/            the songs themselves (.song text files)
src/song.js       the parser + pitch/duration math — one source of truth,
                  shared by the player and the validator
player/index.html self-contained Web Audio player
tools/validate.js CLI validator (CI-friendly)
tools/test.js     unit tests for the parser core
docs/FORMAT.md    the .song format reference
```

## The format in 30 seconds

- `title:` and `tempo:` headers, then one or more `track NAME: instrument`.
- Notes are `C4`, `F#3`, `Eb5`; octave 4 holds middle C.
- Durations via `:code` — `w h q e s` (default is a quarter note); dot for
  dotted (`q.`); `[C4 E4 G4]` for chords; `R` for a rest.
- `|` is a visual barline (ignored); `//` starts a comment.

Full details in [`docs/FORMAT.md`](docs/FORMAT.md).

## Roadmap ideas

- MIDI / WAV export from the CLI (a second, offline playback path).
- Per-note dynamics (volume) and simple articulation.
- Loops / repeats and named sections to keep long songs DRY.
- A pre-commit hook wired to `validate.js`.

## License

MIT
