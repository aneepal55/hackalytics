import { useMemo, useState } from 'react'
import Papa from 'papaparse'
import type { ParseResult } from 'papaparse'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { gameLog, players, teamProfile } from './data/mockData'
import {
  buildPlayerRadar,
  calculateNetRating,
  calculateScenarioSensitivity,
  calculateTeamMomentum,
  detectGameAnomalies,
  evaluateLineupChemistry,
  generateRecommendations,
  optimizeLineupWithConstraints,
  projectWinProbability,
  rankTeamsByContenderScore,
  runMonteCarloSimulation,
} from './lib/analytics'
import type { TeamCsvRow } from './types'
import './App.css'

const formationMap = {
  balanced: { guards: 2, forwards: 2, centers: 1, label: 'Balanced' },
  guardHeavy: { guards: 3, forwards: 1, centers: 1, label: 'Guard Heavy' },
  wingHeavy: { guards: 1, forwards: 3, centers: 1, label: 'Wing Heavy' },
} as const

const strategyArchetypes = [
  { id: 'aggressive', label: 'Aggressive Tempo', pace: 6, shooting: 4, turnover: 3, risk: 0.72 },
  { id: 'balanced', label: 'Balanced Control', pace: 2, shooting: 2, turnover: 0, risk: 0.45 },
  { id: 'defensive', label: 'Defensive Grind', pace: -3, shooting: 1, turnover: -2, risk: 0.31 },
] as const

type FormationKey = keyof typeof formationMap
type PriorityMode = 'upside' | 'balanced' | 'stability'
type ViewMode = 'setup' | 'strategy' | 'results'

type PlanSnapshot = {
  id: string
  label: string
  score: number
  winProbability: number
  monteWinRate: number
  expectedMargin: number
  riskIndex: number
  paceDelta: number
  shootingDelta: number
  turnoverDelta: number
  lineup: { id: string; name: string; position: string; salary: number }[]
  recommendations: { title: string; detail: string; impact: number }[]
  lockedAt: string
}

