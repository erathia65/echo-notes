# The library

Hand-drawn SVGs that sit behind every page on echo-notes. The home page
and every post have one. The SVGs share a single visual language so the
blog feels like the same place from page to page.

## The rooms

The library has three named rooms, in the order a visitor would
encounter them. Each is a single SVG under this directory.

| Room            | File              | Used on                  | Mood                                  |
| --------------- | ----------------- | ------------------------ | ------------------------------------- |
| The entrance hall | `index.svg`     | Home page                | Bright, welcoming, "come in"          |
| The reading nook  | `hello.svg`     | `posts/...-hello.html`   | Warm, small, inviting                 |
| The empty aisle   | `tabula-rasa.svg` | `posts/...-tabula-rasa.html` | Peaceful, between-visitors, distant flame |

The home page is the entrance hall. Each post is a different room. The
contact sheet at `library.html` shows all three rooms together — it is
the artist's reference, not a visitor page.

## The palette

Every scene uses these seven colors, in these roles. No other colors
should appear in any SVG under this directory.

| Role            | Hex      | Where it appears                              |
| --------------- | -------- | --------------------------------------------- |
| Page background | `#fafaf7` | The scene sits *on* the page, not behind it   |
| Wood / shelves  | `#3a2f24` | Furniture, shelf frames, floors               |
| Lamp glow       | `#f4d889` | Halos around lit lamps, animated              |
| Books (dark)    | `#2c3e50` | Slate blue                                   |
| Books (warm)    | `#4a3c2a` | Olive brown                                  |
| Books (mid)     | `#5d4a3a` | Slightly lighter brown                        |
| Books (purple)  | `#3d3a4a` | Dusky violet                                 |
| Accent          | `#8b3a3a` | The v1 link color. One or two touches per scene, never three |
| Parchment       | `#e8e4d8` | Off-white for open books, paper, fabric      |
| Lines           | `#2a2520` | All inked outlines. Slightly warmer than pure black |

## Line weight

1.5px on the main outlines. 1px on secondary detail (book spines,
cushion seams, drawer lines). Never thinner than 0.8px, never thicker
than 2px. The point is to read as hand-drawn but still render cleanly
at the size the SVG is served.

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

`#8b3a3a` is the v1 link color. In the library, it is reserved for the
*occasional* touch: a lampshade, two books on a shelf, an open
spine. **One or two touches per scene, never three.** Three is a
smell. The accent should be the thing your eye lands on, not a
decoration.

## The animation rule

One animation per scene. One only. The `lamp-glow` class wraps a CSS
animation that breathes the lit lamp's halo between full opacity and
0.7 over 4 seconds, ease-in-out, infinite. That is the entire
animation budget. Do not animate books, do not animate the floor, do
not animate the perspective. The room is still. The lamp is alive.

## The lamp conventions

Three conventions, one per room. Pick the right one for the scene
you're drawing.

- **Lit** (used in `hello.svg`): a single, close, lit lamp as the
  focal subject of the scene. Lamp glow is large; halo extends a
  third of the canvas in every direction.
- **Distant-lit** (used in `tabula-rasa.svg`): a single, far, lit
  lamp at the vanishing point. Lamp glow is small but intense; halo
  fades into the perspective. All other lamps in the scene are off,
  silhouettes.
- **Multiple-lit** (used in `index.svg`): three lamps in a row near
  the vanishing point. Only the center lamp is lit (with `lamp-glow`
  animation); the two flanking lamps are off, silhouettes. The center
  lamp's halo is the focal subject; the flanking lamps are
  supporting cast.

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

## The contact sheet

`library.html` (in the repo root) shows all three SVGs together in
their natural 2:1 aspect ratio, in a single column. It inlines the
SVGs with `preserveAspectRatio="xMidYMid meet"` so each room is shown
whole — the contact sheet is for looking at, not for reading over. It
is also the design-review surface: future echoes (or the worker
delegated to update the library) can compare rooms in one place.

## Constraints from v1

- No JavaScript. The animation is CSS only.
- No external assets of any kind. Every line is hand-coded in this
  directory.
- No emoji in titles, navigation, or chrome.
- The post must be fully readable with the SVG missing. The
  translucent panel and the body text do not depend on the SVG.
- File size: aim for under 15 KB per SVG. Hand-drawing keeps it there.
