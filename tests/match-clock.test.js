'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('game.js', 'utf8');
const loop = source.slice(source.indexOf('let last = performance.now();'), source.lastIndexOf('\n})();'));
const context = {
  performance: {now: () => 0}, window: {}, paused: false,
  state: 'kick', cd: 3, clock: 300, trainingMode: false, ot: false, replayIndex: 0,
  pollControllers() {}, render() {}, showVictoryScreen() {}, score: [0, 0],
  requestAnimationFrame(callback) { context.frame = callback; },
  update(dt) {
    assert(dt <= 1 / 120, 'Physics must retain its bounded fixed step');
    if (context.state === 'kick') {
      context.cd -= dt;
      if (context.cd <= 0) context.state = 'play';
    } else if (context.state === 'play') context.clock -= dt;
  }
};
vm.runInNewContext(loop, context);
context.frame(1500);
assert(Math.abs(context.cd - 1.5) < 0.001, 'Slow frame must not lengthen countdown');
context.frame(3000);
context.frame(3010);
assert.equal(context.state, 'play');
context.clock = 300;
context.frame(5010);
assert(Math.abs(context.clock - 298) < 0.001, 'Match clock must track elapsed time');
context.paused = true;
context.frame(10010);
assert(Math.abs(context.clock - 298) < 0.001, 'Pause must freeze match time');
console.log('PASS: slow-frame countdown, fixed-step physics, match clock and pause');