function App() {
  const [viewMode, setViewMode] = useState<ViewMode>('setup')
  const [formation, setFormation] = useState<FormationKey>('balanced')
  const [priorityMode, setPriorityMode] = useState<PriorityMode>('balanced')
  const [strategyIntensity, setStrategyIntensity] = useState(6)
  const [budget, setBudget] = useState(36000)
  const [minimumMinutes, setMinimumMinutes] = useState(22)
  const [simulationRuns, setSimulationRuns] = useState(2500)
  const [injuredPlayerIds, setInjuredPlayerIds] = useState<string[]>([])
  const [selectedOpponent, setSelectedOpponent] = useState('league-average')
  const [uploadedTeams, setUploadedTeams] = useState<TeamCsvRow[]>([])
  const [uploadError, setUploadError] = useState('')
  const [selectedPlayerId, setSelectedPlayerId] = useState(players[0].id)
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null)
  const [lockedPlan, setLockedPlan] = useState<PlanSnapshot | null>(null)

  const netRating = useMemo(() => calculateNetRating(teamProfile), [])
  const momentum = useMemo(() => calculateTeamMomentum(gameLog), [])
  const anomalyFeed = useMemo(() => detectGameAnomalies(gameLog), [])

  const contenderBoard = useMemo(() => rankTeamsByContenderScore(uploadedTeams).slice(0, 8), [uploadedTeams])

  const opponentNetRating = useMemo(() => {
    if (selectedOpponent === 'league-average') {
      return 0
    }

    const team = contenderBoard.find((entry) => entry.name === selectedOpponent)
    return team?.net ?? 0
  }, [contenderBoard, selectedOpponent])

  const activeFormation = formationMap[formation]
  const constraints = useMemo(
    () => ({
      guards: activeFormation.guards,
      forwards: activeFormation.forwards,
      centers: activeFormation.centers,
      minMinutes: minimumMinutes,
      excludedPlayerIds: injuredPlayerIds,
    }),
    [activeFormation.centers, activeFormation.forwards, activeFormation.guards, injuredPlayerIds, minimumMinutes],
  )

  const weightConfig = useMemo(() => {
    if (priorityMode === 'upside') {
      return { win: 0.52, monte: 0.28, chemistry: 0.1, riskPenalty: 0.14 }
    }

    if (priorityMode === 'stability') {
      return { win: 0.38, monte: 0.24, chemistry: 0.24, riskPenalty: 0.08 }
    }

    return { win: 0.45, monte: 0.25, chemistry: 0.18, riskPenalty: 0.11 }
  }, [priorityMode])

  const strategyCandidates = useMemo(() => {
    return strategyArchetypes.map((archetype) => {
      const scale = strategyIntensity / 6
      const scenario = {
        paceDelta: Math.round(archetype.pace * scale),
        shootingDelta: Math.round(archetype.shooting * scale),
        turnoverDelta: Math.round(archetype.turnover * scale),
      }

      const lineup = optimizeLineupWithConstraints(players, budget, constraints)
      const chemistry = evaluateLineupChemistry(lineup.lineup)
      const winProbability = Math.max(1, Math.min(99, projectWinProbability(teamProfile, scenario) - opponentNetRating * 0.7))
      const monte = runMonteCarloSimulation(teamProfile, scenario, opponentNetRating, simulationRuns)
      const riskIndex = Math.max(
        1,
        Math.min(100, archetype.risk * 100 + Math.abs(scenario.turnoverDelta) * 4 + (100 - chemistry.overall) * 0.12),
      )

      const feasibilityPenalty = lineup.feasibility === 'optimal' ? 0 : 30
      const score =
        weightConfig.win * winProbability +
        weightConfig.monte * monte.winRate +
        weightConfig.chemistry * chemistry.overall -
        weightConfig.riskPenalty * riskIndex -
        feasibilityPenalty

      return {
        id: archetype.id,
        label: archetype.label,
        scenario,
        lineup,
        chemistry,
        winProbability: Number(winProbability.toFixed(1)),
        monteWinRate: monte.winRate,
        expectedMargin: monte.averageMargin,
        riskIndex: Number(riskIndex.toFixed(1)),
        score: Number(score.toFixed(2)),
        distribution: monte.distribution,
      }
    })
  }, [budget, constraints, opponentNetRating, simulationRuns, strategyIntensity, weightConfig])

  const bestCandidate = useMemo(
    () => [...strategyCandidates].sort((left, right) => right.score - left.score)[0],
    [strategyCandidates],
  )

  const activeCandidateId =
    selectedCandidateId && strategyCandidates.some((candidate) => candidate.id === selectedCandidateId)
      ? selectedCandidateId
      : bestCandidate.id

  const activePlan = strategyCandidates.find((candidate) => candidate.id === activeCandidateId) ?? bestCandidate

  const sensitivity = useMemo(
    () => calculateScenarioSensitivity(teamProfile, activePlan.scenario, opponentNetRating),
    [activePlan.scenario, opponentNetRating],
  )

  const recommendations = useMemo(
    () => generateRecommendations(teamProfile, activePlan.scenario, opponentNetRating),
    [activePlan.scenario, opponentNetRating],
  )

  const selectedPlayer = useMemo(
    () => players.find((player) => player.id === selectedPlayerId) ?? activePlan.lineup.lineup[0] ?? players[0],
    [activePlan.lineup.lineup, selectedPlayerId],
  )
  const radarData = useMemo(() => buildPlayerRadar(selectedPlayer), [selectedPlayer])

  const executePlan = () => {
    const snapshot: PlanSnapshot = {
      id: activePlan.id,
      label: activePlan.label,
      score: activePlan.score,
      winProbability: activePlan.winProbability,
      monteWinRate: activePlan.monteWinRate,
      expectedMargin: activePlan.expectedMargin,
      riskIndex: activePlan.riskIndex,
      paceDelta: activePlan.scenario.paceDelta,
      shootingDelta: activePlan.scenario.shootingDelta,
      turnoverDelta: activePlan.scenario.turnoverDelta,
      lineup: activePlan.lineup.lineup.map((player) => ({
        id: player.id,
        name: player.name,
        position: player.position,
        salary: player.salary,
      })),
      recommendations: recommendations.slice(0, 3),
      lockedAt: new Date().toLocaleTimeString(),
    }

    setLockedPlan(snapshot)
    setViewMode('results')
  }

  const handleCsvUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    setUploadError('')

    Papa.parse<TeamCsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result: ParseResult<TeamCsvRow>) => {
        const validRows = result.data
          .map((row: TeamCsvRow) => ({
            name: String(row.name ?? '').trim(),
            offensiveRating: Number(row.offensiveRating),
            defensiveRating: Number(row.defensiveRating),
            pace: Number(row.pace),
          }))
          .filter(
            (row: TeamCsvRow) =>
              row.name.length > 0 &&
              !Number.isNaN(row.offensiveRating) &&
              !Number.isNaN(row.defensiveRating) &&
              !Number.isNaN(row.pace),
          )

        if (validRows.length === 0) {
          setUploadedTeams([])
          setUploadError('No valid rows found. Expected columns: name, offensiveRating, defensiveRating, pace')
          return
        }

        setUploadedTeams(validRows)
      },
      error: () => {
        setUploadError('Could not parse this CSV file. Please try again.')
      },
    })
  }

  const toggleInjury = (playerId: string) => {
    setInjuredPlayerIds((current) =>
      current.includes(playerId) ? current.filter((id) => id !== playerId) : [...current, playerId],
    )
  }

  const formatSigned = (value: number) => (value > 0 ? `+${value}` : `${value}`)

  return (
    <div className="decision-shell">
      <header className="story-hero">
        <p className="story-badge">Sports Hackalytics</p>
        <h1>Decision Room</h1>
        <p>
          Clear workflow: choose opponent, set constraints, compare plans, execute one final strategy.
        </p>
        <nav className="view-nav" aria-label="Views">
          <button className={viewMode === 'setup' ? 'active' : ''} type="button" onClick={() => setViewMode('setup')}>
            1) Setup
          </button>
          <button
            className={viewMode === 'strategy' ? 'active' : ''}
            type="button"
            onClick={() => setViewMode('strategy')}
          >
            2) Strategy
          </button>
          <button
            className={viewMode === 'results' ? 'active' : ''}
            type="button"
            onClick={() => setViewMode('results')}
          >
            3) Results
          </button>
        </nav>
      </header>

      <section className="status-row">
        <article>
          <span>Net Rating</span>
          <strong>{netRating.toFixed(1)}</strong>
        </article>
        <article>
          <span>Momentum</span>
          <strong>{formatSigned(momentum)}</strong>
        </article>
        <article>
          <span>Best Candidate</span>
          <strong>{bestCandidate.label}</strong>
        </article>
        <article>
          <span>Locked Plan</span>
          <strong>{lockedPlan?.label ?? 'None'}</strong>
        </article>
      </section>

      {viewMode === 'setup' && (
        <section className="setup-grid">
          <article className="card">
            <h2>1. Opponent Intelligence</h2>
            <label htmlFor="opponent-select">Target Opponent</label>
            <select id="opponent-select" value={selectedOpponent} onChange={(event) => setSelectedOpponent(event.target.value)}>
              <option value="league-average">League Average (Net 0.0)</option>
              {contenderBoard.map((team) => (
                <option key={team.name} value={team.name}>
                  {team.name} (Net {team.net.toFixed(1)})
                </option>
              ))}
            </select>
            <label htmlFor="csv-upload">Upload Scout CSV</label>
            <input id="csv-upload" type="file" accept=".csv" onChange={handleCsvUpload} />
            <p className="muted">Current opponent net: {opponentNetRating.toFixed(1)}</p>
            {uploadError && <p className="error-text">{uploadError}</p>}
          </article>

          <article className="card">
            <h2>2. Identity + Risk Preferences</h2>
            <label htmlFor="priority-mode">Decision Priority</label>
            <select
              id="priority-mode"
              value={priorityMode}
              onChange={(event) => setPriorityMode(event.target.value as PriorityMode)}
            >
              <option value="upside">Maximize Upside</option>
              <option value="balanced">Balanced</option>
              <option value="stability">Minimize Risk</option>
            </select>

            <label htmlFor="intensity">Strategy Intensity ({strategyIntensity}/10)</label>
            <input
              id="intensity"
              type="range"
              min={1}
              max={10}
              step={1}
              value={strategyIntensity}
              onChange={(event) => setStrategyIntensity(Number(event.target.value))}
            />

            <label htmlFor="sim-runs">Simulation Runs ({simulationRuns})</label>
            <input
              id="sim-runs"
              type="range"
              min={1000}
              max={6000}
              step={500}
              value={simulationRuns}
              onChange={(event) => setSimulationRuns(Number(event.target.value))}
            />
          </article>

          <article className="card">
            <h2>3. Roster Constraints</h2>
            <label htmlFor="formation">Formation</label>
            <select id="formation" value={formation} onChange={(event) => setFormation(event.target.value as FormationKey)}>
              {Object.entries(formationMap).map(([key, value]) => (
                <option key={key} value={key}>
                  {value.label}
                </option>
              ))}
            </select>

            <label htmlFor="budget">Budget (${budget.toLocaleString()})</label>
            <input
              id="budget"
              type="range"
              min={25000}
              max={45000}
              step={500}
              value={budget}
              onChange={(event) => setBudget(Number(event.target.value))}
            />

            <label htmlFor="min-minutes">Minimum Minutes ({minimumMinutes})</label>
            <input
              id="min-minutes"
              type="range"
              min={16}
              max={36}
              step={1}
              value={minimumMinutes}
              onChange={(event) => setMinimumMinutes(Number(event.target.value))}
            />

            <p className="muted">Injury / unavailable players</p>
            <div className="injury-wrap">
              {players.map((player) => (
                <label key={player.id} className="injury-item">
                  <input
                    type="checkbox"
                    checked={injuredPlayerIds.includes(player.id)}
                    onChange={() => toggleInjury(player.id)}
                  />
                  {player.name}
                </label>
              ))}
            </div>
          </article>

          <article className="card execute-card">
            <h2>4. Run Decision Engine</h2>
            <p className="muted">Compare all strategy archetypes and pick one plan to execute.</p>
            <button type="button" onClick={() => setViewMode('strategy')}>
              Continue to Strategy Evaluation
            </button>
          </article>
        </section>
      )}

      {viewMode === 'strategy' && (
        <>
          <section className="candidate-grid">
            {strategyCandidates.map((candidate) => (
              <article key={candidate.id} className={`candidate-card ${candidate.id === activeCandidateId ? 'selected' : ''}`}>
                <h3>{candidate.label}</h3>
                <p>
                  Pace {formatSigned(candidate.scenario.paceDelta)} · Shooting {formatSigned(candidate.scenario.shootingDelta)} · TO{' '}
                  {formatSigned(candidate.scenario.turnoverDelta)}
                </p>
                <div className="candidate-metrics">
                  <span>Score {candidate.score}</span>
                  <span>Win {candidate.winProbability}%</span>
                  <span>MC {candidate.monteWinRate}%</span>
                  <span>Risk {candidate.riskIndex}</span>
                </div>
                <button type="button" onClick={() => setSelectedCandidateId(candidate.id)}>
                  Select Plan
                </button>
              </article>
            ))}
          </section>

          <section className="chart-grid">
            <article className="card chart-card">
              <h2>Plan Risk Distribution</h2>
              <div className="chart-box">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={activePlan.distribution}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#d4deee" />
                    <XAxis dataKey="range" stroke="#6b7d97" />
                    <YAxis stroke="#6b7d97" />
                    <Tooltip />
                    <Bar dataKey="frequency" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </article>

            <article className="card chart-card">
              <h2>Explainability (Sensitivity)</h2>
              <div className="chart-box">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={sensitivity}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#d4deee" />
                    <XAxis dataKey="factor" stroke="#6b7d97" />
                    <YAxis stroke="#6b7d97" />
                    <Tooltip />
                    <Bar dataKey="deltaWinProbability" fill="#06b6d4" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </article>

            <article className="card chart-card">
              <h2>Recent Momentum</h2>
              <div className="chart-box">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={gameLog}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#d4deee" />
                    <XAxis dataKey="game" stroke="#6b7d97" />
                    <YAxis stroke="#6b7d97" />
                    <Tooltip />
                    <Area type="monotone" dataKey="pointsFor" stroke="#0ea5e9" fill="#0ea5e933" />
                    <Area type="monotone" dataKey="pointsAgainst" stroke="#f43f5e" fill="#f43f5e33" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </article>
          </section>

          <section className="card finalize-card">
            <div>
              <h2>Selected Plan: {activePlan.label}</h2>
              <p>
                Score {activePlan.score} · Win {activePlan.winProbability}% · Monte Carlo {activePlan.monteWinRate}% · Expected Margin{' '}
                {activePlan.expectedMargin}
              </p>
            </div>
            <button type="button" onClick={executePlan}>
              Execute This Plan
            </button>
          </section>
        </>
      )}

      {viewMode === 'results' && (
        <>
          {!lockedPlan && (
            <section className="card">
              <h2>No executed plan yet</h2>
              <p>Go to Strategy and click Execute This Plan to generate the final blueprint.</p>
            </section>
          )}

          {lockedPlan && (
            <>
              <section className="results-grid">
                <article className="card">
                  <h2>Final Blueprint</h2>
                  <div className="blueprint-metrics">
                    <p>
                      Plan Score <strong>{lockedPlan.score}</strong>
                    </p>
                    <p>
                      Win Probability <strong>{lockedPlan.winProbability}%</strong>
                    </p>
                    <p>
                      Monte Carlo Win <strong>{lockedPlan.monteWinRate}%</strong>
                    </p>
                    <p>
                      Risk Index <strong>{lockedPlan.riskIndex}</strong>
                    </p>
                  </div>
                  <ul className="lineup-list">
                    {lockedPlan.lineup.map((player) => (
                      <li key={player.id}>
                        <span>
                          {player.name} • {player.position}
                        </span>
                        <strong>${player.salary.toLocaleString()}</strong>
                      </li>
                    ))}
                  </ul>
                </article>

                <article className="card">
                  <h2>Tactical Actions</h2>
                  <ul className="recommend-list">
                    {lockedPlan.recommendations.map((item) => (
                      <li key={item.title}>
                        <div>
                          <h4>{item.title}</h4>
                          <p>{item.detail}</p>
                        </div>
                        <strong>{item.impact}</strong>
                      </li>
                    ))}
                  </ul>
                </article>
              </section>

              <section className="results-grid">
                <article className="card chart-card">
                  <div className="result-head">
                    <h2>Lineup Player Radar</h2>
                    <select value={selectedPlayerId} onChange={(event) => setSelectedPlayerId(event.target.value)}>
                      {players.map((player) => (
                        <option key={player.id} value={player.id}>
                          {player.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="chart-box">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart data={radarData}>
                        <PolarGrid stroke="#d4deee" />
                        <PolarAngleAxis dataKey="metric" stroke="#6b7d97" />
                        <Radar dataKey="value" stroke="#7c3aed" fill="#7c3aed" fillOpacity={0.35} />
                        <Tooltip />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                </article>

                <article className="card">
                  <h2>Anomaly Watch</h2>
                  <ul className="anomaly-list">
                    {anomalyFeed.map((item) => (
                      <li key={item.game}>
                        <div>
                          <strong>
                            {item.game} vs {item.opponent}
                          </strong>
                          <p>{item.label}</p>
                        </div>
                        <em>{item.anomalyScore}</em>
                      </li>
                    ))}
                  </ul>
                </article>
              </section>
            </>
          )}
        </>
      )}
    </div>
  )
}

export default App
