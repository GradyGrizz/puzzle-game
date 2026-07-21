'use strict';
// ── Story campaign data ───────────────────────────────────────
// Legend: # wall  . floor  x exit  s switch  c crack  p pit
//         d door  u bush   f fire  b block  B block-on-switch
//         h heavy k key    o coin  C chest  @ start

const STORY = {
  title: 'THE SUNKEN KEEP',
  chapters: [
    {
      id: 'ch1',
      name: 'THE SUNKEN HALLS',
      tagline: 'EVERY DELVE BEGINS WITH A SINGLE STEP.',
      levels: [
        {
          id: '1-1', name: 'AWAKENING',
          intro: 'RAIN HAMMERS THE RUINS OF KING ALARIC\'S KEEP. FAR BELOW, THE SUNSTONE STILL BURNS... AND YOU ARE THE ONLY ONE FOOL ENOUGH TO GO GET IT.',
          hint: 'WALK TO THE STAIRS.',
          map: [
            '###########',
            '#@........#',
            '#.o.....o.#',
            '#........x#',
            '###########',
          ],
        },
        {
          id: '1-2', name: 'THE FIRST TRIAL',
          intro: 'THE OLD MASONS SEALED EVERY STAIR BEHIND SWITCHES OF RED STONE. HEAVY THINGS HOLD THEM DOWN. YOU ARE NOT HEAVY ENOUGH.',
          hint: 'PUSH THE BLOCK ONTO THE RED SWITCH.',
          map: [
            '###########',
            '#....#....#',
            '#.@.b.s..x#',
            '#....#....#',
            '###########',
          ],
        },
        {
          id: '1-3', name: 'TWIN SEALS',
          intro: 'TWO SEALS, TWO STONES. THE MASONS WERE FOND OF SYMMETRY. YOU ARE ALREADY FOND OF HATING THEM.',
          hint: 'BLOCKS ONLY MOVE IF THE SPACE BEHIND THEM IS FREE.',
          map: [
            '###########',
            '#....s....#',
            '#.b.....b.#',
            '#@...s...x#',
            '#.........#',
            '###########',
          ],
        },
        {
          id: '1-4', name: 'THIN ICE, OLD STONE',
          intro: 'THE FLOOR HERE IS ROTTEN. IT WILL HOLD YOUR WEIGHT EXACTLY ONCE. STEP WISELY.',
          hint: 'CRACKED TILES CRUMBLE AFTER YOU LEAVE THEM.',
          map: [
            '###########',
            '#...#.....#',
            '#.o.c..@..#',
            '#...#.....#',
            '#.o.c.....#',
            '#...#....x#',
            '###########',
          ],
        },
        {
          id: '1-5', name: 'FILL THE VOID',
          intro: 'A CHASM SWALLOWED THE EAST HALL LONG AGO. THE MASONS LEFT THEIR STONES BEHIND. MAKE A BRIDGE OF THEM.',
          hint: 'PUSH A BLOCK INTO A PIT TO FILL IT.',
          map: [
            '###########',
            '#@...p...x#',
            '#....p....#',
            '#..b.p....#',
            '#....p....#',
            '#..b......#',
            '###########',
          ],
        },
        {
          id: '1-6', name: 'THE WARDEN\'S KEY',
          intro: 'THE DOOR WARDEN DROWNED AT HIS POST THREE HUNDRED YEARS AGO. HIS KEY DID NOT.',
          hint: 'KEYS OPEN LOCKED DOORS.',
          map: [
            '###########',
            '#@..d....x#',
            '#...#.....#',
            '#k..#.....#',
            '###########',
          ],
        },
        {
          id: '1-7', name: 'LESSONS COMBINED',
          intro: 'DEEPER NOW. THE WATER SOUNDS CLOSER. EVERYTHING THE HALLS HAVE TAUGHT YOU, THEY WILL NOW ASK BACK.',
          hint: null,
          map: [
            '###########',
            '#@..#.....#',
            '#.k.#..b..#',
            '#...d..s..#',
            '#...#.....#',
            '#...#....x#',
            '###########',
          ],
        },
        {
          id: '1-8', name: 'THE ARMORY SEAL',
          intro: 'BEHIND THIS SEAL LIES THE KEEP\'S OLD ARMORY. SOMETHING OF THE KING\'S GUARD SURVIVED THE FLOOD. IT IS WAITING FOR A NEW HAND.',
          hint: 'OPEN THE CHEST TO CLAIM WHAT WAITS INSIDE.',
          map: [
            '###########',
            '#.s.#..C..#',
            '#.b.#.....#',
            '#@..d.b.b.#',
            '#...#s..s.#',
            '#.k.#.....#',
            '#...#....x#',
            '###########',
          ],
          chest: { item: 'sword' },
          outro: 'THE BLADE OF THE DROWNED GUARD IS YOURS. ITS EDGE STILL REMEMBERS HOW TO CUT. THE BRAMBLE DEEP LIES AHEAD...',
        },
      ],
    },

    {
      id: 'ch2',
      name: 'THE BRAMBLE DEEP',
      tagline: 'THE ROOTS FOUND THE DARK, AND LIKED IT.',
      levels: [
        {
          id: '2-1', name: 'FIRST CUT',
          intro: 'BELOW THE HALLS, THE BRAMBLE GREW FAT ON THREE CENTURIES OF SILENCE. YOUR NEW BLADE HUMS. IT REMEMBERS THIS PLACE.',
          hint: 'WALK INTO A BUSH TO CUT IT WITH YOUR SWORD.',
          map: [
            '###########',
            '#@...u...x#',
            '#.o..u..o.#',
            '#....u....#',
            '###########',
          ],
        },
        {
          id: '2-2', name: 'OVERGROWN SEALS',
          intro: 'THE BRAMBLE DOES NOT CARE ABOUT SWITCHES OR SEALS. IT GROWS WHERE IT PLEASES. CLEAR THE WAY.',
          hint: 'CUT THE BUSH BEFORE PUSHING THE BLOCK THROUGH.',
          map: [
            '###########',
            '#....#....#',
            '#.@.bu.s.x#',
            '#.........#',
            '###########',
          ],
        },
        {
          id: '2-3', name: 'THE HEDGE MAZE',
          intro: 'A GARDENER\'S GHOST WOULD WEEP. SOMEWHERE IN THIS TANGLE LIES THE WARDEN\'S SECOND KEY.',
          hint: null,
          map: [
            '###########',
            '#@.u...u.o#',
            '#.#.#.#.#.#',
            '#ou..k..uo#',
            '#.#.#.#.#.#',
            '#..u.d.u.x#',
            '###########',
          ],
        },
        {
          id: '2-4', name: 'THORNS AND STONE',
          intro: 'STONE REMEMBERS ORDERS. BRAMBLE TAKES NONE. BETWEEN THE TWO OF THEM, ONLY YOU CAN CHOOSE A PATH.',
          hint: null,
          map: [
            '###########',
            '#.s.#..o..#',
            '#.b.#.....#',
            '#@u....b.s#',
            '#...#..c..#',
            '#.o.#....x#',
            '###########',
          ],
        },
        {
          id: '2-5', name: 'THE CHOKED CISTERN',
          intro: 'THE CISTERN DRANK THE FLOOD AND KEPT DRINKING. NOW ONLY ITS THROAT REMAINS, BLACK AND BOTTOMLESS.',
          hint: null,
          map: [
            '###########',
            '#@..p.....#',
            '#.b.p..o..#',
            '#...p.....#',
            '#.b.pu...x#',
            '#....u..o.#',
            '###########',
          ],
        },
        {
          id: '2-6', name: 'HEART OF THE BRAMBLE',
          intro: 'AT THE BRAMBLE\'S HEART, THE VINES PART AROUND A SINGLE CHEST, UNTOUCHED. THE ROOTS FEAR WHAT SLEEPS INSIDE IT.',
          hint: null,
          map: [
            '###########',
            '#.k.#..C..#',
            '#.u.#.s.s.#',
            '#@..d.b.b.#',
            '#...#.u...#',
            '#.o.#....x#',
            '###########',
          ],
          chest: { item: 'shield' },
          outro: 'THE WARDEN\'S SHIELD, BRIGHT AS THE DAY IT SANK. THROUGH ITS METAL YOU FEEL A DISTANT HEAT... THE GALLERIES BELOW ARE BURNING.',
        },
      ],
    },

    {
      id: 'ch3',
      name: 'THE ASHEN GALLERIES',
      tagline: 'THE FLOOD NEVER REACHED HERE. SOMETHING ELSE DID.',
      levels: [
        {
          id: '3-1', name: 'TRIAL BY FIRE',
          intro: 'GAS FROM THE DEEP VENTS BURNS WHERE IT LEAKS. THE OLD GALLERIES HAVE BEEN ALIGHT FOR A HUNDRED YEARS. RAISE YOUR SHIELD.',
          hint: 'YOUR SHIELD LETS YOU WALK THROUGH FLAMES.',
          map: [
            '###########',
            '#@...f...x#',
            '#.o..f..o.#',
            '#....f....#',
            '###########',
          ],
        },
        {
          id: '3-2', name: 'SMOTHER THE FLAME',
          intro: 'FIRE NEEDS AIR. A MASON\'S BLOCK NEEDS NOTHING AT ALL. LET THEM ARGUE IT OUT.',
          hint: 'PUSH A BLOCK ONTO A FLAME TO SNUFF IT.',
          map: [
            '###########',
            '#....#....#',
            '#.@.b.fs.x#',
            '#....#....#',
            '###########',
          ],
        },
        {
          id: '3-3', name: 'THE SCORCHED CROSSING',
          intro: 'THE GALLERY FLOOR IS HALF ASH, HALF MEMORY. CHOOSE WHICH HALF HOLDS YOU.',
          hint: null,
          map: [
            '###########',
            '#@..f...o.#',
            '#.#.f.###.#',
            '#...f...s.#',
            '#.b.f..b..#',
            '#...c....x#',
            '###########',
          ],
        },
        {
          id: '3-4', name: 'GALLERY OF EMBERS',
          intro: 'TWO SEALS STAND IN A HALL OF STANDING FLAME. THE SHIELD GROWS WARM, THEN PROUD.',
          hint: 'YOU CAN STAND IN FLAMES AND WORK.',
          map: [
            '###########',
            '#.s.#.s...#',
            '#.b.#.b...#',
            '#@f...f..x#',
            '###########',
          ],
        },
        {
          id: '3-5', name: 'THE FURNACE GATE',
          intro: 'THE GATE AHEAD FED THE KEEP\'S FORGES. ITS KEY HANGS WHERE NO BARE-HANDED THIEF WOULD EVER REACH.',
          hint: null,
          map: [
            '###########',
            '#.k.#..o..#',
            '#.f.#.f.f.#',
            '#@..d.b..x#',
            '#...#.f.s.#',
            '###########',
          ],
        },
        {
          id: '3-6', name: 'HEART OF ASH',
          intro: 'IN THE DEEPEST GALLERY, THE FLAMES BOW AROUND AN IRON CHEST. WHATEVER WAITS INSIDE HAS NEVER FEARED THE HEAT.',
          hint: null,
          map: [
            '###########',
            '#.s.#.C.f.#',
            '#.b.#...f.#',
            '#@f.d.bff.#',
            '#.k.#.s..x#',
            '###########',
          ],
          chest: { item: 'glove' },
          outro: 'THE TITAN GLOVE SWALLOWS YOUR HAND TO THE ELBOW. YOU FLEX, AND SOMEWHERE BELOW, IRON GROANS IN ITS SLEEP.',
        },
      ],
    },

    {
      id: 'ch4',
      name: 'THE IRON VAULTS',
      tagline: 'WHAT THE KING VALUED, HE MADE TOO HEAVY TO STEAL.',
      levels: [
        {
          id: '4-1', name: 'WEIGHT OF AGES',
          intro: 'THE VAULT BLOCKS ARE SOLID IRON. YESTERDAY YOU COULD NOT HAVE ROCKED ONE. TODAY IT SLIDES LIKE A CHILD\'S TOY.',
          hint: 'THE TITAN GLOVE PUSHES DARK IRON BLOCKS.',
          map: [
            '###########',
            '#@..h..s.x#',
            '#.o.......#',
            '###########',
          ],
        },
        {
          id: '4-2', name: 'IRON AND STONE',
          intro: 'STONE AND IRON, SIDE BY SIDE. THE MASONS AND THE SMITHS NEVER AGREED ON ANYTHING EXCEPT SEALS.',
          hint: null,
          map: [
            '###########',
            '#....s....#',
            '#.b.....h.#',
            '#@...s...x#',
            '#.........#',
            '###########',
          ],
        },
        {
          id: '4-3', name: 'THE COUNTERWEIGHT',
          intro: 'THE VAULT FLOOR GAVE WAY A CENTURY AGO. IRON SINKS. USE THAT.',
          hint: null,
          map: [
            '###########',
            '#@...p...x#',
            '#..h.p....#',
            '#....p.o..#',
            '#..b.p....#',
            '###########',
          ],
        },
        {
          id: '4-4', name: 'VAULT OF SEALS',
          intro: 'THREE SEALS GUARD THE INNER VAULTS. THE KEY IS WHERE KEYS ALWAYS ARE: EXACTLY WHERE YOU LEAST WANT TO GO.',
          hint: null,
          map: [
            '###########',
            '#.s.#.s.s.#',
            '#.h.#.b.h.#',
            '#@..d.....#',
            '#.k.#..f..#',
            '#...#....x#',
            '###########',
          ],
        },
        {
          id: '4-5', name: 'THE CRUSHING DEPTH',
          intro: 'THE DEEPEST VAULT HOLDS NOTHING BUT ITS OWN LOCKS. THE KING KEPT IT THAT WAY TO TRAIN HIS GUARD. TRAIN.',
          hint: null,
          map: [
            '###########',
            '#....s....#',
            '#.h.....h.#',
            '#@...s....#',
            '#.h.......#',
            '#....s...x#',
            '###########',
          ],
        },
        {
          id: '4-6', name: 'THE VAULT DOOR',
          intro: 'PAST THE LAST DOOR, A CHEST OF PALE WOOD SITS ALONE IN THE DARK. THE DARK SEEMS... THICKER, DOWN HERE.',
          hint: null,
          map: [
            '###########',
            '#.s.#..C..#',
            '#.h.#.....#',
            '#@..d.h.b.#',
            '#.k.#s..s.#',
            '#....#...x#',
            '###########',
          ],
          chest: { item: 'lantern' },
          outro: 'THE PALE LANTERN LIGHTS WITHOUT FLAME OR OIL. BELOW THE VAULTS THERE ARE NO TORCHES LEFT. THERE IS ONLY WHAT YOU CARRY.',
        },
      ],
    },

    {
      id: 'ch5',
      name: 'THE LIGHTLESS DEEP',
      tagline: 'THE SUNSTONE WAITS WHERE NO SUN HAS EVER BEEN.',
      levels: [
        {
          id: '5-1', name: 'INTO THE DARK',
          intro: 'THE STAIRS END. THE MAPS END. THE LANTERN\'S CIRCLE IS THE WHOLE WORLD NOW, AND YOU MUST WALK IT FORWARD.',
          hint: 'THE LANTERN LIGHTS YOUR WAY. GO SLOW.',
          dark: true,
          map: [
            '###########',
            '#@...#..o.#',
            '#.o.##...##',
            '#....#.o..#',
            '##.......x#',
            '###########',
          ],
        },
        {
          id: '5-2', name: 'SHADOWED SEALS',
          intro: 'SEALS, AGAIN. BUT DOWN HERE YOU CANNOT SEE THE WHOLE PUZZLE AT ONCE. HOLD IT IN YOUR MIND, DELVER.',
          hint: null,
          dark: true,
          map: [
            '###########',
            '#....s....#',
            '#.b.....b.#',
            '#@...s...x#',
            '#.........#',
            '###########',
          ],
        },
        {
          id: '5-3', name: 'THE BLIND CROSSING',
          intro: 'THE FLOOR AHEAD IS A LIAR. SOME OF IT IS FLOOR. LISTEN TO IT CRACK.',
          hint: null,
          dark: true,
          map: [
            '###########',
            '#@...c....#',
            '#.b..c.p..#',
            '#....c.p.x#',
            '#..o.c....#',
            '###########',
          ],
        },
        {
          id: '5-4', name: 'EMBERS IN THE GLOOM',
          intro: 'FIRELIGHT, AT LAST - BUT IT IS NOT FRIENDLY FIRE. NOTHING DOWN HERE IS FRIENDLY. IT IS ONLY VISIBLE.',
          hint: null,
          dark: true,
          map: [
            '###########',
            '#.s.f...s.#',
            '#.b.#.#.b.#',
            '#@..f.f...#',
            '#....x....#',
            '###########',
          ],
        },
        {
          id: '5-5', name: 'THE DROWNED ARMORY',
          intro: 'RUSTED RACKS, EMPTY SCABBARDS. THE KING\'S LAST GUARD LEFT EVERYTHING AND WALKED INTO THE DEEP. YOU ARE FOLLOWING THEIR FOOTPRINTS.',
          hint: null,
          dark: true,
          map: [
            '###########',
            '#.k.#..s..#',
            '#.u.#..h..#',
            '#@..d.....#',
            '#.o.#..b.s#',
            '#...#....x#',
            '###########',
          ],
        },
        {
          id: '5-6', name: 'GAUNTLET OF THE KEEP',
          intro: 'THE LAST HALL BEFORE THE HEART. EVERY TRICK THE KEEP KNOWS, IT SPENDS HERE. SPEND YOURS.',
          hint: null,
          dark: true,
          map: [
            '###########',
            '#@.c#..f..#',
            '#.b.#.b.h.#',
            '#...d..s.s#',
            '#.s.#.....#',
            '#.k.#.o..x#',
            '###########',
          ],
        },
        {
          id: '5-7', name: 'THE SUNSTONE',
          intro: 'A ROUND CHAMBER. A PEDESTAL. A CHEST OF GOLD AND GLASS, GLOWING FROM WITHIN LIKE A SECOND DAWN. REACH IT, DELVER, AND FINISH THIS.',
          hint: null,
          dark: true,
          map: [
            '###########',
            '#....C....#',
            '#.f.h.h.f.#',
            '#..s...s..#',
            '#@.b...b..#',
            '#....o....#',
            '#....x....#',
            '###########',
          ],
          chest: { item: 'sunstone' },
          outro: 'THE SUNSTONE RISES INTO YOUR HANDS, WARM AS A SUMMER YOU NEVER LIVED TO SEE. ABOVE YOU, STONE BY STONE, THE SUNKEN KEEP BEGINS TO GLOW. THE DELVE IS COMPLETE. THE KEEP REMEMBERS ITS KING - AND NOW IT WILL REMEMBER YOU.',
        },
      ],
    },
  ],
};

