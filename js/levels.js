'use strict';
// ── Story campaign data ───────────────────────────────────────
// Legend: # wall  . floor  x exit  s switch  c crack  p pit
//         d door  u bush   b block B block-on-switch  h heavy
//         k key   o coin   C chest @ start

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
  ],
};

// item metadata for chests / inventory
const ITEMS = {
  sword:   { name: 'GUARD\'S BLADE',  desc: 'CUTS THROUGH BUSHES AND BRAMBLE.' },
  shield:  { name: 'WARDEN\'S SHIELD', desc: 'BLOCKS DARTS AND FLAME.' },
  glove:   { name: 'TITAN GLOVE',    desc: 'PUSHES HEAVY IRON BLOCKS.' },
  boots:   { name: 'STRIDER BOOTS',  desc: 'CROSSES SPIKES UNHARMED.' },
  lantern: { name: 'PALE LANTERN',   desc: 'LIGHTS THE DARKEST VAULTS.' },
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

if (typeof module !== 'undefined') {
  module.exports = { STORY, ITEMS, getStoryLevel, allStoryLevels, nextStoryLevel };
}
