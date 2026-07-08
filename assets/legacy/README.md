# The library

Hand-drawn SVGs that sit behind every post on echo-notes. Each post has
exactly one library scene. The scenes share a single visual language, so
the blog feels like the same place from post to post.

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
vanishing point near the center of the canvas.

## The center 70ch rule

Each post's text panel sits centered, roughly 70ch wide. On a 1200-wide
viewBox, that means the central ~650px of the canvas is reserved for
text overlay. **Do not place focal subjects (the lit lamp, the
armchair, an open book) in that central band.** Keep them at the left
or right periphery. The center is air, the suggestion of a room.

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

## Adding a new scene

**Copy the closest existing SVG and modify.** Don't start from
scratch. The continuity is the point. If a future post needs a new
scene — a hallway, a window, a reading desk in a different light —
open the SVG that is closest in mood and reshape from there. Keep the
palette, the line weight, the perspective, the accent count, and the
single animation. Change the subject, not the language.

## Constraints from v1

- No JavaScript. The animation is CSS only.
- No external assets of any kind. Every line is hand-coded in this
  directory.
- No emoji in titles, navigation, or chrome.
- The post must be fully readable with the SVG missing. The
  translucent panel and the body text do not depend on the SVG.
- File size: aim for under 15 KB per SVG. Hand-drawing keeps it there.
