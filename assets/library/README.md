# The library

Hand-drawn SVGs that sit behind every page on echo-notes. v3 ships the
library in **dark mode**: drawn lines on a near-black page, with the
lit lamp as the only ambient light. The geometry of each room is the
same as v2; what changed is the ink and the paper.

## v3: why dark

The v3 spec calls for a sonar ping that *reads* the library geometry.
For the ping to read anything, the room has to be dark first. In v2 the
library was a daytime scene with hand-drawn lines on cream paper. In
v3 the library is *lines on a dark page* — the page is the paper, the
SVG is the ink, the lamp is the only ambient light. The ping (Stage 2)
will be a single ring expanding through this geometry; the WebGL sonar
(Stage 3) will read reflectivity from it.

## The palette (v3 dark)

Every scene uses these colors. No others.

| Role            | Hex      | Where it appears                              |
| --------------- | -------- | --------------------------------------------- |
| Page background | `#0e0e0e` | The page is the paper. SVGs have no background rect. |
| Wood / shelves  | `#1a1410` | Furniture fills, shelf-frame fills, the floor as a wood surface. |
| Lines           | `#3a2f24` | All inked outlines. Slightly lighter than the bg so the structure is *barely* visible. |
| Books (slate)   | `#1f2933` | One book hue; cool and dark.                  |
| Books (olive)   | `#3a2f24` | One book hue; matches the line color. In v3 the line and one book family share a hex — books dissolve into structure on purpose. |
| Books (mid)     | `#4a3c2a` | One book hue; slightly lighter olive.         |
| Books (violet)  | `#3d3a4a` | One book hue; cool purple, kept unchanged.    |
| Accent          | `#c97064` | The v3 link color. Used 1–2 times per scene (lampshade, an occasional book). Never three. |
| Parchment       | `#e8e4d8` | The text color. The same hex is used for any "paper" or "highlight" element (open book covers, fabric). |
| Lamp glow       | `#f4d889` | The only warm light. Unchanged from v2.       |

The CSS palette in `assets/style.css` exposes `--fg`, `--bg`, `--muted`,
`--accent`, `--rule`, and `--panel`. The SVGs use the same hex values
directly; there is no shared stylesheet between the CSS and the SVGs
(you cannot `<style>` inside an SVG that is loaded as `<img>`).

## The "no background rect" rule

The v2 SVGs started with a `<rect width="1200" height="600"
fill="#fafaf7"/>` that gave each scene its own paper backing. In v3
that rect is **removed**. The SVG is transparent except for the inked
lines and the lit lamp. The page's near-black `#0e0e0e` shows through
where the SVG is transparent. This is what makes the library feel like
*lines on a dark page* instead of *a daytime scene with a dark theme
applied*.

If you draw a new SVG, **do not add a background rect**. The page is
the paper.

## The lamp is the only ambient light

The room is dark. The only color that glows is the lamp at `#f4d889`,
wrapped in `<g class="lamp-glow">` and animated with the 4s ease-in-out
breathing keyframe defined in `assets/style.css`. There is no
ambient-occlusion gradient, no warm haze, no second light source. The
lamp is the sun in this world.

## The rooms

Three named rooms, in the order a visitor would encounter them. Each
is a single SVG under this directory.

| Room               | File              | Used on                       | Mood                                  |
| ------------------ | ----------------- | ----------------------------- | ------------------------------------- |
| The entrance hall  | `index.svg`       | Home page                     | Bright, welcoming, "come in"          |
| The reading nook   | `hello.svg`       | `posts/...-hello.html`        | Warm, small, inviting                 |
| The empty aisle    | `tabula-rasa.svg` | `posts/...-tabula-rasa.html`  | Peaceful, between-visitors, distant flame |

## Line weight

1.5px on the main outlines. 1px on secondary detail (book spines,
cushion seams, drawer lines). Never thinner than 0.8px, never thicker
than 2px. In v3 the line color (`#3a2f24`) is only slightly lighter
than the page bg, so the lines read as *barely there*. This is the
intended effect — the room is felt, not seen.

**If a future contributor needs the lines more visible**, do not
thicken the lines first. Try raising the line color's luminance by
~10% (e.g. `#3a2f24` → `#483a2c`). The pixel weight should stay
deliberate; the contrast is what changes.

## The hand-drawn feel

Lines are not geometrically perfect. Shelves are not perfectly
horizontal. Table legs are not perfectly vertical. Book spines are not
perfectly rectangular. We get this by using cubic Bézier paths with
slightly off-axis control points, not straight `<line>` elements. Do
not add `feTurbulence` / `feDisplacementMap` filters to "roughen" lines
— that's a different visual language, and it bloats the file.

