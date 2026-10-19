/* The keys the ? panel shows. Press ? (Shift + /) in the game, or tap the round ? button.
   The panel and the freeze live in the shared kit: kit/help.js (Kit.help). */
Kit.help.setup({
  title: TK.TITLE, // the name lives in js/title.js
  cols: ['Teddy', 'Tommy'],
  keys: [
    ['walk', 'W A S D', '↑ ← ↓ →'],
    ['grab · put down · serve', 'F', 'K'],
    ['chop · wash: hold · throw over the river', 'G', 'L'],
    ['swap chefs (1 player)', 'Tab', ''],
    ['call your brother · high five', 'T', ''],
    ['pause · start again · sound', 'P or Esc · R · M', ''],
  ],
  note: '1 player: either set of keys works, and Space grabs too.',
  touch: 'On an iPad, Teddy has the stick and buttons on the left and Tommy on the right. ✋ grabs, 🔪 chops. Tap your brother\'s face to call him.',
});
