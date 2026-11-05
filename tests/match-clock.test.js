'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('game.js', 'utf8');
const loop = source.slice(source.indexOf('let last = performance.now();'), source.lastIndexOf('\n})();'));
const context = {
  performance: {now: () => 0}, window: {}, paused: false,
  state: 'kick', cd: 3, clock: 300, trainingMode: false, ot: false, replayElapsed: 0,
  pollControllers() {}, render() {}, showVictoryScreen() {}, score: [0, 0],
  onlineMode:null,onlineBackgroundFrame:null,onlineFrame(){},sendOnlineSnapshot(){},
  rafRequests:0,
  requestAnimationFrame(callback) { context.frame = callback;context.rafRequests++; },
  simulated:0,
  update(dt) {
    context.simulated+=dt;
    assert(dt <= 1 / 120, 'Physics must retain its bounded fixed step');
    if (context.state === 'kick') {
      context.cd -= dt;
      if (context.cd <= 0) context.state = 'play';
    } else if (context.state === 'play') context.clock -= dt;
    else if(context.state==='replay')context.replayElapsed+=dt;
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
context.paused=false;context.state='replay';context.replayElapsed=0;context.frame(12010);
assert(Math.abs(context.replayElapsed-2)<.0001,'Replay playback must track elapsed time under slow rendering');
console.log('PASS: slow-frame countdown, fixed-step physics, match clock, replay playback and pause');

context.state='play';context.simulated=0;
for(let i=1;i<=5;i++)context.frame(12010+i*200);
assert(context.simulated>.98&&context.simulated<1.01,'Five-FPS rendering must still simulate a full second of car movement');
console.log('PASS: fixed-step movement catches up at five FPS without slow motion');
context.onlineMode={role:'guest'};const before=context.simulated,clockBefore=context.clock;context.frame(20000);
assert.equal(context.simulated,before,'Online guest must not run a second match simulation');
assert.equal(context.clock,clockBefore,'Online guest must use the host clock');
context.onlineMode={role:'host'};const requests=context.rafRequests,simulatedBefore=context.simulated;
context.onlineBackgroundFrame(21000,true);
assert(context.simulated>simulatedBefore,'A background host must continue the shared simulation');
assert.equal(context.rafRequests,requests,'Background ticks must not create extra animation loops');