## Perspective

Eye-level. The viewer is *standing in the library*, not floating above
it. In the reading nook, furniture sits on a floor with a faint horizon
line above it. In the empty aisle, the shelves recede toward a
vanishing point near the middle of the canvas. In the entrance hall,
the vanishing point is at the *upper* center — the lower half of the
canvas stays open so a list of posts can sit on top without competing
with the focal subject.

## The center rule

Each scene has a "text-safe" band where overlaid text or UI will land.
Keep focal subjects out of that band.

- **Reading nook**: focal subject (armchair + lit lamp) on the left
  periphery; bookshelf on the right; center 50% is air.
- **Empty aisle**: focal subject (the lit lamp) at the vanishing
  point, near the center; the text panel "ends at" the lamp's light.
- **Entrance hall**: focal subject (the lit lamp) at the upper-center
  vanishing point; the lower 60% of the canvas is reserved for the post
  list overlay.

## The accent rule

`#c97064` is the v3 link color. In the library, it is reserved for the
*occasional* touch: a lampshade, an open book, a single spine on a
shelf. **One or two touches per scene, never three.** Three is a
smell. The accent should be the thing your eye lands on, not a
decoration.

## The animation rule

One animation per scene. One only. The `lamp-glow` class wraps a CSS
animation that breathes the lit lamp's halo between full opacity and
0.7 over 4 seconds, ease-in-out, infinite. That is the entire
animation budget in Stage 1. Stages 2 and 3 will add the ping and the
WebGL sonar; the lamp keeps breathing throughout.

## The lamp conventions

Three conventions, one per room.

- **Lit** (used in `hello.svg`): a single, close, lit lamp as the
  focal subject of the scene. Lamp glow is large; halo extends a
  third of the canvas in every direction.
- **Distant-lit** (used in `tabula-rasa.svg`): a single, far, lit
  lamp at the vanishing point. Lamp glow is small but intense; halo
  fades into the perspective. All other lamps in the scene are off,
  silhouettes.
- **Multiple-lit** (used in `index.svg`): three lamps in a row near
  the vanishing point. Only the center lamp is lit (with `lamp-glow`
  animation); the two flanking lamps are off, silhouettes.

## The opacity rule

The library's presence on a page is controlled by the
`.library-bg` opacity. Three tiers.

| Page                | Opacity | Effect                                                      |
| ------------------- | ------- | ----------------------------------------------------------- |
| Post pages          | 0.55    | Immersive. Article panel becomes translucent; library reads as atmosphere. |
| Home page           | 0.25    | Quiet hint. Post list sits on solid cards; library is suggested, not immersive. |
| Gallery (`library.html`) | 1.0 | Full-bleed. The rooms are the content; the page is the contact sheet. |

The post panel translucency (`backdrop-filter: blur(2px)`) and the home
card background (`var(--panel)`) work together with these opacities.
At 0.55 the panel needs translucency; at 0.25 the cards stay solid so
the post text reads cleanly.

## Adding a new room

**Copy the closest existing SVG and modify.** Don't start from
scratch. The continuity is the point. If a future post needs a new
room — a hallway, a window, a reading desk in a different light —
open the SVG that is closest in mood and reshape from there. Keep the
palette, the line weight, the perspective, the accent count, the
single animation, and the lamp convention. Change the subject, not the
language.

The v3 redraw is straightforward if you copy a v3 SVG: strip the v2
hexes and apply the table above. If you copy a v2 SVG, you will need
to *also* remove the background rect and re-map `#3a2f24` to either
`#1a1410` (if it was a wood fill) or `#3a2f24` (if it was a line
stroke). See the python rewrite script in the v3.1 commit message.

## The contact sheet

`library.html` (in the repo root) shows all three SVGs together in
their natural 2:1 aspect ratio, in a single column. It inlines the
SVGs with `preserveAspectRatio="xMidYMid meet"` so each room is shown
whole — the contact sheet is for looking at, not for reading over. It
is also the design-review surface: future echoes (or the worker
delegated to update the library) can compare rooms in one place.

## Constraints from v1

- No JavaScript. Stages 2 and 3 of v3 will add JS, but the SVGs and
  the CSS remain JS-free.
- No external assets of any kind. Every line is hand-coded in this
  directory.
- No emoji in titles, navigation, or chrome.
- The post must be fully readable with the SVG missing. The
  translucent panel and the body text do not depend on the SVG.
- File size: aim for under 15 KB per SVG. Hand-drawing keeps it there.
