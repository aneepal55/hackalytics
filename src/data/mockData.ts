import type { GameSample, Player, TeamProfile } from '../types'

export const teamProfile: TeamProfile = {
  name: 'Hackalytics United',
  conference: 'Future League East',
  offensiveRating: 118.6,
  defensiveRating: 109.8,
  pace: 101.2,
  recentForm: 0.72,
}

export const gameLog: GameSample[] = [
  { game: 'G1', opponent: 'Phoenix', pointsFor: 118, pointsAgainst: 112, pace: 102.4, efg: 0.57, turnovers: 12, rebounding: 51 },
  { game: 'G2', opponent: 'Dallas', pointsFor: 110, pointsAgainst: 115, pace: 99.8, efg: 0.53, turnovers: 15, rebounding: 47 },
  { game: 'G3', opponent: 'Boston', pointsFor: 124, pointsAgainst: 117, pace: 103.6, efg: 0.6, turnovers: 11, rebounding: 52 },
  { game: 'G4', opponent: 'Miami', pointsFor: 113, pointsAgainst: 108, pace: 100.1, efg: 0.55, turnovers: 13, rebounding: 49 },
  { game: 'G5', opponent: 'Denver', pointsFor: 119, pointsAgainst: 120, pace: 101.7, efg: 0.58, turnovers: 14, rebounding: 46 },
  { game: 'G6', opponent: 'Milwaukee', pointsFor: 128, pointsAgainst: 116, pace: 104.2, efg: 0.62, turnovers: 10, rebounding: 55 },
]

export const players: Player[] = [
  { id: 'p1', name: 'Jaden Brooks', position: 'G', team: 'HU', salary: 9200, minutes: 35, points: 27.1, assists: 8.4, rebounds: 5.2, steals: 1.9, blocks: 0.4, turnovers: 3.1, fgPct: 0.51, threePct: 0.41, usage: 30.5 },
  { id: 'p2', name: 'Marco Ilyas', position: 'G', team: 'HU', salary: 7700, minutes: 33, points: 19.3, assists: 6.1, rebounds: 4.8, steals: 1.6, blocks: 0.2, turnovers: 2.4, fgPct: 0.47, threePct: 0.39, usage: 24.2 },
  { id: 'p3', name: 'Nico Rivers', position: 'F', team: 'HU', salary: 8400, minutes: 34, points: 22.5, assists: 3.7, rebounds: 9.8, steals: 1.3, blocks: 1.0, turnovers: 2.7, fgPct: 0.54, threePct: 0.36, usage: 26.1 },
  { id: 'p4', name: 'Elijah Stone', position: 'F', team: 'HU', salary: 6400, minutes: 30, points: 15.6, assists: 2.9, rebounds: 7.2, steals: 1.1, blocks: 0.9, turnovers: 1.9, fgPct: 0.49, threePct: 0.34, usage: 20.7 },
  { id: 'p5', name: 'Darius Cole', position: 'C', team: 'HU', salary: 8100, minutes: 31, points: 18.4, assists: 2.1, rebounds: 11.5, steals: 0.8, blocks: 2.0, turnovers: 2.2, fgPct: 0.59, threePct: 0.21, usage: 23.4 },
  { id: 'p6', name: 'Theo Vale', position: 'G', team: 'HU', salary: 5300, minutes: 24, points: 11.2, assists: 4.2, rebounds: 3.1, steals: 1.0, blocks: 0.2, turnovers: 1.5, fgPct: 0.45, threePct: 0.37, usage: 17.8 },
  { id: 'p7', name: 'Kian Murphy', position: 'F', team: 'HU', salary: 5900, minutes: 27, points: 13.8, assists: 2.5, rebounds: 6.9, steals: 0.9, blocks: 0.7, turnovers: 1.6, fgPct: 0.5, threePct: 0.35, usage: 19.4 },
  { id: 'p8', name: 'Owen Hart', position: 'C', team: 'HU', salary: 4800, minutes: 20, points: 9.4, assists: 1.1, rebounds: 7.3, steals: 0.5, blocks: 1.4, turnovers: 1.3, fgPct: 0.57, threePct: 0.12, usage: 14.9 },
]
