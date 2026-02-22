import type {
  GameAnomaly,
  GameSample,
  LineupConstraints,
  LineupChemistry,
  LineupResult,
  MonteCarloSummary,
  Player,
  PlayerRadarStats,
  Recommendation,
  SensitivityImpact,
  ScenarioInputs,
  TeamCsvRow,
  TeamProfile,
} from '../types'

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const sigmoid = (value: number) => 1 / (1 + Math.exp(-value))

export const calculateNetRating = (team: TeamProfile) => team.offensiveRating - team.defensiveRating

export const estimatePlayoffOdds = (team: TeamProfile, netRating: number) => {
  const score = 1.15 * team.recentForm + 0.06 * netRating - 0.015 * Math.abs(team.pace - 100)
  return Math.round(sigmoid(score) * 100)
}

export const calculateTeamMomentum = (games: GameSample[]) => {
  const latest = games.slice(-3)
  const avgDiff = latest.reduce((sum, game) => sum + (game.pointsFor - game.pointsAgainst), 0) / latest.length
  return Number(avgDiff.toFixed(1))
}

export const buildPlayerRadar = (player: Player): PlayerRadarStats[] => {
  const score = {
    Scoring: clamp(player.points * 3.4, 0, 100),
    Playmaking: clamp(player.assists * 9.2, 0, 100),
    Rebounding: clamp(player.rebounds * 8.4, 0, 100),
    Shooting: clamp(player.fgPct * 140 + player.threePct * 60, 0, 100),
    Defense: clamp(player.steals * 25 + player.blocks * 18, 0, 100),
    Efficiency: clamp(115 - player.turnovers * 13, 0, 100),
  }

  return Object.entries(score).map(([metric, value]) => ({ metric, value: Math.round(value) }))
}

export const projectWinProbability = (team: TeamProfile, scenario: ScenarioInputs) => {
  const baseNet = calculateNetRating(team)
  const scenarioBoost = scenario.shootingDelta * 0.35 - scenario.turnoverDelta * 0.4 + scenario.paceDelta * 0.12
  const score = 0.18 * (baseNet + scenarioBoost) + 0.75 * team.recentForm
  return Math.round(clamp(sigmoid(score) * 100, 1, 99))
}

const fantasyProjection = (player: Player) => {
  return (
    player.points +
    player.rebounds * 1.2 +
    player.assists * 1.5 +
    player.steals * 3 +
    player.blocks * 3 -
    player.turnovers
  )
}

const defenseImpact = (player: Player) => player.steals * 1.7 + player.blocks * 1.9 + player.rebounds * 0.4

const countPosition = (lineup: Player[], position: Player['position']) => lineup.filter((player) => player.position === position).length

const computeLineupTotals = (lineup: Player[], salary: number) => ({
  lineup: [...lineup],
  totalSalary: salary,
  projectedPoints: Number(lineup.reduce((sum, player) => sum + fantasyProjection(player), 0).toFixed(1)),
  projectedDefenseImpact: Number(lineup.reduce((sum, player) => sum + defenseImpact(player), 0).toFixed(1)),
})

export const optimizeLineup = (pool: Player[], budget: number, slots = 5): LineupResult => {
  let best: LineupResult = {
    lineup: [],
    totalSalary: 0,
    projectedPoints: 0,
    projectedDefenseImpact: 0,
    feasibility: 'infeasible',
  }

  const backtrack = (start: number, chosen: Player[], salary: number) => {
    if (chosen.length === slots) {
      const totalPoints = chosen.reduce((sum, player) => sum + fantasyProjection(player), 0)
      const totalDefense = chosen.reduce((sum, player) => sum + defenseImpact(player), 0)
      const adjustedScore = totalPoints + totalDefense * 0.8

      if (salary <= budget && adjustedScore > best.projectedPoints + best.projectedDefenseImpact * 0.8) {
        best = {
          ...computeLineupTotals(chosen, salary),
          feasibility: 'optimal',
        }
      }
      return
    }

    for (let index = start; index < pool.length; index++) {
      const player = pool[index]
      if (salary + player.salary > budget) {
        continue
      }
      chosen.push(player)
      backtrack(index + 1, chosen, salary + player.salary)
      chosen.pop()
    }
  }

  backtrack(0, [], 0)

  return best
}

