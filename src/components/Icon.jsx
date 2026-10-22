// Iconos de línea propios (mismo estilo en todos los móviles, sin depender de los emojis del sistema)
const P = {
  home: <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8" /><path d="M18 14.2a6.5 6.5 0 0 1 3.5 5.8" /></>,
  calendar: <><rect x="3" y="4.5" width="18" height="16.5" rx="2.5" /><path d="M8 2.5v4M16 2.5v4M3 9.5h18" /></>,
  chat: <path d="M21 11.5a8.5 8.5 0 0 1-12.4 7.6L3.5 20.5l1.4-4.4A8.5 8.5 0 1 1 21 11.5z" />,
  more: <><circle cx="5" cy="12" r="1.6" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" /><circle cx="19" cy="12" r="1.6" fill="currentColor" stroke="none" /></>,
  progress: <><path d="M3 3v18h18" /><path d="m7 15 4-4 3 3 6-7" /></>,
  health: <><path d="M20.4 5.6a5 5 0 0 0-7.1 0L12 6.9l-1.3-1.3a5 5 0 1 0-7.1 7.1L12 21l8.4-8.3a5 5 0 0 0 0-7.1z" /><path d="M7 12h2.5l1.5-2.5 2 5 1.5-2.5H17" /></>,
  card: <><rect x="2.5" y="5" width="19" height="14" rx="2.5" /><path d="M2.5 10h19M6.5 15h3" /></>,
  folder: <path d="M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,
  target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" /></>,
  flag: <><path d="M5 21V4" /><path d="M5 4h12l-2.5 4.5L17 13H5" /></>,
  phone: <><rect x="6.5" y="2.5" width="11" height="19" rx="2.5" /><path d="M11 18h2" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  pencil: <><path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17z" /><path d="m14.5 7.5 3 3" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" /></>,
  moon: <path d="M20.5 13.2A8.5 8.5 0 1 1 10.8 3.5a6.8 6.8 0 0 0 9.7 9.7z" />,
  auto: <><circle cx="12" cy="12" r="9" /><path d="M12 3v18" /><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" stroke="none" /></>,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  // Tipos de sesión y elementos de la app
  run: <><circle cx="14.5" cy="4.5" r="1.9" /><path d="m8 21 3.2-5.6 3.3 2.6V21" /><path d="M6 11.5 9.5 8l4.3 1.4 2.2 3.1 3.5 1" /><path d="m10.6 8.4-1.7 5.2 2.3 1.8" /></>,
  dumbbell: <><path d="M6.5 6.5v11M17.5 6.5v11M3.5 9.5v5M20.5 9.5v5M6.5 12h11" /></>,
  bolt: <path d="M13 2.5 4.5 13.5H11l-1 8 8.5-11H12z" />,
  wave: <path d="M2.5 12c1.8 0 1.8-3.5 3.6-3.5S7.9 15.5 9.7 15.5s1.8-7 3.6-7 1.8 7 3.6 7 1.8-3.5 4.6-3.5" />,
  erg: <><circle cx="7" cy="15.5" r="3.5" /><path d="M10.5 15.5h10M14.5 15.5 18.5 6" /></>,
  heart: <path d="M20.4 5.6a5 5 0 0 0-7.1 0L12 6.9l-1.3-1.3a5 5 0 1 0-7.1 7.1L12 21l8.4-8.3a5 5 0 0 0 0-7.1z" />,
  stretch: <><circle cx="12" cy="4.5" r="1.9" /><path d="M4 9h16M12 9v5l-4 7M12 14l4 7" /></>,
  play: <path d="M8 5.5v13l10.5-6.5z" fill="currentColor" stroke="none" />,
  medal: <><circle cx="12" cy="15" r="5.5" /><path d="M8.5 2.5h7l-2 7h-3z" /><path d="m12 12.6.9 1.6 1.7.3-1.2 1.2.3 1.7-1.7-.8-1.7.8.3-1.7-1.2-1.2 1.7-.3z" fill="currentColor" stroke="none" /></>,
  flame: <path d="M12 21.5c4 0 6.5-2.7 6.5-6.3 0-4.4-4-6.7-4.5-11.7-3 2-4.6 5-4.3 8-1.2-.7-2-2-2.2-3.4C5.7 9.8 5.5 12 5.5 15.2c0 3.6 2.5 6.3 6.5 6.3z" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  share: <><path d="M12 3.5v12" /><path d="m7.5 8 4.5-4.5L16.5 8" /><path d="M5 13v6a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19v-6" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  drop: <path d="M12 3.5s6.5 7 6.5 11.3a6.5 6.5 0 0 1-13 0C5.5 10.5 12 3.5 12 3.5z" />,
}

export default function Icon({ name, size = 22, strokeWidth = 1.9, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ display: 'block', ...style }}>
      {P[name] || null}
    </svg>
  )
}
