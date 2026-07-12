import type { PracticeMode, ScoreNote } from '../../shared/types/domain'

export type PracticeTargetGroup = {
  beat: number
  pitches: Set<number>
}

export class PracticeEngine {
  private groups: PracticeTargetGroup[] = []
  private nextGroupIndex = 0
  private waitingPitches: Set<number> | null = null

  configure(notes: ScoreNote[], mode: PracticeMode) {
    this.groups = buildTargetGroups(selectUserNotes(notes, mode))
    this.reset(0)
  }

  reset(beat: number) {
    this.nextGroupIndex = lowerBoundGroup(this.groups, beat)
    this.waitingPitches = null
  }

  advance(proposedBeat: number) {
    const target = this.groups[this.nextGroupIndex]
    if (!target) return { beat: proposedBeat, target: null }
    if (this.waitingPitches) return { beat: target.beat, target }
    if (proposedBeat < target.beat) return { beat: proposedBeat, target: null }
    this.waitingPitches = new Set(target.pitches)
    return { beat: target.beat, target }
  }

  receiveNoteOn(pitch: number) {
    if (!this.waitingPitches?.delete(pitch)) return false
    if (this.waitingPitches.size > 0) return false
    this.waitingPitches = null
    this.nextGroupIndex += 1
    return true
  }
}

export function selectAutoPlayNotes(notes: ScoreNote[], mode: PracticeMode) {
  if (mode === 'listen') return notes
  if (mode === 'right-hand') return notes.filter((note) => note.hand === 'left')
  if (mode === 'left-hand') return notes.filter((note) => note.hand === 'right')
  return []
}

function selectUserNotes(notes: ScoreNote[], mode: PracticeMode) {
  if (mode === 'right-hand') return notes.filter((note) => note.hand === 'right')
  if (mode === 'left-hand') return notes.filter((note) => note.hand === 'left')
  if (mode === 'both-hands') return notes
  return []
}

function buildTargetGroups(targets: ScoreNote[]) {
  const groups: PracticeTargetGroup[] = []
  for (const note of targets.toSorted((a, b) => a.startBeat - b.startBeat)) {
    const previous = groups.at(-1)
    if (!previous || note.startBeat - previous.beat > 0.08) {
      groups.push({ beat: note.startBeat, pitches: new Set([note.pitch]) })
    } else {
      previous.pitches.add(note.pitch)
    }
  }
  return groups
}

function lowerBoundGroup(groups: PracticeTargetGroup[], targetBeat: number) {
  let low = 0
  let high = groups.length
  while (low < high) {
    const middle = low + Math.floor((high - low) / 2)
    if (groups[middle].beat < targetBeat) low = middle + 1
    else high = middle
  }
  return low
}
