#!/usr/bin/env node
// Corrige les recettes dont cout > 6 : convertit un montant $ brut vers l'échelle 1-6
// Échelle : 1=<4$, 2=4-7$, 3=7-12$, 4=12-18$, 5=18-25$, 6=>25$

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const chemin = join(__dirname, '../src/data/recettes.json');

function dollarVersEchelle(montant) {
  if (montant <= 4)  return 1;
  if (montant <= 7)  return 2;
  if (montant <= 12) return 3;
  if (montant <= 18) return 4;
  if (montant <= 25) return 5;
  return 6;
}

const recettes = JSON.parse(readFileSync(chemin, 'utf8'));

let corrigees = 0;
const recettesCorrigees = recettes.map(r => {
  if (r.cout > 6) {
    const ancienCout = r.cout;
    const nouveauCout = dollarVersEchelle(r.cout);
    console.log(`  "${r.nom}" : cout ${ancienCout} → ${nouveauCout}`);
    corrigees++;
    return { ...r, cout: nouveauCout };
  }
  return r;
});

writeFileSync(chemin, JSON.stringify(recettesCorrigees, null, 2), 'utf8');
console.log(`\n✅ ${corrigees} recettes corrigées sur ${recettes.length} total.`);
