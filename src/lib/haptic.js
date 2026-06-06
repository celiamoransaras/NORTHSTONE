const PATTERNS = {
  light:   [8],
  medium:  [25],
  success: [8, 50, 8],
  error:   [40, 30, 40],
  tap:     [6],
}

export const haptic = (type = 'light') => {
  if ('vibrate' in navigator) navigator.vibrate(PATTERNS[type] || PATTERNS.light)
}
