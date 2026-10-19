# TT Kitchen

[![TT Kitchen title screen](docs/screenshot.jpg)](https://adong.github.io/kitchen-tt/)

Press **?** any time (or tap the round **?** button on the left edge) to see the keys. The game waits while you look.
Tap the language button under it (the A文 icon) to switch between English and 中文; the dashboard and every game remember the choice.

**中文：** Teddy 和 Tommy 一起当大厨：切菜、煮饭、装盘、上菜、洗盘子，10 个越来越搞笑的厨房，两个人一起玩最好玩。

A co-op cooking game starring Teddy and Tommy in chef hats, built with Claude Code from plain JavaScript and
Three.js. Orders pop up along the top: grab the food from the crates, chop it, cook it, put it on a plate and serve
it at the window before the order runs out. Dirty plates come back to be washed. The kitchens get sillier as you go:
a counter down the middle, a conveyor belt, a food truck that goes over bumps, an ice rink and a river you throw the
food across. Nothing is scary: food left on the heat just goes "oops, crispy" and smokes.
There are no image, model or audio files: the food pictures are emoji and canvas drawings, the people are built from
boxes by the shared kit, and every sound is synthesised.

## Play

- **Double-click `index.html`.** It works offline because Three.js and the kit are copied into `kit/`.
- **Send one file:** `dist/kitchen-tt.html` is the whole game in one page (about 830 KB). AirDrop or email it, then open it in a browser.
- Rebuild that file after any edit: `python3 kit/tools/bundle.py . --name kitchen-tt`
- The two fonts load from Google Fonts when online. Offline, the game falls back to Arial Black and the system font.
- The name lives in one constant, `TK.TITLE` in `js/title.js`.
- The tab and home-screen icon is 🍳 on a tomato-red tile (`#ff5a3c`).

On the title, pick **1 PLAYER** or **2 PLAYERS** and **🐣 EASY** or **🔥 NORMAL**, then a kitchen. Kitchens 1 and 2
are open; each kitchen you finish with at least one star opens the next ("open every kitchen" unlocks them all).
Behind the title, two bot chefs cook by themselves.

## Controls

| | Teddy | Tommy | Touch (iPad) |
|---|---|---|---|
| walk | W A S D | arrows | the stick |
| grab · put down · serve | F | K | ✋ |
| chop · wash (hold) · throw (river kitchens) | G | L | 🔪 |
| swap chefs (1 player) | Tab | | ⇄ SWAP (bottom middle) |
| call your brother · high five | T | | the button with the faces (bottom middle) |
| pause / start again / sound | P or Esc / R / M | | ❚❚ / ↻ / 🔊 at the top right |

- **2 players** share one keyboard (Teddy on the left, Tommy on the right) or one iPad: Teddy's blue stick and
  buttons are on the left, Tommy's orange ones on the right.
- **1 player:** either set of keys moves the chef you're steering, and Space grabs too. A ▼ shows who you are.
- **What you're facing** gets a coloured square (blue for Teddy, orange for Tommy): that's the counter F / K uses.
- Grab with a plate in your hands and it scoops up what's on the counter or in the pan. Grab at the bin to empty a
  plate. With nothing in front of you, grab drops what you hold on the floor.

## Recipes

Each order card shows the dish, what goes in it, and little badges for the jobs: 🔪 board, pan, pot, oven, blender.

| Dish | What goes on the plate |
|---|---|
| 🍔 Burger | bun + patty (pan) |
| 🍔 Lettuce Burger | bun + patty (pan) + lettuce (chop) |
| 🍨 Sundae | ice cream + strawberry (chop) |
| 🍨 Banana Sundae | ice cream + strawberry (chop) + banana (chop) |
| 🥟 Dumplings 饺子 | dumpling dough (fold on the board, then boil in the pot) |
| 🍕 Pizza | pizza base (oven) + tomato (chop) |
| 🍕 Cheese Pizza | pizza base (oven) + tomato (chop) + cheese (chop) |
| 🍜 Noodles | noodles (pot) + egg (pan) |
| 🥤 Strawberry Smoothie | strawberry (chop, then blender) |
| 🥤 Banana Smoothie | banana (chop, then blender) |

- **Cooking:** put it in, a yellow timer bar fills, then *ding*. Chopping and washing are **hold** the button.
- **Oops, crispy** (🔥 NORMAL only): food left on the heat after it's done gets a red flashing bar, then goes dark
  and smokes ("OOPS, CRISPY!"). Throw it in the green bin. No fire, ever. The blender never overdoes it.
- **Coins and tips:** every dish earns coins, plus a tip of up to half again for serving it quickly. ⭐ ⭐⭐ ⭐⭐⭐
  come from the total (the lines are on the results card). A missed order just goes away: no coins are taken.
- **Plates:** there are 4 (5 in the Party Truck), and one more on Easy. A dirty one comes back to the 🍽️ hatch 6 s after
  serving: carry the stack to the sink and hold chop to wash, and clean plates go back on the rack.

## Levels

| # | Kitchen | Menu | The silly bit |
|---|---|---|---|
| 1 | Burger Bistro | burgers | none: learn to cook, plate and serve |
| 2 | Chop Chop | sundaes, lettuce burgers | chopping |
| 3 | Dumpling House | dumplings, noodles | pots, and two jobs for one dumpling |
| 4 | Pass the Pizza | pizza, burgers | a counter splits the kitchen: pass the food over |
| 5 | Conveyor Café | strawberry and banana smoothies, sundaes | a conveyor belt carries food to the other side |
| 6 | Food Truck | lettuce burgers, noodles | the kitchen is on a truck: "BUMP AHEAD!", then everyone slides |
| 7 | Ice Rink | cheese pizza, dumplings, sundaes | slippery ice floor |
| 8 | River Kitchen | burgers, dumplings, strawberry smoothies | a river down the middle: throw food across (chop button) |
| 9 | Slippery Split | noodles, pizza | ice and a split kitchen |
| 10 | Party Truck | all six dishes | a party truck on ice, with bumps and balloons |

- **🐣 EASY** (the default, for Tommy, 5): nothing gets crispy, orders wait 1.8 times longer, at most 2 orders at
  once and fewer of them, chopping is quicker, and the star lines are lower.
- **🔥 NORMAL** (for Teddy, 8): up to 3 orders, a new one about every 14 s, and food can go crispy.
- Each kitchen lasts 2½ minutes. The clock waits while the kitchen's name and tip are showing.
- On the river, a thrown ingredient lands on the first counter it reaches on the other bank (or on a plate there
  that wants it). A brother with empty hands catches it. One that falls short in the water goes "SPLOSH!".

## Companion

Alan's rule for every game: call the other brother any time, as often as you like.

- **1 player:** press **T** or tap your brother's face (`Kit.roster.buddyFor`: Tommy for Teddy, Teddy for Tommy).
  He runs in at his small `buddyScale` size with his name tag, hopping over the counters, and:
  - **saves the order that's about to run out:** its timer fills right back up ("TOMMY SAVED THE ORDER!");
  - **finishes one job:** carries a finished plate to the window, or chops what's waiting on a board, or washes
    all the dirty plates;
  - **does his signature move:** Tommy's Y with peace fingers ✌️, or Teddy's jab and straight and then his jump shot;
  - **tosses you a treat:** 🍦 💧 🧃 🍪 🍉 or 🍌 arcs over ("🧃 JUICE BOX FROM TOMMY!") and gives you a little
    speed boost.
  - Call again while he's there and he stays for another job. Every call can save another order.
- **2 players:** T (or the button) is a **high five**: ✋, both brothers do their signature moves, and both get a
  5-second speed boost ("HIGH FIVE! SPEED BOOST!").

## Modes

- **2 PLAYERS** (the heart of it): Teddy and Tommy each run a chef on one keyboard or one iPad. Split kitchens
  and the river need real teamwork: one brother can't reach everything.
- **1 PLAYER:** you run both chefs and swap with **Tab** or ⇄ SWAP. If you swap while chopping or washing, that
  chef keeps going by himself until the job is done.
- **🤖 AUTOPILOT** (for tests and the title screen): two bot chefs play. Any key or tap takes over.

## How it's tested

All the rules are in `js/sim.js` with no Three.js, so two bot chefs (`js/bot.js`) can play every kitchen headlessly.
The bots read the orders, fetch, chop, cook, plate, serve and wash, pass food over split counters, use the belt and
throw across the river.

```bash
node tools/soak.js
```

It plays all 10 kitchens on EASY and NORMAL (3 seeds each by default) and passes only if every run earns at least one
star. Last run with `--seeds 20`: 400 runs in 17 s, every one at least ⭐⭐ (all but a few ⭐⭐⭐). The check can fail:
`node tools/soak.js --sabotage noserve` (the bots never use the window) fails all 60 runs, and `--sabotage lazy`
(Tommy stands still) fails kitchens 4, 5, 8 and 9 (split, belt and river), which can't be done alone. In the browser console,
`game.soak()` runs the same soak.

Other test hooks (the Browser pane throttles animation when hidden, so tests drive the game themselves):
`game.start(3, { mode: '2p', diff: 'normal', auto: true })`, `game.step(seconds)`, `game.state()`, `game.call()`,
`game.swap()`, `game.press('KeyF')`, `game.finish()`, `game.hold(true)`, `game.keepAwake()`.
`index.html?level=8&mode=1p&diff=normal&touch=1` starts a kitchen straight away (touch=1 shows the touch controls).

Checked in the Browser pane: no console errors; every screen in 中文 with `Kit.lang.untranslated()` returning `[]`
(title, kitchen picker, banners, play in 1P and 2P, the companion, high five, bump, crispy, results, pause, the ?
panel), and a planted English string is caught; in English no Chinese anywhere except the kit's 中文 button tooltip;
phone landscape (740×360) and iPad (1024×768) with the touch controls. `index.html` and `dist/kitchen-tt.html`
both boot from `file://` in headless Chrome.

## Files

- `js/title.js` the name · `js/data.js` ingredients, recipes, timings, the ten kitchens (ASCII maps)
- `js/sim.js` the rules · `js/bot.js` the bot chefs · `js/soak.js` the soak · `tools/soak.js` the node runner
- `js/icons.js` the food pictures · `js/view.js` the 3D kitchen · `js/sfx.js` sounds · `js/game.js` screens, input, HUD
- `js/keys.js` the ? panel · `js/zh.js` 中文
- `kit/` the shared kit, synced with `python3 ../kit/tools/sync.py .` (never edit it here)

## Not verified

- Sound: synthesised through `Kit.sound`, but nobody has listened to it yet.
- Real touch devices: the iPad and phone layouts were checked by screenshot with emulated sizes, not on a device.
- Real kids: the star lines and order timers are set from the bots' scores (a bot pair earns ⭐⭐⭐ almost every
  time; the lines are about 20 / 40 / 70 % of a bot's coins). Teddy and Tommy may find Easy or Normal too hard or
  too easy.
- Double-click from Finder: `file://` was only tried in headless Chrome.
- Adding it to an iPad home screen (the apple-touch-icon is drawn by script, like the other games).
