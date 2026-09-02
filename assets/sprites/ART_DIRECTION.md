# Burrito Run sprite direction

The Batch 2 art uses a warm, flat storybook style with rounded silhouettes, a
subtle paper-cut texture, minimal shading, and strong readability at runner-game
scale. The character and prop details draw from the landscapes and travel culture
of the American Southwest and Mexico without using logos or text.

## Atlases

Each atlas is arranged as four columns by two rows.

### `burrito-donkey-atlas.png`

- Top: four-frame running cycle
- Bottom: jump, tumble, idle, celebration

### `desert-hazards-atlas.png`

- Top: single cactus, armed saguaro, cactus pair, prickly pear
- Bottom: desert rocks, rattlesnake, roadrunner, tumbleweed

### `story-rewards-atlas.png`

- Top: cargo crate, waving traveler, resting traveler, trail sign
- Bottom: oasis, apple tree, carrot farm, apple-and-carrot reward

## Generation prompt set

All three atlases were generated with the built-in image-generation workflow.

### Donkey

> Create one clean 4-column by 2-row transparent 2D game-character atlas for the
> hero of Burrito Run: the exact same small grey-brown donkey in every cell,
> facing right, with long expressive ears, a dark short mane, friendly determined
> face, red woven saddle blanket, leather straps, and one small golden wooden cargo
> crate. Put four distinct running-cycle poses on the top row, then airborne jump,
> gentle tumble, calm idle, and joyful celebration on the bottom row. Use crisp
> flat storybook game art, chunky rounded silhouettes, subtle paper-cut texture,
> a limited warm Southwest palette, minimal soft shading, consistent scale and
> baseline, and no scenery, labels, borders, extra objects, or watermark.

### Hazards

> Create one clean 4-column by 2-row transparent 2D game-obstacle atlas. Top row:
> tall simple saguaro, two-arm saguaro, close cactus pair, low wide prickly pear.
> Bottom row: rounded red-rock cluster, coiled rattlesnake, running roadrunner,
> tumbleweed. Use crisp flat storybook game art, chunky readable silhouettes,
> subtle paper-cut texture, a restrained warm Southwest palette, consistent
> side-view baseline, and no scenery, labels, borders, extra objects, or watermark.

### Story and rewards

> Create one clean 4-column by 2-row transparent 2D story-and-reward atlas. Top
> row: strapped wooden cargo crate, friendly waving traveler, friendly seated tired
> traveler with canteen, wordless wooden sun-symbol trail sign. Bottom row:
> sparkling oasis, abundant apple tree, neat carrot-farm patch, combined apple and
> carrot reward. Use the same crisp flat storybook style, rounded silhouettes,
> subtle paper-cut texture, welcoming non-stereotyped character design, consistent
> side-view baseline, and no labels, borders, logos, extra objects, or watermark.

The generator exported the pale transparency preview as RGB. `game.js` therefore
performs a connected-edge matte removal once when the currently used sprites
load. This leaves enclosed light details intact and keeps the original source PNGs
available for future replacement or offline alpha processing.

## Paisano rescue extension

- `paisano-sleeping.png` — sleeping paisano lying on his side with his sombrero
  covering his face; replaces the standing traveler during play.
- `paisano-sombrero.png` — matching isolated sombrero overlaid on Burrito's saddle
  after rescue and removed when the paisano is delivered at a destination.

These two sprites were generated with the built-in image-generation workflow in
the same warm, hand-painted palette, then reduced to a web-friendly source size.
