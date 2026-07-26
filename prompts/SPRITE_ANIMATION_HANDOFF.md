# Existing-Sprite Animation Handoff Prompt

Copy everything inside the prompt block and replace the bracketed fields.

```text
You are creating a new frame-by-frame animation for an already approved
pixel-art character. The existing sprite is the source of truth. Your job is to
animate it without redesigning, regenerating, or changing the character.

ANIMATION REQUEST
- Character: [CHARACTER NAME]
- Animation: [WALK / ATTACK / PUSH / HURT / DEATH / OTHER]
- Direction: [UP / DOWN / LEFT / RIGHT]
- Total frames: [FRAME COUNT]
- Playback speed: [FPS OR PER-FRAME TIMING]
- Loop behavior: [LOOP / RETURN TO IDLE / ONE SHOT]
- Approved source sprite: [FILE PATH OR ATTACHED IMAGE]
- Reference image or motion description: [REFERENCE]
- Required neutral/idle frames: [EXAMPLE: FRAMES 1, 5, AND 9]
- Destination repository/project: [REPOSITORY]

NON-NEGOTIABLE CHARACTER INVARIANTS
1. Treat the approved source sprite as locked character artwork.
2. Do not change the character's design, face, hair, clothing, equipment,
   colors, outline style, shading style, proportions, scale, or pixel density.
3. Do not redraw unaffected body parts. Reuse exact approved pixels whenever a
   body part does not need to move.
4. Never stretch, squash, rotate with interpolation, blur, resample, or
   regenerate the whole character.
5. Use integer-pixel translations and nearest-neighbor operations only.
6. Keep every frame on an identically sized transparent canvas with a stable
   anchor and baseline.
7. Preserve apparent height, width, head size, limb thickness, hand size, boot
   size, and equipment size across the complete animation.
8. Any required idle frame must be pixel-identical to the approved idle sprite,
   not an AI recreation of it.

PLAN THE MOTION BEFORE DRAWING
1. Describe the motion as key poses:
   - neutral/idle;
   - anticipation or first transition;
   - first extreme/contact pose;
   - recovery or passing pose;
   - opposite extreme/contact pose;
   - final recovery/idle.
2. Assign each key pose to a numbered frame.
3. Identify the character's visual anchor, normally the planted foot position
   or the center point between both feet.
4. Decide which parts must move in each frame and which parts remain locked.
5. For walking, make the feet genuinely exchange roles. One foot travels
   forward while the other travels back, then they swap. Add counter-swinging
   arms and a controlled torso/head weight shift.
6. For attacks, separate anticipation, acceleration, impact, follow-through,
   and recovery. The strike may use faster frame timing than the wind-up.

FRAME-BY-FRAME PRODUCTION PROCESS
1. Create a backup of every current animation file before altering anything.
2. Create an empty sprite-sheet layout with exactly [FRAME COUNT] equal cells.
3. Put the exact approved idle sprite in every required idle cell first.
4. Create only one new frame at a time.
5. Build each frame from the previous approved frame and the original source
   sprite. Change only the pixels required for that stage of the motion.
6. After each frame, compare it against:
   - the approved idle sprite;
   - the immediately previous frame;
   - the corresponding opposite/extreme frame;
   - every already approved frame in the cycle.
7. Check the head, torso, hands, arms, legs, feet, clothing, weapon, outline,
   colors, canvas bounds, anchor, and baseline separately.
8. Do not proceed when a frame introduces shrinking, growth, warping, drifting,
   duplicated limbs, missing pixels, smeared pixels, accidental recoloring, or
   an unnatural jump.
9. Use deliberate transition spacing. A transition must be visibly between its
   surrounding poses; it must not be a duplicate of either one.
10. Keep the amount of motion appropriate for the frame count. Do not make
    eight nearly identical frames when four or six clear poses would animate
    better.

PIXEL AND TRANSPARENCY RULES
1. Preserve true transparent background pixels outside the sprite.
2. Detect and repair transparent pinholes, weak-alpha pixels, and narrow
   transparency channels inside the character.
3. Inspect the animation over both a dark background and a high-contrast
   checkerboard. A black preview alone can hide alpha defects.
4. Pixel art should not contain blurred fractional-alpha edges unless the
   approved source deliberately uses them. Match the source's alpha policy
   exactly.
5. Remove isolated color noise, AI smearing, duplicated outlines, muddy edge
   pixels, and unexpected colors.
6. Do not repair alpha by expanding the silhouette carelessly. Preserve the
   approved contour and limb thickness.

PROPORTION AND MOTION VALIDATION
For every frame, measure or compare:
- canvas dimensions;
- nontransparent bounding box;
- character height and width;
- head dimensions;
- torso dimensions;
- arm, hand, leg, foot, and equipment dimensions;
- foot baseline and character anchor;
- palette/color consistency;
- alpha-channel defects.

The character may move within the canvas, but it must not appear to grow,
shrink, stretch, compress, or change anatomy. Head movement must follow torso
movement naturally. Clothing and attached equipment must follow the body part
that carries them.

ANIMATION REVIEW
1. Assemble the complete sprite sheet in numbered frame order.
2. Preview the loop at full resolution with nearest-neighbor scaling.
3. Preview it at the exact size used in the game.
4. Preview it at the intended timing, not only as a static sheet.
5. Check the loop boundary from the final frame back to frame 1.
6. If the motion pauses, jitters, teleports, changes scale, or reveals a pixel
   defect, return to the responsible frame and fix it.
7. Repeat inspection until the animation is clean. Do not declare success
   based only on file generation or automated tests.

REPOSITORY INTEGRATION
If you have access to the project:
1. Save individual frames with zero-padded names such as frame_01.png.
2. Save a review/progress sheet in the animation draft directory.
3. Save the approved production sheet in the live animation directory.
4. Keep or create a dated backup of the version being replaced.
5. Register the production asset in the game's asset loader.
6. Add the animation to Sprite Lab or the animation-preview page.
7. Add the same animation to the real character renderer in every dungeon and
   game mode where that character appears.
8. Use the same frame count and timing in Sprite Lab and gameplay.
9. Add or update tests for frame count, cell dimensions, idle keyframes,
   direction mapping, gameplay selection, and timing.
10. Run the animation tests and the complete gameplay test suite.
11. Update the game's build timestamp if the project uses one.
12. Commit only the intended files and push the finished update to GitHub.

REQUIRED DELIVERABLES
- All numbered transparent PNG frames.
- The combined sprite sheet.
- A full-resolution animation preview.
- A game-scale animation preview.
- A backup of the previous version, when replacing an animation.
- Updated Sprite Lab/preview integration.
- Updated real gameplay integration.
- Validation/test results.
- A concise change report containing saved paths and the Git commit.

FINAL ACCEPTANCE CHECKLIST
Do not report completion until every statement is true:
- Required idle frames exactly match the approved source.
- Every frame uses the same canvas size.
- Character proportions remain stable.
- Feet/limbs perform the requested motion clearly.
- Torso, head, clothing, and equipment move coherently.
- No color drift exists.
- No transparent holes or weak-alpha glitches exist.
- No blurred, smeared, duplicated, or stray pixels exist.
- The loop is smooth at the requested timing.
- The animation looks correct at actual game scale.
- Sprite Lab and gameplay use the same approved asset.
- Tests pass.
- The finished files are committed and pushed.

When information is missing, inspect the repository and existing animation
conventions first. Ask me only for a decision that cannot be safely inferred.
Do not redesign the character. Do not generate the entire sheet in one
unreviewed step. Work frame by frame, compare continuously, and keep iterating
until the animation satisfies every acceptance check.
```

## Suggested handoff package

When sending this prompt to another AI, attach or link:

1. The approved idle sprite.
2. The closest finished animation for the same character.
3. A motion-reference image or short video.
4. The repository and destination asset paths.
5. The desired frame count and playback timing.

