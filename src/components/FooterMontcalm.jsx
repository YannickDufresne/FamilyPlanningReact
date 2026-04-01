import { useState, useEffect } from 'react';
import Anthropic from '@anthropic-ai/sdk';
import PareEtincelle from './PareEtincelle';

// Citation de foyer généré par Claude Haiku, mis en cache par semaine
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
    return localStorage.getItem(`fp_citation_foyer_${semaineVue}`) || null;
  });

  useEffect(() => {
    if (citation) return; // déjà en cache
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
