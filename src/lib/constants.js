import { createElement } from 'react'
import Icon from '../components/Icon'

// Iconos de línea por tipo de sesión (se adaptan al tamaño del texto que los rodea)
const ti = (name) => createElement(Icon, { name, size: '1.15em', strokeWidth: 2, style: { display: 'inline-block', verticalAlign: '-0.2em' } })
export const TYPE_ICONS = { run: ti('run'), fuerza: ti('dumbbell'), series: ti('bolt'), endurance: ti('wave'), especifico: ti('target'), ergometros: ti('erg'), cardio: ti('heart'), rest_day: ti('moon'), strength: ti('dumbbell'), flexibility: ti('stretch'), mixed: ti('bolt') }
// 4 familias de color: resistencia (verde azulado), fuerza (ámbar), Hyrox/específico (índigo), descanso (gris)
export const TYPE_COLORS = { run:'#0D9488', series:'#0F766E', endurance:'#0E7490', cardio:'#0891B2', fuerza:'#D97706', strength:'#D97706', especifico:'#4F46E5', ergometros:'#6366F1', mixed:'#4338CA', flexibility:'#64748B', rest_day:'#9CA3AF' }
export const TYPE_LABELS = { run:'Carrera', fuerza:'Fuerza', series:'Series', endurance:'Resistencia', especifico:'Específico', ergometros:'Ergómetros', cardio:'Cardio', rest_day:'Descanso', strength:'Fuerza', flexibility:'Movilidad', mixed:'Mixta' }

// Funcionalidades activables. Nutrición desactivada: Celia ya no ofrece ese servicio.
// Para volver a mostrarla basta con poner nutrition: true (los datos se conservan).
export const FEATURES = { nutrition: false }
