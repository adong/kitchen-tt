/* TT Kitchen: the recipes, the ingredients and the ten kitchens. Plain data, no Three.js, so the rules (sim.js)
   and the headless soak (tools/soak.js) can use it in node too. */
(function (root) {
  'use strict';
  const TK = root.TK = root.TK || {};

  // Each ingredient starts 'raw'. steps[state] = [station, new state]. A station is 'chop' (the board), 'pan',
  // 'pot', 'oven' or 'blend'. Anything a recipe lists as 'ing:state' is ready to go on a plate.
  TK.ING = {
    bun: { name: 'bun', emoji: '🍞', steps: {} },
    patty: { name: 'patty', emoji: '🥩', steps: { raw: ['pan', 'cooked'] } },
    lettuce: { name: 'lettuce', emoji: '🥬', steps: { raw: ['chop', 'chopped'] } },
    tomato: { name: 'tomato', emoji: '🍅', steps: { raw: ['chop', 'chopped'] } },
    cheese: { name: 'cheese', emoji: '🧀', steps: { raw: ['chop', 'chopped'] } },
    dumpling: { name: 'dumpling', emoji: '🥟', steps: { raw: ['chop', 'folded'], folded: ['pot', 'cooked'] } },
    pizza: { name: 'pizza base', emoji: '🍕', steps: { raw: ['oven', 'cooked'] } },
    noodles: { name: 'noodles', emoji: '🍜', steps: { raw: ['pot', 'cooked'] } },
    egg: { name: 'egg', emoji: '🥚', steps: { raw: ['pan', 'cooked'] } },
    icecream: { name: 'ice cream', emoji: '🍦', steps: {} },
    strawberry: { name: 'strawberry', emoji: '🍓', steps: { raw: ['chop', 'chopped'], chopped: ['blend', 'blended'] } },
    banana: { name: 'banana', emoji: '🍌', steps: { raw: ['chop', 'chopped'], chopped: ['blend', 'blended'] } },
  };

  // the crate letters in the maps
  TK.CRATES = { u: 'bun', m: 'patty', l: 'lettuce', t: 'tomato', c: 'cheese', d: 'dumpling', z: 'pizza', n: 'noodles', e: 'egg', i: 'icecream', s: 'strawberry', a: 'banana' };

  // value = coins for serving it; the tip on top is up to half that again, for being quick
  TK.RECIPES = {
    burger: { name: 'Burger', icon: 'dish:burger', parts: ['bun:raw', 'patty:cooked'], value: 20 },
    burgerL: { name: 'Lettuce Burger', icon: 'dish:burger', parts: ['bun:raw', 'patty:cooked', 'lettuce:chopped'], value: 30 },
    sundae: { name: 'Sundae', icon: 'dish:sundae', parts: ['icecream:raw', 'strawberry:chopped'], value: 20 },
    sundaeB: { name: 'Banana Sundae', icon: 'dish:sundae', parts: ['icecream:raw', 'strawberry:chopped', 'banana:chopped'], value: 30 },
    dumplings: { name: 'Dumplings', icon: 'dish:dumplings', parts: ['dumpling:cooked'], value: 25 },
    pizza: { name: 'Pizza', icon: 'dish:pizza', parts: ['pizza:cooked', 'tomato:chopped'], value: 30 },
    pizzaC: { name: 'Cheese Pizza', icon: 'dish:pizza', parts: ['pizza:cooked', 'tomato:chopped', 'cheese:chopped'], value: 40 },
    noodles: { name: 'Noodles', icon: 'dish:noodles', parts: ['noodles:cooked', 'egg:cooked'], value: 30 },
    smoothieS: { name: 'Strawberry Smoothie', icon: 'dish:smoothieS', parts: ['strawberry:blended'], value: 20 },
    smoothieB: { name: 'Banana Smoothie', icon: 'dish:smoothieB', parts: ['banana:blended'], value: 20 },
  };

  // seconds; 'over' is how long a cooked thing can wait on the heat before it goes "oops, crispy" (NORMAL only)
  TK.TIMES = {
    chop: 2.0, wash: 1.5, pan: 6, pot: 8, oven: 8, blend: 4, over: 11, warn: 5,
    plateBack: 6, levelTime: 150,
  };

  // EASY (Tommy, 5) and NORMAL (Teddy, 8)
  TK.DIFF = {
    easy: { orderTime: 1.8, maxOrders: 2, every: 24, keep: 1, chop: 0.8, burn: false, starScale: 0.6 },
    normal: { orderTime: 1, maxOrders: 3, every: 14, keep: 2, chop: 1, burn: true, starScale: 1 },
  };

  // How long an order waits, before the difficulty stretches it: more parts and more steps, more time.
  TK.orderTime = (id) => {
    const r = TK.RECIPES[id];
    let steps = 0;
    for (const p of r.parts) {
      const [ing, st] = p.split(':');
      let s = 'raw';
      while (s !== st && TK.ING[ing].steps[s]) { steps++; s = TK.ING[ing].steps[s][1]; }
    }
    return 40 + 12 * r.parts.length + 10 * steps;
  };

  /* The maps, one string per row, seen from above with the serving side wherever the W is.
       .  floor          1 2  where Teddy and Tommy start      #  wall      ~  water (the river)
       C  counter        B  chopping board     P  pan    O  pot    V  oven    X  blender
       S  sink           L  clean plates       R  dirty plates come back here      W  serving window    T  bin
       > < ^ v  conveyor belt, moving that way
       lower-case letters: ingredient crates (see TK.CRATES)
     Flags: split (two halves, pass food over the counters), belt, truck (the kitchen is on a moving truck and
     lurches), ice (slippery floor), river (throw ingredients across). stars: coins for ⭐ ⭐⭐ ⭐⭐⭐ on NORMAL. */
  TK.LEVELS = [
    {
      name: 'Burger Bistro', theme: 'bistro',
      tip: 'Cook a patty in the pan, then put it on a plate with a bun. Serve it at the window!',
      menu: ['burger'], plates: 4, stars: [50, 120, 200],
      map: [
        '#CCuCmCCPCPC#',
        'C...........W',
        'C...........W',
        'L....CCC....C',
        'S...........C',
        'R..1.....2..T',
        '#CCCCCCCCCCC#',
      ],
    },
    {
      name: 'Chop Chop', theme: 'diner',
      tip: 'Hold the chop button at a board to chop. Sundaes need a chopped strawberry!',
      menu: ['sundae', 'burgerL'], plates: 4, stars: [50, 120, 200],
      map: [
        '#CuCmClCiCsC#',
        'C...........C',
        'B...........W',
        'B....CCC....W',
        'C...........P',
        'L..1.....2..P',
        '#SRCCCCCCCTC#',
      ],
    },
    {
      name: 'Dumpling House', theme: 'teahouse',
      tip: 'Fold the dumplings on the board, then boil them in a pot. Noodles need an egg from the pan.',
      menu: ['dumplings', 'noodles'], plates: 4, stars: [70, 170, 270],
      map: [
        '#CdCnCeCOCOC#',
        'C...........C',
        'B....CCC....W',
        'B....CPC....W',
        'C...........C',
        'L..1.....2..T',
        '#SRCCCPCCCCC#',
      ],
    },
    {
      name: 'Pass the Pizza', theme: 'pizzeria', split: true,
      tip: 'The counter splits the kitchen! Chop and pass the food over to your brother.',
      menu: ['pizza', 'burger'], plates: 4, stars: [70, 160, 250],
      map: [
        '#CzCtCm#CPCVCV#',
        'B......C......W',
        'B......C......W',
        'u......C......C',
        'C......C......L',
        'T..1...C...2..S',
        '#CCCCCC#TCCCCR#',
      ],
    },
    {
      name: 'Conveyor Café', theme: 'cafe', belt: true,
      tip: 'Put food on the conveyor belt and it rides over to the other side!',
      menu: ['smoothieS', 'smoothieB', 'sundae'], plates: 4, stars: [60, 130, 210],
      map: [
        '#CsCaCi#CXCXCC#',
        'B......#......W',
        'B......#......W',
        'C....>>>>>....C',
        'C......#......L',
        'T..1...#...2..S',
        '#CCCCCC#CCCTCR#',
      ],
    },
    {
      name: 'Food Truck', theme: 'truck', truck: true,
      tip: 'Our kitchen is on a truck! Hold on when it goes over a bump.',
      menu: ['burgerL', 'noodles'], plates: 4, stars: [60, 150, 240],
      map: [
        '#CuCmClCnCeCCC#',
        'B.............W',
        'B....CPCOC....W',
        'C....CPCOC....C',
        'L..1.......2..T',
        '#SRCCCCCCCCCCC#',
      ],
    },
    {
      name: 'Ice Rink', theme: 'ice', ice: true,
      tip: 'The floor is ice! Slide, wiggle and stop before the counter.',
      menu: ['pizzaC', 'dumplings', 'sundae'], plates: 4, stars: [40, 90, 150],
      map: [
        '#CzCtCcCdCiCsC#',
        'B.............W',
        'B....CVCOC....W',
        'C....CVCOC....C',
        'L..1.......2..T',
        '#SRCCBCCCCCCCC#',
      ],
    },
    {
      name: 'River Kitchen', theme: 'river', river: true,
      tip: 'A river runs through the kitchen! Throw food over it with the chop button.',
      menu: ['burger', 'dumplings', 'smoothieS'], plates: 4, stars: [60, 140, 230],
      map: [
        '#udms~~#PCOCXC#',
        'B....~~C......W',
        'B....~~C......W',
        'C....~~C......C',
        'C....~~C......L',
        'T.1..~~C...2..S',
        '#CCCC~~#CCCTCR#',
      ],
    },
    {
      name: 'Slippery Split', theme: 'ice', ice: true, split: true,
      tip: 'Ice AND a counter in the middle. Slide the food over to your brother!',
      menu: ['noodles', 'pizza'], plates: 4, stars: [40, 80, 140],
      map: [
        '#CnCeCt#CPCOCV#',
        'B......C......W',
        'B......C......W',
        'z......C......C',
        'C......C......L',
        'T..1...C...2..S',
        '#CCCCCC#TCCCCR#',
      ],
    },
    {
      name: 'Party Truck', theme: 'party', truck: true, ice: true,
      tip: 'The party truck! Bumps, ice and every dish on the menu. You can do it!',
      menu: ['burger', 'pizza', 'sundae', 'smoothieB', 'dumplings', 'noodles'], plates: 5, stars: [40, 90, 150],
      map: [
        '#CuCmCzCtCiCsCaC#',
        'B...............W',
        'B.....CPCVCX....W',
        'd.....CPCOCO....C',
        'n...............L',
        'e..1........2...S',
        '#CCCBCCCCCCCCTCR#',
      ],
    },
  ];
})(typeof window !== 'undefined' ? window : globalThis);
