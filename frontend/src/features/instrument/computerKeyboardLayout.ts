const computerKeyboardBindings = [
  ['KeyA', 60, 'A'],
  ['KeyW', 61, 'W'],
  ['KeyS', 62, 'S'],
  ['KeyE', 63, 'E'],
  ['KeyD', 64, 'D'],
  ['KeyF', 65, 'F'],
  ['KeyT', 66, 'T'],
  ['KeyG', 67, 'G'],
  ['KeyY', 68, 'Y'],
  ['KeyH', 69, 'H'],
  ['KeyU', 70, 'U'],
  ['KeyJ', 71, 'J'],
  ['KeyK', 72, 'K'],
  ['KeyO', 73, 'O'],
  ['KeyL', 74, 'L'],
  ['KeyP', 75, 'P'],
  ['Semicolon', 76, ';'],
  ['Quote', 77, "'"],
] as const

export const computerKeyboardPitchByCode: ReadonlyMap<string, number> = new Map(
  computerKeyboardBindings.map(([code, pitch]) => [code, pitch]),
)

export const computerKeyboardLabelByPitch: ReadonlyMap<number, string> = new Map(
  computerKeyboardBindings.map(([, pitch, label]) => [pitch, label]),
)
