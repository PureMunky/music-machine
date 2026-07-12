#!/usr/bin/env node
/*
 * test.js — tiny zero-dependency unit tests for the parser core.
 * Guarantees the pitch math, durations, and grammar stay correct as the
 * format grows.  Run with:  node tools/test.js   (or: npm test)
 */
'use strict';

var MM = require('../src/song.js');

var passed = 0, failed = 0;
function eq(actual, expected, msg) {
  if (actual === expected) { passed++; }
  else { failed++; console.log('  ✗ ' + msg + '  (got ' + actual + ', expected ' + expected + ')'); }
}
function approx(actual, expected, msg) {
  if (Math.abs(actual - expected) < 0.01) { passed++; }
  else { failed++; console.log('  ✗ ' + msg + '  (got ' + actual + ', expected ' + expected + ')'); }
}

// --- pitch ---
eq(MM.noteToMidi('C4'), 60, 'C4 is MIDI 60');
eq(MM.noteToMidi('A4'), 69, 'A4 is MIDI 69');
eq(MM.noteToMidi('C5'), 72, 'C5 is MIDI 72');
eq(MM.noteToMidi('F#3'), 54, 'F#3 is MIDI 54');
eq(MM.noteToMidi('Db4'), 61, 'Db4 is MIDI 61');
eq(MM.noteToMidi('bogus'), null, 'garbage note -> null');
approx(MM.noteToFreq('A4'), 440, 'A4 is 440 Hz');

// --- duration ---
eq(MM.durationToBeats('q'), 1, 'quarter = 1 beat');
eq(MM.durationToBeats('h'), 2, 'half = 2 beats');
eq(MM.durationToBeats('e'), 0.5, 'eighth = 0.5 beat');
eq(MM.durationToBeats('q.'), 1.5, 'dotted quarter = 1.5');
eq(MM.durationToBeats('1.5'), 1.5, 'raw numeric beats');
eq(MM.durationToBeats(null), 1, 'default = quarter');
eq(MM.durationToBeats('zzz'), null, 'bad duration -> null');

// --- parsing ---
var song = MM.parseSong(
  'title: Test\ntempo: 90\ntrack a: sine\n  C4 D4:h [C4 E4 G4]:w R\n'
);
eq(song.errors.length, 0, 'clean song has no errors');
eq(song.title, 'Test', 'title parsed');
eq(song.tempo, 90, 'tempo parsed');
eq(song.tracks.length, 1, 'one track');
eq(song.tracks[0].events.length, 4, 'four events');
eq(song.tracks[0].events[0].type, 'note', 'first event is a note');
eq(song.tracks[0].events[1].beats, 2, 'D4:h is 2 beats');
eq(song.tracks[0].events[2].type, 'chord', 'chord parsed');
eq(song.tracks[0].events[2].notes.length, 3, 'chord has 3 notes');
eq(song.tracks[0].events[3].type, 'rest', 'rest parsed');

// --- error reporting ---
var bad = MM.parseSong('track a: sine\n  C4 Zz9 D4\n');
eq(bad.errors.length >= 1, true, 'bad note reported');

var noTrack = MM.parseSong('title: x\n  C4 D4\n');
eq(noTrack.errors.length >= 1, true, 'notes before a track are an error');

var unknownInst = MM.parseSong('track a: kazoo\n  C4\n');
eq(unknownInst.errors.length >= 1, true, 'unknown instrument reported');

console.log('');
console.log(passed + ' passed, ' + failed + ' failed.');
process.exit(failed ? 1 : 0);
