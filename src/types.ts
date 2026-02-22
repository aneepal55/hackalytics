export type Player = {
  id: string
  name: string
  position: 'G' | 'F' | 'C'
  team: string
  salary: number
  minutes: number
  points: number
  assists: number
  rebounds: number
  steals: number
  blocks: number
  turnovers: number
  fgPct: number
  threePct: number
  usage: number
}

export type GameSample = {
  game: string
  opponent: string
  pointsFor: number
  pointsAgainst: number
  pace: number
  efg: number
  turnovers: number
  rebounding: number
}

export type TeamProfile = {
  name: string
  conference: string
  offensiveRating: number
  defensiveRating: number
  pace: number
  recentForm: number
}

export type PlayerRadarStats = {
  metric: string
  value: number
}

export type ScenarioInputs = {
  paceDelta: number
  shootingDelta: number
  turnoverDelta: number
}

export type TeamCsvRow = {
  name: string
  offensiveRating: number
  defensiveRating: number
  pace: number
}

export type LineupConstraints = {
  guards: number
  forwards: number
  centers: number
  minMinutes: number
  excludedPlayerIds: string[]
}

export type LineupResult = {
  lineup: Player[]
  totalSalary: number
  projectedPoints: number
  projectedDefenseImpact: number
  feasibility: 'optimal' | 'infeasible'
}

export type SimulationBin = {
  range: string
  frequency: number
}

export type MonteCarloSummary = {
  winRate: number
  averageMargin: number
  floorMargin: number
  ceilingMargin: number
  distribution: SimulationBin[]
}

export type Recommendation = {
  title: string
  detail: string
  impact: number
}

export type SensitivityImpact = {
  factor: string
  deltaWinProbability: number
}

export type LineupChemistry = {
  ballMovement: number
  spacing: number
  defenseSwitchability: number
  overall: number
}

export type GameAnomaly = {
  game: string
  opponent: string
  anomalyScore: number
  label: string
}
