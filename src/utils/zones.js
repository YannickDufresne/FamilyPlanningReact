// ── Zones géographiques et drapeaux ──────────────────────────────────────────

export const ZONES = [
  {
    zone: 'Asie',
    emoji: '🌏',
    pays: ['Chine', 'Corée', 'Inde', 'Japon', 'Laos', 'Perse', 'Perse/Iran', 'Thaïlande', 'Viêtnam'],
  },
  {
    zone: 'Europe',
    emoji: '🇪🇺',
    pays: ['Allemagne', 'Autriche', 'Belgique', 'Espagne', 'France', 'Grèce', 'Hongrie', 'Italie', 'Méditerranéen', 'Royaume-Uni', 'Scandinavie'],
  },
  {
    zone: 'Amériques',
    emoji: '🌎',
    pays: ['Amérique centrale', 'Canada', 'Cuba', 'États-Unis', 'Hawaï', 'Mexique', 'Pérou', 'Québec'],
  },
  {
    zone: 'Afrique & Moyen-Orient',
    emoji: '🌍',
    pays: ['Afrique du Sud', 'Haïti', 'Liban', 'Maroc', 'Moyen-Orient'],
  },
  {
    zone: 'Fusion',
    emoji: '🌐',
    pays: ['Asie', 'Fusion'],
  },
];

export const DRAPEAUX = {
  'Afrique du Sud':    '🇿🇦',
  'Allemagne':         '🇩🇪',
  'Amérique centrale': '🌮',
  'Asie':              '🌏',
  'Autriche':          '🇦🇹',
  'Belgique':          '🇧🇪',
  'Canada':            '🇨🇦',
  'Chine':             '🇨🇳',
  'Corée':             '🇰🇷',
  'Cuba':              '🇨🇺',
  'Espagne':           '🇪🇸',
  'France':            '🇫🇷',
  'Fusion':            '🌐',
  'Grèce':             '🇬🇷',
  'Hawaï':             '🌺',
  'Haïti':             '🇭🇹',
  'Hongrie':           '🇭🇺',
  'Inde':              '🇮🇳',
  'Italie':            '🇮🇹',
  'Japon':             '🇯🇵',
  'Laos':              '🇱🇦',
  'Liban':             '🇱🇧',
  'Maroc':             '🇲🇦',
  'Mexique':           '🇲🇽',
  'Moyen-Orient':      '🕌',
  'Méditerranéen':     '🌊',
  'Perse':             '🇮🇷',
  'Perse/Iran':        '🇮🇷',
  'Pérou':             '🇵🇪',
  'Québec':            '🍁',
  'Royaume-Uni':       '🇬🇧',
  'Scandinavie':       '❄️',
  'Thaïlande':         '🇹🇭',
  'Viêtnam':           '🇻🇳',
  'États-Unis':        '🇺🇸',
};

// Retourne les pays d'une zone depuis une valeur "zone:XYZ"
export function paysDeZone(origineValeur) {
  if (!origineValeur?.startsWith('zone:')) return null;
  const nomZone = origineValeur.slice(5);
  return ZONES.find(z => z.zone === nomZone)?.pays || [];
}

// Retourne un label lisible pour l'affichage (badge, prompt IA)
export function labelOrigine(origineValeur) {
  if (!origineValeur || origineValeur === 'Tous') return null;
  if (origineValeur.startsWith('zone:')) {
    const nomZone = origineValeur.slice(5);
    const z = ZONES.find(z => z.zone === nomZone);
    return z ? `${z.emoji} ${z.zone}` : nomZone;
  }
  const flag = DRAPEAUX[origineValeur] || '';
  return flag ? `${flag} ${origineValeur}` : origineValeur;
}
