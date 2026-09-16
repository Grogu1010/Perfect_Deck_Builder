# Perfect Clash Royale Deck Builder

Open `index.html` in a modern browser. No build step is required.

## What it does
- Generate the closest possible 8-card deck from nothing.
- Type cards that must be included, then optimize around them.
- Review any deck live against the custom Perfect Deck targets.
- Lock cards so the optimizer cannot replace them.
- Click any slot to swap a card manually.
- Use **Best swap** to exclude a disliked card and replace only that slot.
- Use **Improve current** for a broader multi-card optimization pass.
- Automatically assigns Evolution, Hero/Champion, and Wild special slots after the deck is chosen.
- Uses Princess Tower as the fixed Tower Troop.
- Loads real card art from public RoyaleAPI / RoyaleAPI asset URLs with fallbacks.

## Perfect Deck model
The structural role, synergy, counter, and 3.5 average-Elixir rules are embedded in `data.js`. Personal 1–10 card ratings and the 7.8/10 minimum deck-average target are loaded from `ratings.js`; `rating-engine.js` adds them to scoring and optimization.

The priority-counter requirement is interpreted as:
- at least 5 targets covered at Incredible strength;
- at least 10 targets covered at Great-or-better strength (including the Incredible ones);
- all 32 priority targets covered at Good-or-better strength.

## Files
- `index.html` — UI shell
- `styles.css` — responsive styling
- `data.js` — card database extracted from the spreadsheet
- `engine.js` — structural rating and optimization engine
- `ratings.js` — personal 1–10 card ratings and the 7.8/10 target
- `rating-engine.js` — rating-aware scoring and optimizer layer
- `app.js` — interactive UI

## Counter audit v2
The priority matchup dataset was re-audited so every one of the 32 required target cards has incoming counter options. This pass also adds spell and building counters where they are practical answers, rather than relying mainly on troop-vs-troop relationships.

## Counter audit v2
The priority matchup dataset was re-audited so every one of the 32 required target cards has incoming counter options. This pass also adds spell and building counters where they are practical answers, rather than relying mainly on troop-vs-troop relationships.

## v3 changes
- Boss Bandit, Suspicious Bush, and P.E.K.K.A are classified as Win-Cons.
- Equal main scores now use a deterministic tie-break: more Perfect criteria completed; Incredible counters; Great+ counters; Good+ counters; structural roles in the listed Perfect Deck order; Incredible/Great+/Good+ synergies; then lower average Elixir.

## v4 changes
- Added a personal 1–10 rating for every card.
- A Perfect Deck now requires an average card rating of at least 7.8/10.
- Generate, Improve current, Best swap, and swap suggestions now account for the personal rating criterion.
