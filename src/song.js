/*
 * music-machine core
 * ------------------
 * Parses the plain-text ".song" format into a structured, playable object.
 *
 * This file is environment-agnostic (UMD): it works in the browser (attaches
 * to window.MusicMachine) and in Node (module.exports), so the exact same
 * parser drives both the web player and the command-line validator. One
 * source of truth = playback and validation can never drift apart.
 */
(function (global) {
  'use strict';

  // --- Pitch ---------------------------------------------------------------

  var PITCH_CLASS = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

  // Convert a note name like "C4", "F#3", "Eb5" to a MIDI number.
  // MIDI 60 = middle C (C4). A4 = 69 = 440 Hz.
  function noteToMidi(name) {
    var m = /^([A-Ga-g])([#sb]?)(-?\d+)$/.exec(name);
    if (!m) return null;
    var pc = PITCH_CLASS[m[1].toUpperCase()];
    var accidental = m[2] === 'b' ? -1 : m[2] === '' ? 0 : 1; // # or s = sharp
    var octave = parseInt(m[3], 10);
    return (octave + 1) * 12 + pc + accidental;
  }

  function midiToFreq(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  function noteToFreq(name) {
    var midi = noteToMidi(name);
    return midi == null ? null : midiToFreq(midi);
  }

  // --- Duration ------------------------------------------------------------

  // Letter codes are expressed in beats (a beat = one quarter note).
  var DURATION_CODES = {
    w: 4, // whole
    h: 2, // half
    q: 1, // quarter
    e: 0.5, // eighth
    s: 0.25, // sixteenth
    t: 0.125 // thirty-second
  };

  // "h" -> 2, "q." -> 1.5 (dotted), "1.5" -> 1.5 (raw beats).
  function durationToBeats(code) {
    if (code == null || code === '') return 1; // default: quarter note
    var dotted = false;
    if (code.charAt(code.length - 1) === '.') {
      dotted = true;
      code = code.slice(0, -1);
    }
    var beats;
    if (DURATION_CODES.hasOwnProperty(code)) {
      beats = DURATION_CODES[code];
    } else if (!isNaN(parseFloat(code))) {
      beats = parseFloat(code);
    } else {
      return null; // signal an error to the caller
    }
    return dotted ? beats * 1.5 : beats;
  }

  // --- Instruments ---------------------------------------------------------

  // Friendly names map onto Web Audio oscillator waveforms.
  var INSTRUMENTS = {
    sine: 'sine',
    triangle: 'triangle',
    square: 'square',
    sawtooth: 'sawtooth',
    // aliases with a musical flavour
    piano: 'triangle',
    bass: 'sine',
    lead: 'sawtooth',
    pluck: 'square',
    organ: 'sine'
  };

  function resolveInstrument(name) {
    return INSTRUMENTS[name] || null;
  }

  // --- Parser --------------------------------------------------------------

  // Pull tokens off a line, keeping bracketed chords ("[C4 E4 G4]:h") whole
  // and dropping visual barlines ("|").
  function tokenize(line) {
    var re = /\[[^\]]*\](?::[\w.]+)?|\S+/g;
    var out = [];
    var m;
    while ((m = re.exec(line)) !== null) {
      if (m[0] !== '|') out.push(m[0]);
    }
    return out;
  }

  // Turn one token into an event: { type:'note'|'rest'|'chord', notes:[], beats }
  function parseToken(token, lineNo, errors) {
    // Split off the duration suffix (the last ':' that isn't inside brackets).
    var body = token;
    var durCode = null;
    var colon = token.lastIndexOf(':');
    if (colon !== -1) {
      body = token.slice(0, colon);
      durCode = token.slice(colon + 1);
    }

    var beats = durationToBeats(durCode);
    if (beats === null) {
      errors.push('Line ' + lineNo + ': bad duration "' + durCode + '" in "' + token + '"');
      beats = 1;
    }

    // Rest
    if (body === 'R' || body === 'r' || body === '.') {
      return { type: 'rest', notes: [], beats: beats };
    }

    // Chord: [C4 E4 G4]
    if (body.charAt(0) === '[') {
      var inner = body.replace(/^\[|\]$/g, '').trim();
      var names = inner.length ? inner.split(/\s+/) : [];
      var freqs = [];
      for (var i = 0; i < names.length; i++) {
        var f = noteToFreq(names[i]);
        if (f == null) {
          errors.push('Line ' + lineNo + ': bad note "' + names[i] + '" in chord "' + token + '"');
        } else {
          freqs.push({ name: names[i], freq: f });
        }
      }
      return { type: 'chord', notes: freqs, beats: beats };
    }

    // Single note
    var freq = noteToFreq(body);
    if (freq == null) {
      errors.push('Line ' + lineNo + ': unrecognised token "' + token + '"');
      return { type: 'rest', notes: [], beats: beats };
    }
    return { type: 'note', notes: [{ name: body, freq: freq }], beats: beats };
  }

  // Parse a full .song document into { title, tempo, tracks:[...], errors:[] }.
  function parseSong(text) {
    var song = { title: 'Untitled', tempo: 120, tracks: [], errors: [] };
    var current = null;
    var lines = String(text).split(/\r?\n/);

    for (var n = 0; n < lines.length; n++) {
      var raw = lines[n];
      var lineNo = n + 1;

      // Strip "//" comments and trim.
      var line = raw.replace(/\/\/.*$/, '').trim();
      if (line === '') continue;

      // New track:  "track NAME: instrument"
      var trackMatch = /^track\s+([\w-]+)\s*:\s*(\w+)\s*$/i.exec(line);
      if (trackMatch) {
        var inst = trackMatch[2].toLowerCase();
        if (!resolveInstrument(inst)) {
          song.errors.push('Line ' + lineNo + ': unknown instrument "' + inst + '"');
        }
        current = {
          name: trackMatch[1],
          instrument: inst,
          waveform: resolveInstrument(inst) || 'sine',
          events: []
        };
        song.tracks.push(current);
        continue;
      }

      // Metadata (only meaningful before the first track): "key: value"
      var metaMatch = /^([\w-]+)\s*:\s*(.+)$/.exec(line);
      if (metaMatch && current === null) {
        var key = metaMatch[1].toLowerCase();
        var val = metaMatch[2].trim();
        if (key === 'title') song.title = val;
        else if (key === 'tempo') {
          var bpm = parseFloat(val);
          if (isNaN(bpm) || bpm <= 0) song.errors.push('Line ' + lineNo + ': bad tempo "' + val + '"');
          else song.tempo = bpm;
        } else {
          song.errors.push('Line ' + lineNo + ': unknown header "' + key + '"');
        }
        continue;
      }

      // Otherwise: a line of musical events for the current track.
      if (current === null) {
        song.errors.push('Line ' + lineNo + ': notes before any "track" declaration');
        continue;
      }
      var tokens = tokenize(line);
      for (var t = 0; t < tokens.length; t++) {
        current.events.push(parseToken(tokens[t], lineNo, song.errors));
      }
    }

    if (song.tracks.length === 0) {
      song.errors.push('No tracks found — a song needs at least one "track NAME: instrument".');
    }

    return song;
  }

  var MusicMachine = {
    parseSong: parseSong,
    noteToMidi: noteToMidi,
    noteToFreq: noteToFreq,
    midiToFreq: midiToFreq,
    durationToBeats: durationToBeats,
    resolveInstrument: resolveInstrument,
    INSTRUMENTS: INSTRUMENTS
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = MusicMachine;
  if (typeof window !== 'undefined') window.MusicMachine = MusicMachine;
})(typeof globalThis !== 'undefined' ? globalThis : this);
