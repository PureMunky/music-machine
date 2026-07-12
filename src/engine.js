/*
 * music-machine audio engine
 * --------------------------
 * Turns a parsed song (from src/song.js) into sound via the Web Audio API.
 * Deterministic: the same song + tempo always schedules the same notes.
 *
 * Shared by the local player (player/index.html) and the published GitHub
 * Pages gallery, so playback behaves identically everywhere. Browser-only
 * (needs AudioContext + requestAnimationFrame); attaches to
 * window.MusicMachineEngine.
 */
(function (global) {
  'use strict';

  function AudioEngine() {
    this.ctx = null;
    this._nodes = []; // oscillators/gains currently scheduled
    this._raf = null;
    this._start = 0;
    this._duration = 0;
    this._onProgress = null;
    this._onEnd = null;
  }

  AudioEngine.prototype._ensureCtx = function () {
    if (!this.ctx) {
      var Ctor = global.AudioContext || global.webkitAudioContext;
      this.ctx = new Ctor();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  };

  // Play a parsed song. opts: { onProgress(pct 0..1), onEnd() }.
  // Returns the total duration in seconds.
  AudioEngine.prototype.play = function (song, opts) {
    opts = opts || {};
    this.stop();
    var ctx = this._ensureCtx();

    var beat = 60 / song.tempo; // seconds per beat
    var t0 = ctx.currentTime + 0.08; // small lead-in
    var master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);
    this._nodes.push(master);

    var maxEnd = t0;
    for (var ti = 0; ti < song.tracks.length; ti++) {
      var track = song.tracks[ti];
      var cursor = t0;
      for (var ei = 0; ei < track.events.length; ei++) {
        var ev = track.events[ei];
        var dur = ev.beats * beat;
        if (ev.type !== 'rest') {
          var voices = ev.notes.length || 1;
          for (var ni = 0; ni < ev.notes.length; ni++) {
            this._scheduleNote(track.waveform, ev.notes[ni].freq, cursor, dur, master, voices);
          }
        }
        cursor += dur;
      }
      if (cursor > maxEnd) maxEnd = cursor;
    }

    this._duration = maxEnd - t0;
    this._start = t0;
    this._onProgress = opts.onProgress || null;
    this._onEnd = opts.onEnd || null;
    this._animate();
    return this._duration;
  };

  // One note: oscillator through an ADSR gain envelope.
  AudioEngine.prototype._scheduleNote = function (waveform, freq, start, dur, dest, voices) {
    var ctx = this.ctx;
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = waveform;
    osc.frequency.setValueAtTime(freq, start);

    var peak = 0.28 / Math.sqrt(voices); // keep chords from clipping
    var attack = 0.012;
    var release = Math.min(0.12, dur * 0.5);
    var sustain = peak * 0.75;
    var sustainEnd = Math.max(start + attack, start + dur - release);

    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(peak, start + attack);
    gain.gain.linearRampToValueAtTime(sustain, start + Math.min(dur * 0.5, attack + 0.08));
    gain.gain.setValueAtTime(sustain, sustainEnd);
    gain.gain.linearRampToValueAtTime(0, start + dur);

    osc.connect(gain);
    gain.connect(dest);
    osc.start(start);
    osc.stop(start + dur + 0.02);
    this._nodes.push(osc, gain);
  };

  AudioEngine.prototype._animate = function () {
    var self = this;
    var elapsed = this.ctx.currentTime - this._start;
    var pct = this._duration > 0 ? Math.max(0, Math.min(1, elapsed / this._duration)) : 0;
    if (this._onProgress) this._onProgress(pct);
    if (elapsed >= this._duration) {
      this.stop();
      if (this._onEnd) this._onEnd();
      return;
    }
    this._raf = global.requestAnimationFrame(function () { self._animate(); });
  };

  AudioEngine.prototype.stop = function () {
    if (this._raf) { global.cancelAnimationFrame(this._raf); this._raf = null; }
    for (var i = 0; i < this._nodes.length; i++) {
      try { this._nodes[i].stop && this._nodes[i].stop(); } catch (e) {}
      try { this._nodes[i].disconnect && this._nodes[i].disconnect(); } catch (e) {}
    }
    this._nodes = [];
  };

  var api = { AudioEngine: AudioEngine };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.MusicMachineEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
