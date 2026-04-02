import { useState, useEffect } from 'react';
import Anthropic from '@anthropic-ai/sdk';
import PareEtincelle from './PareEtincelle';

// Citations de repli — une par semaine de l'année (modulo 52)
const CITATIONS_FALLBACK = [
  "Le feu de foyer garde la mémoire de ceux qui l'ont allumé",
  "On revient toujours vers la lumière qui nous a vu grandir",
  "La chaleur d'un foyer ne s'éteint pas avec les braises",
  "Il suffit d'un soir ensemble pour que la maison redevienne vivante",
  "Le chez-soi, c'est là où le silence est doux",
  "Les murs de la maison se souviennent de chaque rire",
  "Un repas partagé vaut plus que mille mots dits à la hâte",
  "Le foyer brûle aussi longtemps qu'on s'en occupe",
  "Rentrer chez soi, c'est retrouver la meilleure version du monde",
  "Les enfants grandissent vite — les soirées au coin du feu, pas assez",
  "On tisse sa famille comme on entretient un feu : avec soin et patience",
  "La lumière ambrée du foyer teinte même les jours ordinaires de beauté",
  "Il y a dans l'odeur du bois brûlé quelque chose qui ressemble à l'amour",
  "Le bonheur domestique n'a pas besoin de grandes occasions",
  "Une maison chaude est la plus ancienne forme de tendresse",
  "Les soirées d'hiver ont un goût d'éternité quand on est ensemble",
  "Le feu parle à ceux qui savent se taire et écouter",
  "Même les petits matins ont leur grâce quand la maison est pleine",
  "On ne sait ce que vaut un foyer qu'en s'en éloignant",
  "La famille, c'est l'art de rester soi tout en appartenant aux autres",
  "Les flammes dansent pour ceux qui ont le courage de rester",
  "Un foyer bien gardé est une promesse faite aux enfants",
  "Le temps passe vite entre les repas et les couchers de soleil",
  "On construit sa maison avec des pierres, son foyer avec des instants",
  "Chaque semaine recommencée est une chance de mieux aimer",
  "Les saisons changent, mais le feu garde toujours la même promesse",
  "Il fait bon vivre là où l'on est attendu le soir",
  "La maison résonne encore des rires de ceux qui sont partis",
  "Un foyer, c'est un endroit où l'on peut être fatigué sans avoir honte",
  "Derrière chaque porte close, une histoire qui mérite d'être racontée",
  "Le bonheur est souvent là, assis à la même table que toi",
  "Les petites habitudes sont le ciment des grandes familles",
  "Le feu de cheminée est le seul écran qui ne lasse pas",
  "On revient toujours à la table où on a grandi",
  "La maison sent bon les dimanches qu'on n'a pas encore vécus",
  "Un foyer, c'est là où le temps ralentit sans qu'on lui demande",
  "Les flammes rappellent que la lumière naît de ce qui brûle",
  "Rester ensemble, c'est parfois le plus grand des courages",
  "Le soir descend doucement sur les maisons où l'on s'aime",
  "On ne manque jamais de chaleur là où quelqu'un nous attend",
  "Les enfants se souviennent des soirs, pas des choses",
  "Une famille qui mange ensemble bâtit quelque chose d'invisible et de solide",
  "Le foyer est la seule école où l'on apprend à être humain",
  "Il suffit d'une bougie pour que la nuit devienne accueillante",
  "La maison respire au rythme de ceux qui l'habitent",
  "On grandit partout, mais on devient soi-même chez soi",
  "Les meilleures conversations naissent après le dernier plat",
  "Un toit partagé, c'est une façon de dire je reste",
  "La chaleur d'un foyer se mesure aux sourires du matin",
  "Le feu danse pour rappeler que la vie aussi est éphémère et belle",
  "Même les silences sont chaleureux dans une maison qui s'aime",
  "On ne construit pas une famille, on l'entretient chaque jour",
];

function citationFallback(semaineVue) {
  // Dérive un index stable à partir de la clé de semaine (ex: "2025-W14")
  const hash = (semaineVue || '').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return CITATIONS_FALLBACK[hash % CITATIONS_FALLBACK.length];
}

// Citation de foyer générée par Claude Haiku, mise en cache par semaine
async function genererCitation(semaineVue) {
  const apiKey = localStorage.getItem('anthropic_key');
  if (!apiKey) return null;

  const cached = localStorage.getItem(`fp_citation_foyer_${semaineVue}`);
  if (cached) return cached;

  try {
    const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true, timeout: 15000 });
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 60,
      messages: [{
        role: 'user',
        content: `Génère une seule phrase poétique courte (8 à 14 mots) en français, évoquant la chaleur du foyer familial, l'intimité du chez-soi ou la lumière d'un feu de cheminée. Style : mélancolique et chaleureux, comme une épigraphe de roman québécois. Réponds UNIQUEMENT avec la phrase, sans guillemets ni ponctuation finale.`,
      }],
    });
    const citation = response.content[0]?.text?.trim() || null;
    if (citation) localStorage.setItem(`fp_citation_foyer_${semaineVue}`, citation);
    return citation;
  } catch {
    return null;
  }
}

export default function FooterMontcalm({ semaineVue }) {
  const [citation, setCitation] = useState(() => {
    // Priorité : cache API → fallback statique (toujours quelque chose à afficher)
    return localStorage.getItem(`fp_citation_foyer_${semaineVue}`) || citationFallback(semaineVue);
  });

  useEffect(() => {
    // Si déjà une citation API en cache (plus longue / différente du fallback), ne pas rappeler
    const cached = localStorage.getItem(`fp_citation_foyer_${semaineVue}`);
    if (cached) { setCitation(cached); return; }
    // Sinon, essayer d'enrichir avec Claude Haiku (silencieux en cas d'échec)
    genererCitation(semaineVue).then(c => { if (c) setCitation(c); });
  }, [semaineVue]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <footer className="condo-footer">
      <div className="condo-footer__inner">
        <PareEtincelle width={180} />
        {citation && (
          <p className="condo-footer__citation">
            <span className="condo-footer__guillemet">«</span>
            {citation}
            <span className="condo-footer__guillemet">»</span>
          </p>
        )}
        <div className="condo-footer__label">Condo Montcalm</div>
      </div>
    </footer>
  );
}