export const optimizeLineupWithConstraints = (
  pool: Player[],
  budget: number,
  constraints: LineupConstraints,
  slots = 5,
): LineupResult => {
  const availablePool = pool.filter(
    (player) => !constraints.excludedPlayerIds.includes(player.id) && player.minutes >= constraints.minMinutes,
  )

  let best: LineupResult = {
    lineup: [],
    totalSalary: 0,
    projectedPoints: 0,
    projectedDefenseImpact: 0,
    feasibility: 'infeasible',
  }

  const backtrack = (start: number, chosen: Player[], salary: number) => {
    if (chosen.length === slots) {
      const guards = countPosition(chosen, 'G')
      const forwards = countPosition(chosen, 'F')
      const centers = countPosition(chosen, 'C')

      if (guards !== constraints.guards || forwards !== constraints.forwards || centers !== constraints.centers) {
        return
      }

      const totalPoints = chosen.reduce((sum, player) => sum + fantasyProjection(player), 0)
      const totalDefense = chosen.reduce((sum, player) => sum + defenseImpact(player), 0)
      const adjustedScore = totalPoints + totalDefense * 0.8
      const bestScore = best.projectedPoints + best.projectedDefenseImpact * 0.8

      if (salary <= budget && adjustedScore > bestScore) {
        best = {
          ...computeLineupTotals(chosen, salary),
          feasibility: 'optimal',
        }
      }
      return
    }

    for (let index = start; index < availablePool.length; index++) {
      const player = availablePool[index]

      if (salary + player.salary > budget) {
        continue
      }

      const nextLineup = [...chosen, player]
      const guards = countPosition(nextLineup, 'G')
      const forwards = countPosition(nextLineup, 'F')
      const centers = countPosition(nextLineup, 'C')

      if (guards > constraints.guards || forwards > constraints.forwards || centers > constraints.centers) {
        continue
      }

      backtrack(index + 1, nextLineup, salary + player.salary)
    }
  }

  backtrack(0, [], 0)
  return best
}

const randomNormal = () => {
  let first = 0
  let second = 0
  while (first === 0) {
    first = Math.random()
  }
  while (second === 0) {
    second = Math.random()
  }
  return Math.sqrt(-2 * Math.log(first)) * Math.cos(2 * Math.PI * second)
}

export const runMonteCarloSimulation = (
  team: TeamProfile,
  scenario: ScenarioInputs,
  opponentNetRating: number,
  iterations: number,
): MonteCarloSummary => {
  const runs = clamp(Math.round(iterations), 200, 10000)
  const baseNet = calculateNetRating(team)
  const scenarioEdge = scenario.shootingDelta * 0.38 - scenario.turnoverDelta * 0.44 + scenario.paceDelta * 0.14
  const adjustedEdge = baseNet + scenarioEdge - opponentNetRating * 0.75

  const margins: number[] = []
  let wins = 0

  for (let index = 0; index < runs; index++) {
    const variance = randomNormal() * 8.4
    const margin = adjustedEdge + variance
    margins.push(margin)
    if (margin > 0) {
      wins += 1
    }
  }

  margins.sort((left, right) => left - right)

  const averageMargin = margins.reduce((sum, margin) => sum + margin, 0) / margins.length
  const floorMargin = margins[Math.floor(margins.length * 0.1)]
  const ceilingMargin = margins[Math.floor(margins.length * 0.9)]

  const bins = [
    { label: '< -10', min: Number.NEGATIVE_INFINITY, max: -10 },
    { label: '-10 to -5', min: -10, max: -5 },
    { label: '-5 to 0', min: -5, max: 0 },
    { label: '0 to +5', min: 0, max: 5 },
    { label: '+5 to +10', min: 5, max: 10 },
    { label: '> +10', min: 10, max: Number.POSITIVE_INFINITY },
  ]

  const distribution = bins.map((bin) => ({
    range: bin.label,
    frequency: margins.filter((margin) => margin > bin.min && margin <= bin.max).length,
  }))

  return {
    winRate: Number(((wins / runs) * 100).toFixed(1)),
    averageMargin: Number(averageMargin.toFixed(2)),
    floorMargin: Number(floorMargin.toFixed(2)),
    ceilingMargin: Number(ceilingMargin.toFixed(2)),
    distribution,
  }
}

export const generateRecommendations = (
  team: TeamProfile,
  scenario: ScenarioInputs,
  opponentNetRating: number,
): Recommendation[] => {
  const recommendations: Recommendation[] = []

  const paceImpact = Math.abs(scenario.paceDelta) * 1.6
  if (scenario.paceDelta > 2) {
    recommendations.push({
      title: 'Push transition volume',
      detail: 'Increase early-clock actions and rim pressure to leverage tempo edge.',
      impact: Number((paceImpact + 4).toFixed(1)),
    })
  }

  if (scenario.turnoverDelta > 1) {
    recommendations.push({
      title: 'Prioritize low-risk sets',
      detail: 'Run more two-man actions and reduce cross-court passing against pressure.',
      impact: Number((scenario.turnoverDelta * 2.5 + 2).toFixed(1)),
    })
  }

  if (scenario.shootingDelta < 0) {
    recommendations.push({
      title: 'Shift shot profile inward',
      detail: 'Compensate for cold perimeter shooting with paint touches and cut actions.',
      impact: Number((Math.abs(scenario.shootingDelta) * 2.1 + 1.5).toFixed(1)),
    })
  }

  if (calculateNetRating(team) < opponentNetRating) {
    recommendations.push({
      title: 'Defensive rebounding emphasis',
      detail: 'Limit opponent second-chance points by tagging crashers and securing long rebounds.',
      impact: 6.8,
    })
  }

  if (recommendations.length === 0) {
    recommendations.push({
      title: 'Maintain current game model',
      detail: 'Current setup is balanced. Prioritize execution consistency and rotation discipline.',
      impact: 4.5,
    })
  }

  return recommendations.sort((left, right) => right.impact - left.impact)
}

