# Enterprise UI Governance

## Token Rules
- Use semantic tokens only: `bg-background`, `text-foreground`, `border-border`, `bg-card`, `text-muted-foreground`.
- Avoid hardcoded color utility classes (`text-gray-*`, `bg-white`, `text-white`) in new code.
- Keep `nats-*` classes only for backward compatibility during migration.

## Component Rules
- Prefer primitives from `src/components/ui` before writing custom controls.
- Use `Dialog`/`AlertDialog` for modal and destructive confirmation flows.
- Use `SortableTh` for table sort headers to preserve keyboard + `aria-sort` behavior.

## Accessibility Baseline
- Interactive controls must be keyboard reachable and include visible focus (`focus-visible:ring-*`).
- Never attach click handlers directly to non-interactive elements when a button/link is appropriate.
- Status and errors must be announced with semantic text, not color alone.

## Review Gates
- Build must pass: `npm run build`.
- New UI should not introduce native `confirm()` usage.
- New forms must use consistent field spacing, helper text style, and error presentation.

## Migration Completion Checklist
- [ ] Core pages use semantic tokens.
- [ ] Shared modals use `Dialog`/`AlertDialog`.
- [ ] Shared states (`loading`, `empty`, `error`) render through standard components.
- [ ] Tables and filters maintain consistent spacing and controls.
