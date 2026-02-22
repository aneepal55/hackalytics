# ClutchIQ — Sports Hackalytics Decision Room

ClutchIQ is now a **single-purpose analytics product**: generate one executable game plan for a target opponent.

Instead of many unrelated charts, the app follows a strict workflow:
1) ingest opponent intelligence,
2) define team identity,
3) apply roster constraints,
4) run a strategy tournament,
5) execute the top plan.

## Why this impresses judges

- **Clear problem + audience:** built for coaching staff, performance analysts, and fantasy strategists.
- **Advanced feature mix:** predictive modeling, lineup optimization, and opponent scouting workflow.
- **Strong storytelling UI:** one dashboard that demonstrates data-to-decision flow in real time.

## Why this stands out in a data analytics hackathon

- **Decision-centric UX:** every module contributes to one final output: the chosen game plan.
- **Multi-objective optimization:** strategy score balances win probability, Monte Carlo confidence, chemistry, and risk penalty.
- **Simulation-backed planning:** each strategy archetype is evaluated with stochastic simulation.
- **Explainability-first analytics:** sensitivity analysis shows what drives probability shifts.
- **Operational realism:** lineup feasibility reacts to injuries, budget, minutes, and formation rules.

## Core product modules

1. **Opponent Intelligence Ingest**
   - Upload scouting CSV (`name, offensiveRating, defensiveRating, pace`)
   - Select target opponent model

2. **Team Identity Controls**
   - Priority mode: Upside / Balanced / Stability
   - Strategy intensity and simulation depth controls

3. **Roster Constraint Engine**
   - Formation, salary cap, minute threshold, injury availability
   - Feasible lineup generation with chemistry scoring

4. **Strategy Tournament**
   - Competes archetypes (Aggressive Tempo, Balanced Control, Defensive Grind)
   - Computes composite plan score from multiple analytics dimensions

5. **Execution Blueprint**
   - Locks selected plan with lineup, win odds, risk profile, and action recommendations

## Tech stack

- React + TypeScript + Vite
- Recharts for interactive visualizations
- PapaParse for CSV ingestion
- Custom analytics engine in TypeScript (`src/lib/analytics.ts`)

## Run locally

```bash
npm install
npm run dev
```

Then open the local Vite URL in your browser.

## Build and lint

```bash
npm run build
npm run lint
```

## Demo script (2–3 minutes)

1. Upload scouting CSV and choose opponent.
2. Set team identity + strategy intensity.
3. Add injury constraints and formation restrictions.
4. Show strategy tournament cards and explain why one plan wins.
5. Click **Execute Best Plan**.
6. Walk through the blueprint: lineup, risk, Monte Carlo distribution, explainability, and tactical actions.

## Potential next steps

- Integrate real APIs (NBA stats, betting lines, injury reports).
- Add model evaluation metrics and historical backtesting.
- Support multi-game playoff series simulation with fatigue carryover.
- Add authentication and collaborative coach notes for team workflows.
