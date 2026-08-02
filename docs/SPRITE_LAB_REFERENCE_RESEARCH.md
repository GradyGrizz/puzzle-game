# Sprite Lab reference-animation research

The experimental DELVER animations in
`js/sprite-lab-reference-animations.js` are original motion studies. They use
DELVE's own sprites and do not copy character artwork from another game.
They are loaded only by Sprite Lab; gameplay keeps its production animations.

## Walking

- [PixelPad four-frame walk-cycle guide](https://pixelartapp.com/walk-cycle):
  contact and passing poses, opposite arm/leg motion, and readable timing.
- [SpriteGen frame-by-frame guide](https://spritegen.io/guides/how-to-animate-pixel-art/):
  planted-foot discipline, gentle head arcs, nearest-neighbor previewing, and
  uniform sprite-sheet cells.
- [Godot CC0 top-down prototype character](https://store.godotengine.org/asset/snoblin/top-down-prototype-character/):
  a permissively licensed reference confirming that four frames can clearly
  communicate four-direction top-down walking.
- [Sandro Maglione's top-down animation overview](https://www.sandromaglione.com/articles/pixel-art-top-down-game-sprite-design-and-animation):
  three-frame directional cycles and the importance of grounding/shadows.

Applied to Sprite Lab: contact poses receive a short hold, opposite feet trade
roles, arms counter-swing, and left-facing motion mirrors the approved right
sheet rather than introducing a second design.

## Pushing

- [Game Developer: animation principles in games](https://www.gamedeveloper.com/production/the-12-principles-of-animation-in-video-games):
  anticipation, timing, follow-through, and secondary motion communicate mass.
- [University of Washington animation principles](https://courses.cs.washington.edu/courses/cse458/25au/content/exercises/animation_principles.html):
  pose-to-pose planning, crouch-based compression, and recovery.

Applied to Sprite Lab: the character shifts slightly away in anticipation,
leans into contact, holds a compressed pose to communicate weight, and recovers.
The block moves only during the drive phase. All four directions use the same
timing profile and direction vector.

## Isolation rule

The module is deliberately called only from `drawSpriteLabCharacter`. No game
renderer imports it, so these studies can be compared safely before any motion
is promoted into production gameplay.

