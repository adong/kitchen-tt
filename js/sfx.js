/* TT Kitchen: the kitchen's own sounds, built on Kit.sound.tone / hiss (no audio files). Exposes TK.sfx. */
(function () {
  'use strict';
  const S = Kit.sound;
  const tone = (o) => S.tone(o), hiss = (o) => S.hiss(o);
  const notes = (fs, o) => fs.forEach((f, i) => tone(Object.assign({}, o, { f, at: (o.at || 0) + i * (o.step || 0.07) })));

  TK.sfx = {
    chop() {
      hiss({ filter: 'bandpass', f: 2400, q: 2, dur: 0.05, vol: 0.18 });
      tone({ f: 180, to: 90, dur: 0.05, vol: 0.12 });
    },
    chopped() { notes([784, 1047], { type: 'triangle', step: 0.06, dur: 0.14, vol: 0.08 }); },
    grab() { tone({ type: 'square', f: 420, to: 620, dur: 0.06, vol: 0.04, lp: 1800 }); },
    place() { tone({ type: 'square', f: 520, to: 340, dur: 0.06, vol: 0.04, lp: 1800 }); },
    plate() {
      tone({ type: 'triangle', f: 1568, dur: 0.12, vol: 0.06 });
      tone({ type: 'triangle', f: 2093, at: 0.03, dur: 0.1, vol: 0.04 });
    },
    no() { tone({ type: 'square', f: 200, to: 150, dur: 0.12, vol: 0.05, lp: 900 }); },
    bin() { hiss({ filter: 'lowpass', f: 900, to: 300, dur: 0.18, vol: 0.12 }); tone({ f: 160, to: 80, dur: 0.12, vol: 0.1 }); },
    // the oven timer: ding!
    done() {
      tone({ type: 'sine', f: 1760, dur: 0.6, vol: 0.09 });
      tone({ type: 'sine', f: 2637, dur: 0.4, vol: 0.03 });
    },
    // oops, crispy: a little downward wobble and a puff, never scary
    crispy() {
      hiss({ filter: 'lowpass', f: 1200, to: 300, dur: 0.6, vol: 0.14, attack: 0.05 });
      tone({ type: 'triangle', f: 520, to: 260, dur: 0.35, vol: 0.08 });
      tone({ type: 'triangle', f: 440, to: 220, at: 0.18, dur: 0.35, vol: 0.07 });
    },
    serve(tip) {
      notes([1047, 1319, 1568, 2093], { type: 'triangle', step: 0.06, dur: 0.2, vol: 0.09 });
      S.coin(tip > 6 ? 6 : 2);
    },
    order() { tone({ type: 'sine', f: 1319, dur: 0.25, vol: 0.06 }); tone({ type: 'sine', f: 1760, at: 0.1, dur: 0.3, vol: 0.05 }); },
    expire() { notes([392, 330, 262], { type: 'triangle', step: 0.12, dur: 0.22, vol: 0.07 }); },
    hurry() { tone({ type: 'square', f: 880, dur: 0.05, vol: 0.03, lp: 2000 }); },
    scrub() { hiss({ filter: 'bandpass', f: 3200, to: 1800, q: 1.5, dur: 0.12, vol: 0.07 }); },
    washed() { notes([1175, 1568], { type: 'sine', step: 0.05, dur: 0.12, vol: 0.06 }); },
    plateback() { tone({ type: 'triangle', f: 660, dur: 0.08, vol: 0.05 }); tone({ type: 'triangle', f: 660, at: 0.09, dur: 0.08, vol: 0.05 }); },
    throw() { S.swipe(); },
    land() { tone({ f: 260, to: 120, dur: 0.08, vol: 0.1 }); },
    catch() { notes([660, 990], { type: 'triangle', step: 0.05, dur: 0.12, vol: 0.08 }); },
    splash() {
      hiss({ filter: 'lowpass', f: 2600, to: 280, dur: 0.5, vol: 0.28 });
      tone({ f: 720, to: 150, dur: 0.3, vol: 0.12 });
    },
    bumpwarn() { tone({ type: 'square', f: 523, dur: 0.12, vol: 0.05, lp: 1500 }); tone({ type: 'square', f: 523, at: 0.2, dur: 0.12, vol: 0.05, lp: 1500 }); },
    bump() { S.bump(); tone({ f: 90, to: 50, dur: 0.25, vol: 0.2 }); },
    swap() { tone({ type: 'triangle', f: 600, to: 900, dur: 0.1, vol: 0.06 }); },
    helper() { S.powerup(); },
    saved() {
      tone({ type: 'triangle', f: 380, to: 1150, dur: 0.35, vol: 0.11 });
      notes([784, 988, 1319], { type: 'triangle', step: 0.07, dur: 0.2, vol: 0.09, at: 0.2 });
    },
    treat() { notes([1319, 1760], { type: 'sine', step: 0.07, dur: 0.15, vol: 0.07 }); },
    highfive() {
      hiss({ f: 2400, q: 1.1, dur: 0.06, vol: 0.4 });
      hiss({ f: 1600, q: 1.1, at: 0.015, dur: 0.09, vol: 0.25 });
      notes([523, 659, 784], { type: 'triangle', step: 0.06, dur: 0.18, vol: 0.08, at: 0.1 });
    },
    timeup() { notes([784, 659, 523, 784], { type: 'square', step: 0.14, dur: 0.18, vol: 0.05, lp: 1800 }); },
    star(i) { notes([784 * Math.pow(1.26, i), 1047 * Math.pow(1.26, i)], { type: 'triangle', step: 0.07, dur: 0.25, vol: 0.1 }); },
    click() { S.click(); },
  };
})();