const applyOpponentPenalty = (probability: number, opponentNetRating: number) => {
  const penalty = opponentNetRating * 0.7
  return clamp(probability - penalty, 1, 99)
}

export const calculateScenarioSensitivity = (
  team: TeamProfile,
  scenario: ScenarioInputs,
  opponentNetRating: number,
): SensitivityImpact[] => {
  const baseline = applyOpponentPenalty(projectWinProbability(team, scenario), opponentNetRating)
  const step = 2

  const paceShifted = applyOpponentPenalty(
    projectWinProbability(team, { ...scenario, paceDelta: scenario.paceDelta + step }),
    opponentNetRating,
  )
  const shootingShifted = applyOpponentPenalty(
    projectWinProbability(team, { ...scenario, shootingDelta: scenario.shootingDelta + step }),
    opponentNetRating,
  )
  const turnoverShifted = applyOpponentPenalty(
    projectWinProbability(team, { ...scenario, turnoverDelta: scenario.turnoverDelta + step }),
    opponentNetRating,
  )

  return [
    { factor: 'Pace', deltaWinProbability: Number((paceShifted - baseline).toFixed(2)) },
    { factor: 'Shooting', deltaWinProbability: Number((shootingShifted - baseline).toFixed(2)) },
    { factor: 'Turnovers', deltaWinProbability: Number((turnoverShifted - baseline).toFixed(2)) },
  ].sort((left, right) => Math.abs(right.deltaWinProbability) - Math.abs(left.deltaWinProbability))
}

export const evaluateLineupChemistry = (lineup: Player[]): LineupChemistry => {
  if (lineup.length === 0) {
    return {
      ballMovement: 0,
      spacing: 0,
      defenseSwitchability: 0,
      overall: 0,
    }
  }

  const averageAssists = lineup.reduce((sum, player) => sum + player.assists, 0) / lineup.length
  const averageThreePct = lineup.reduce((sum, player) => sum + player.threePct, 0) / lineup.length
  const wingspanProxy = lineup.reduce((sum, player) => sum + player.steals + player.blocks, 0) / lineup.length

  const ballMovement = clamp(averageAssists * 12.5, 0, 100)
  const spacing = clamp(averageThreePct * 230, 0, 100)
  const defenseSwitchability = clamp(wingspanProxy * 30, 0, 100)
  const overall = Number((ballMovement * 0.35 + spacing * 0.3 + defenseSwitchability * 0.35).toFixed(1))

  return {
    ballMovement: Number(ballMovement.toFixed(1)),
    spacing: Number(spacing.toFixed(1)),
    defenseSwitchability: Number(defenseSwitchability.toFixed(1)),
    overall,
  }
}

export const detectGameAnomalies = (games: GameSample[]): GameAnomaly[] => {
  if (games.length === 0) {
    return []
  }

  const differences = games.map((game) => game.pointsFor - game.pointsAgainst)
  const mean = differences.reduce((sum, value) => sum + value, 0) / differences.length
  const variance = differences.reduce((sum, value) => sum + (value - mean) ** 2, 0) / differences.length
  const stdDev = Math.sqrt(variance) || 1

  return games
    .map((game) => {
      const diff = game.pointsFor - game.pointsAgainst
      const zScore = (diff - mean) / stdDev
      const anomalyScore = Math.abs(zScore) * 100
      let label = 'Normal'

      if (zScore >= 1.2) {
        label = 'Positive Outlier'
      } else if (zScore <= -1.2) {
        label = 'Negative Outlier'
      }

      return {
        game: game.game,
        opponent: game.opponent,
        anomalyScore: Number(anomalyScore.toFixed(1)),
        label,
      }
    })
    .sort((left, right) => right.anomalyScore - left.anomalyScore)
    .slice(0, 4)
}

export const parseTeamCsv = (text: string): TeamCsvRow[] => {
  const lines = text.split(/\r?\n/).filter(Boolean)
  if (lines.length <= 1) {
    return []
  }

  const [, ...rows] = lines

  return rows
    .map((row) => row.split(','))
    .filter((cells) => cells.length >= 4)
    .map((cells) => ({
      name: cells[0].trim(),
      offensiveRating: Number(cells[1]),
      defensiveRating: Number(cells[2]),
      pace: Number(cells[3]),
    }))
    .filter((row) => !Number.isNaN(row.offensiveRating) && !Number.isNaN(row.defensiveRating) && !Number.isNaN(row.pace))
}

export const rankTeamsByContenderScore = (teams: TeamCsvRow[]) => {
  return teams
    .map((team) => {
      const net = team.offensiveRating - team.defensiveRating
      const tempoPenalty = Math.abs(team.pace - 100) * 0.15
      const contenderScore = net * 3.2 - tempoPenalty
      return { ...team, net, contenderScore: Number(contenderScore.toFixed(2)) }
    })
    .sort((left, right) => right.contenderScore - left.contenderScore)
}
