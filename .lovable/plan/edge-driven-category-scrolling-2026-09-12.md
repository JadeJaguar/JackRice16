# Edge-driven category scrolling

## What will change
- Keep the budget categories in their existing single horizontal row.
- Automatically scroll the row left when the pointer nears its left edge and right near its right edge.
- Increase scrolling speed as the pointer gets closer to an edge, and stop when it moves away or leaves the row.
- Preserve manual mouse-wheel, trackpad, touch, and drag scrolling.

## Technical details
- Add a small reusable hook inside the budget page using a row reference and `requestAnimationFrame`.
- Respect reduced-motion preferences and avoid movement when the row cannot scroll farther.
- Verify the budget page compiles and the interaction works in the preview.
