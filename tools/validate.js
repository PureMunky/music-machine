#!/usr/bin/env node
/*
 * validate.js — the "code" side of music-machine.
 *
 * Parses one or more .song files with the exact same parser the player uses,
 * and reports any problems. Run it in CI or a pre-commit hook so a malformed
 * song can never land in the repo.
 *
 *   node tools/validate.js songs/*.song
 *   node tools/validate.js            # defaults to every .song under songs/
 */
'use strict';

var fs = require('fs');
var path = require('path');
var MM = require('../src/song.js');

function findSongs(dir) {
  var out = [];
  var entries = fs.readdirSync(dir, { withFileTypes: true });
  for (var i = 0; i < entries.length; i++) {
    var full = path.join(dir, entries[i].name);
    if (entries[i].isDirectory()) out = out.concat(findSongs(full));
    else if (entries[i].name.endsWith('.song')) out.push(full);
  }
  return out;
}

var args = process.argv.slice(2);
var files;
if (args.length) {
  files = args;
} else {
  var songsDir = path.join(__dirname, '..', 'songs');
  files = fs.existsSync(songsDir) ? findSongs(songsDir) : [];
}

if (files.length === 0) {
  console.error('No .song files to validate.');
  process.exit(1);
}

var failures = 0;
for (var f = 0; f < files.length; f++) {
  var file = files[f];
  var text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (e) {
    console.log('✗ ' + file + ' — cannot read: ' + e.message);
    failures++;
    continue;
  }

  var song = MM.parseSong(text);
  var notes = 0;
  var beats = 0;
  for (var t = 0; t < song.tracks.length; t++) {
    var trackBeats = 0;
    for (var e = 0; e < song.tracks[t].events.length; e++) {
      var ev = song.tracks[t].events[e];
      trackBeats += ev.beats;
      if (ev.type !== 'rest') notes++;
    }
    if (trackBeats > beats) beats = trackBeats;
  }

  if (song.errors.length) {
    failures++;
    console.log('✗ ' + file);
    for (var x = 0; x < song.errors.length; x++) console.log('    ' + song.errors[x]);
  } else {
    var secs = (beats * 60) / song.tempo;
    console.log(
      '✓ ' + file + '  "' + song.title + '"  ' +
      song.tracks.length + ' track(s), ' + notes + ' notes, ' +
      song.tempo + ' BPM, ~' + secs.toFixed(1) + 's'
    );
  }
}

console.log('');
console.log(files.length - failures + '/' + files.length + ' song(s) valid.');
process.exit(failures ? 1 : 0);
