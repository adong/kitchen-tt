/* 中文 for TT Kitchen: the words on the page, the toasts, the kitchens and tips, the recipe names on the order cards,
   the words drawn in the 3D kitchen (Kit.lang.t in view.js) and the ? panel. The kids' names (TEDDY, TOMMY) and
   the game's name stay in English on purpose, and so do key labels. */
(function () {
  const L = Kit.lang;
  L.keep(['TEDDY', 'TOMMY', 'Teddy', 'Tommy', TK.TITLE, 'TAB', 'Tab', 'T', 'Esc', 'W A S D', '↑ ← ↓ →']);

  // the kitchens: names on the cards and the banner, and each one's tip
  L.add({
    'Burger Bistro': '汉堡小馆', 'Chop Chop': '切切切', 'Dumpling House': '饺子馆', 'Pass the Pizza': '传传披萨',
    'Conveyor Café': '传送带咖啡馆', 'Food Truck': '美食车', 'Ice Rink': '溜冰场厨房', 'River Kitchen': '小河厨房',
    'Slippery Split': '滑溜溜的两半厨房', 'Party Truck': '派对卡车',
    'Cook a patty in the pan, then put it on a plate with a bun. Serve it at the window!': '把肉饼放进平底锅煎熟，再和面包一起放到盘子上。端到窗口上菜！',
    'Hold the chop button at a board to chop. Sundaes need a chopped strawberry!': '在砧板前按住切菜键就能切。圣代要切好的草莓！',
    'Fold the dumplings on the board, then boil them in a pot. Noodles need an egg from the pan.': '先在砧板上包饺子，再放进锅里煮。面条要配一个煎蛋。',
    'The counter splits the kitchen! Chop and pass the food over to your brother.': '柜台把厨房分成了两半！切好菜，递给你的兄弟。',
    'Put food on the conveyor belt and it rides over to the other side!': '把食物放上传送带，它会自己跑到另一边！',
    'Our kitchen is on a truck! Hold on when it goes over a bump.': '厨房在卡车上！遇到颠簸要站稳哦。',
    'The floor is ice! Slide, wiggle and stop before the counter.': '地板是冰！滑呀滑，在柜台前停下来。',
    'A river runs through the kitchen! Throw food over it with the chop button.': '厨房中间有条小河！拿着食物按切菜键，就能扔到对岸。',
    'Ice AND a counter in the middle. Slide the food over to your brother!': '又是冰，中间还有柜台。把食物递给你的兄弟！',
    'The party truck! Bumps, ice and every dish on the menu. You can do it!': '派对卡车！又颠又滑，所有菜都要做。你们一定行！',
    // the banner's how-to line
    'Teddy: the stick and buttons on the left · Tommy: on the right': 'Teddy：左边的摇杆和按钮 · Tommy：右边的',
    'The stick walks · ✋ grabs and puts down · 🔪 chops (hold it)': '摇杆走路 · ✋ 拿起和放下 · 🔪 切菜（按住）',
    'Teddy: W A S D, F grab, G chop  ·  Tommy: arrows, K grab, L chop': 'Teddy：W A S D，F 拿，G 切  ·  Tommy：方向键，K 拿，L 切',
    'Walk: W A S D or arrows · F grab · G chop · Tab swaps': '走路：W A S D 或方向键 · F 拿 · G 切 · Tab 换人',
    // the recipes (the order cards' tooltips)
    'Burger': '汉堡', 'Lettuce Burger': '生菜汉堡', 'Sundae': '圣代', 'Banana Sundae': '香蕉圣代', 'Dumplings': '饺子',
    'Pizza': '披萨', 'Cheese Pizza': '芝士披萨', 'Noodles': '面条', 'Strawberry Smoothie': '草莓奶昔', 'Banana Smoothie': '香蕉奶昔',
    // title and kitchen picker
    'Teddy and Tommy cook up a storm! Chop, cook, serve and wash up.': 'Teddy 和 Tommy 当大厨啦！切菜、做饭、上菜、洗盘子。',
    'both chefs · Tab swaps': '一人管两个厨师 · Tab 换人', 'Teddy W A S D · Tommy arrows': 'Teddy 用 W A S D · Tommy 用方向键',
    '🐣 EASY': '🐣 简单', '🔥 NORMAL': '🔥 普通',
    'Easy: nothing gets crispy, and the orders wait longer.': '简单：食物不会烤焦，订单等得更久。',
    'Normal: more orders, and food left on the heat goes crispy!': '普通：订单更多，食物在火上放太久会烤焦！',
    'PICK A KITCHEN': '选一个厨房', '◀ BACK': '◀ 返回', 'open every kitchen': '打开所有厨房',
    '⭐ Earn coins and tips: serve fast for bigger tips!': '⭐ 赚金币和小费：上菜越快，小费越多！',
    // pause and results
    '▶ KEEP COOKING': '▶ 继续做饭', '↻ START AGAIN': '↻ 重新开始', '☰ KITCHENS': '☰ 厨房', '⌂ TITLE': '⌂ 首页',
    "TIME'S UP!": '时间到！', 'YOU DID IT!': '成功啦！', 'GREAT COOKING!': '做得真棒！', 'AMAZING CHEFS!': '超级大厨！',
    'NEXT ▶': '下一关 ▶', '↻ TRY AGAIN': '↻ 再试一次', '↻ AGAIN': '↻ 再玩一次',
    // the HUD
    'SWAP': '换人', 'HIGH FIVE!': '击掌！', '🤖 AUTOPILOT': '🤖 自动做饭',
    'Time left': '剩余时间', 'Coins and tips': '金币和小费', 'Start the kitchen again (R)': '重新开始（R）', 'Sound on/off (M)': '声音开关（M）',
    'Pause (P)': '暂停（P）', 'Switch chefs (Tab)': '换厨师（Tab）', 'Call your brother (T)': '叫兄弟来帮忙（T）',
    'High five: a speed boost for both (T)': '击掌：两个人一起加速（T）',
    // toasts
    'NICE CATCH!': '接得好！', '🚧 BUMP AHEAD! 🚧': '🚧 前面有颠簸！🚧', 'NOT FINISHED YET!': '还没做好哦！',
    'NOBODY ORDERED THAT!': '没有人点这个！', '✋ HIGH FIVE! SPEED BOOST!': '✋ 击掌！加速！',
    // words drawn in the kitchen
    'OOPS, CRISPY!': '哎呀，烤焦啦！', 'SPLOSH!': '扑通！', 'BUMP!': '颠一下！',
    // the ? panel
    'grab · put down · serve': '拿起 · 放下 · 上菜', 'chop · wash: hold · throw over the river': '切菜 · 洗盘子：按住 · 扔过小河',
    'swap chefs (1 player)': '换厨师（单人）', 'pause · start again · sound': '暂停 · 重新开始 · 声音',
    '1 player: either set of keys works, and Space grabs too.': '单人：两组按键都能用，空格键也能拿东西。',
    'On an iPad, Teddy has the stick and buttons on the left and Tommy on the right. ✋ grabs, 🔪 chops. Tap your brother\'s face to call him.':
      '在 iPad 上，Teddy 用左边的摇杆和按钮，Tommy 用右边的。✋ 拿东西，🔪 切菜。点兄弟的头像叫他来帮忙。',
  });

  L.rule(/^KITCHEN (\d+)$/, '厨房 $1');
  L.rule(/^CALL (TEDDY|TOMMY)$/, '叫 $1');
  L.rule(/^🪙 (\d+) coins$/, '🪙 $1 个金币');
  L.rule(/^(\d+) dish(?:es)? served$/, '上了 $1 道菜');
  L.rule(/^(\d+) in tips$/, '小费 $1');
  L.rule(/^(TEDDY|TOMMY) SAVED THE ORDER!$/, '$1 救下了订单！');
  const TREAT = { 'ICE CREAM': '冰淇淋', WATER: '水', 'JUICE BOX': '果汁', COOKIE: '饼干', WATERMELON: '西瓜', BANANA: '香蕉' };
  L.rule(/^(\S+) (ICE CREAM|WATER|JUICE BOX|COOKIE|WATERMELON|BANANA) FROM (TEDDY|TOMMY)!$/, (m, e, item, who) => `${e} ${who} 送来的${TREAT[item]}！`);
})();
