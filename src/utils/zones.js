// ── Zones géographiques et drapeaux ──────────────────────────────────────────

export const ZONES = [
  {
    zone: 'Asie',
    emoji: '🌏',
    pays: [
      'Cambodge', 'Chine', 'Corée', 'Inde', 'Indonésie', 'Japon',
      'Laos', 'Malaisie', 'Myanmar', 'Philippines', 'Singapour',
      'Sri Lanka', 'Thaïlande', 'Viêtnam',
    ],
  },
  {
    zone: 'Moyen-Orient & Caucase',
    emoji: '🕌',
    pays: [
      'Arabie Saoudite', 'Arménie', 'Azerbaïdjan', 'Géorgie',
      'Irak', 'Iran/Perse', 'Israël', 'Jordanie', 'Koweït',
      'Liban', 'Moyen-Orient', 'Oman', 'Palestine', 'Syrie',
      'Turquie', 'Yémen',
    ],
  },
  {
    zone: 'Europe',
    emoji: '🇪🇺',
    pays: [
      'Allemagne', 'Autriche', 'Belgique', 'Croatie', 'Espagne',
      'Finlande', 'France', 'Grèce', 'Hongrie', 'Italie',
      'Méditerranéen', 'Pays-Bas', 'Pologne', 'Portugal',
      'Royaume-Uni', 'Russie', 'Scandinavie', 'Suisse', 'Ukraine',
    ],
  },
  {
    zone: 'Amériques',
    emoji: '🌎',
    pays: [
      'Amérique centrale', 'Antilles', 'Argentine', 'Bolivie',
      'Brésil', 'Canada', 'Colombie', 'Cuba', 'Équateur',
      'États-Unis', 'Guatemala', 'Haïti', 'Hawaï', 'Jamaïque',
      'Mexique', 'Pérou', 'Québec', 'Trinidad', 'Venezuela',
    ],
  },
  {
    zone: 'Afrique',
    emoji: '🌍',
    pays: [
      'Afrique du Sud', 'Algérie', 'Cameroun', "Côte d'Ivoire",
      'Égypte', 'Éthiopie', 'Ghana', 'Kenya', 'Maroc',
      'Nigeria', 'Sénégal', 'Tanzanie', 'Tunisie',
    ],
  },
];

// Fusion en entrée unique (hors zone)
export const FUSION_ENTRY = { value: 'Fusion', label: '🌐 Cuisine fusion' };

export const DRAPEAUX = {
  // Afrique
  'Afrique du Sud':    '🇿🇦',
  'Algérie':           '🇩🇿',
  'Cameroun':          '🇨🇲',
  "Côte d'Ivoire":     '🇨🇮',
  'Égypte':            '🇪🇬',
  'Éthiopie':          '🇪🇹',
  'Ghana':             '🇬🇭',
  'Kenya':             '🇰🇪',
  'Maroc':             '🇲🇦',
  'Nigeria':           '🇳🇬',
  'Sénégal':           '🇸🇳',
  'Tanzanie':          '🇹🇿',
  'Tunisie':           '🇹🇳',
  // Amériques
  'Amérique centrale': '🌮',
  'Antilles':          '🏝️',
  'Argentine':         '🇦🇷',
  'Bolivie':           '🇧🇴',
  'Brésil':            '🇧🇷',
  'Canada':            '🇨🇦',
  'Colombie':          '🇨🇴',
  'Cuba':              '🇨🇺',
  'Équateur':          '🇪🇨',
  'États-Unis':        '🇺🇸',
  'Guatemala':         '🇬🇹',
  'Haïti':             '🇭🇹',
  'Hawaï':             '🌺',
  'Jamaïque':          '🇯🇲',
  'Mexique':           '🇲🇽',
  'Pérou':             '🇵🇪',
  'Québec':            '🍁',
  'Trinidad':          '🇹🇹',
  'Venezuela':         '🇻🇪',
  // Asie
  'Cambodge':          '🇰🇭',
  'Chine':             '🇨🇳',
  'Corée':             '🇰🇷',
  'Inde':              '🇮🇳',
  'Indonésie':         '🇮🇩',
  'Japon':             '🇯🇵',
  'Laos':              '🇱🇦',
  'Malaisie':          '🇲🇾',
  'Myanmar':           '🇲🇲',
  'Philippines':       '🇵🇭',
  'Singapour':         '🇸🇬',
  'Sri Lanka':         '🇱🇰',
  'Thaïlande':         '🇹🇭',
  'Viêtnam':           '🇻🇳',
  // Europe
  'Allemagne':         '🇩🇪',
  'Autriche':          '🇦🇹',
  'Belgique':          '🇧🇪',
  'Croatie':           '🇭🇷',
  'Espagne':           '🇪🇸',
  'Finlande':          '🇫🇮',
  'France':            '🇫🇷',
  'Grèce':             '🇬🇷',
  'Hongrie':           '🇭🇺',
  'Italie':            '🇮🇹',
  'Méditerranéen':     '🌊',
  'Pays-Bas':          '🇳🇱',
  'Pologne':           '🇵🇱',
  'Portugal':          '🇵🇹',
  'Royaume-Uni':       '🇬🇧',
  'Russie':            '🇷🇺',
  'Scandinavie':       '❄️',
  'Suisse':            '🇨🇭',
  'Ukraine':           '🇺🇦',
  // Moyen-Orient & Caucase
  'Arabie Saoudite':   '🇸🇦',
  'Arménie':           '🇦🇲',
  'Azerbaïdjan':       '🇦🇿',
  'Géorgie':           '🇬🇪',
  'Irak':              '🇮🇶',
  'Iran/Perse':        '🇮🇷',
  'Israël':            '🇮🇱',
  'Jordanie':          '🇯🇴',
  'Koweït':            '🇰🇼',
  'Liban':             '🇱🇧',
  'Moyen-Orient':      '🕌',
  'Oman':              '🇴🇲',
  'Palestine':         '🇵🇸',
  'Syrie':             '🇸🇾',
  'Turquie':           '🇹🇷',
  'Yémen':             '🇾🇪',
  // Fusion
  'Fusion':            '🌐',
  // Rétro-compatibilité (anciennes valeurs en base)
  'Perse':             '🇮🇷',
  'Perse/Iran':        '🇮🇷',
  'Asie':              '🌏',
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
  if (origineValeur === 'Fusion') return '🌐 Fusion';
  if (origineValeur.startsWith('zone:')) {
    const nomZone = origineValeur.slice(5);
    const z = ZONES.find(z => z.zone === nomZone);
    return z ? `${z.emoji} ${z.zone}` : nomZone;
  }
  const flag = DRAPEAUX[origineValeur] || '';
  return flag ? `${flag} ${origineValeur}` : origineValeur;
}