// item metadata for chests / inventory
const ITEMS = {
  sword:    { name: 'GUARD\'S BLADE',   desc: 'CUTS THROUGH BUSHES AND BRAMBLE.' },
  shield:   { name: 'WARDEN\'S SHIELD', desc: 'WALK UNBURNED THROUGH FLAMES.' },
  glove:    { name: 'TITAN GLOVE',      desc: 'PUSHES HEAVY IRON BLOCKS.' },
  lantern:  { name: 'PALE LANTERN',     desc: 'LIGHTS THE DARKEST VAULTS.' },
  sunstone: { name: 'SUNSTONE',         desc: 'THE HEART OF THE KEEP, ABLAZE ONCE MORE.' },
};

function getStoryLevel(id) {
  for (const ch of STORY.chapters)
    for (const lv of ch.levels)
      if (lv.id === id) return { chapter: ch, level: lv };
  return null;
}

// linear ordering across chapters
function allStoryLevels() {
  const out = [];
  for (const ch of STORY.chapters) for (const lv of ch.levels) out.push(lv);
  return out;
}

function nextStoryLevel(id) {
  const all = allStoryLevels();
  const i = all.findIndex(l => l.id === id);
  return i >= 0 && i < all.length - 1 ? all[i + 1] : null;
}

// a story level is unlocked if it's the first, or the previous is done
function isLevelUnlocked(id, save) {
  const all = allStoryLevels();
  const i = all.findIndex(l => l.id === id);
  if (i <= 0) return true;
  return save.isLevelDone(all[i - 1].id);
}

function chapterProgress(ch, save) {
  let done = 0;
  for (const lv of ch.levels) if (save.isLevelDone(lv.id)) done++;
  return { done, total: ch.levels.length };
}

if (typeof module !== 'undefined') {
  module.exports = { STORY, ITEMS, getStoryLevel, allStoryLevels, nextStoryLevel };
}
