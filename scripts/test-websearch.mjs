/**
 * test-websearch.mjs
 * Vérifie si l'outil web_search d'Anthropic est disponible sur ce compte.
 * Exécuter via : node scripts/test-websearch.mjs
 */
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

console.log('Test de disponibilité de web_search...\n');

try {
  const msg = await client.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 500,
    tools: [{ type: 'web_search_20250305', name: 'web_search' }],
    messages: [{
      role: 'user',
      content: 'Cherche les événements de cette semaine au Pantoum à Québec et retourne 1 résultat.',
    }],
  });

  const toolUses = msg.content.filter(b => b.type === 'tool_use');
  const toolResults = msg.content.filter(b => b.type === 'tool_result');
  const text = msg.content.filter(b => b.type === 'text').map(b => b.text).join('');

  console.log('✅ web_search DISPONIBLE sur ce compte!');
  console.log('Stop reason:', msg.stop_reason);
  console.log('Tool uses:', toolUses.length);
  console.log('Réponse:', text.slice(0, 300));

} catch (err) {
  if (err.message?.includes('web_search') || err.status === 400) {
    console.log('❌ web_search NON DISPONIBLE sur ce compte.');
    console.log('   → Utiliser Brave Search API ou Tavily comme alternative.');
    console.log('   Erreur:', err.message);
  } else {
    console.log('Erreur inattendue:', err.message);
  }
}
