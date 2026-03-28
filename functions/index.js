const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { defineSecret } = require('firebase-functions/params');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');

initializeApp();

const TOGETHER_API_KEY = defineSecret('TOGETHER_API_KEY');

exports.genererAquarelle = onDocumentCreated(
  {
    document: 'familles/{familleId}/recettes/{recetteId}',
    secrets: [TOGETHER_API_KEY],
    region: 'northamerica-northeast1',
    timeoutSeconds: 120,
  },
  async (event) => {
    const recette = event.data.data();

    // Skip if already has watercolor
    if (recette.image_aquarelle) {
      console.log(`Recette "${recette.nom}" already has watercolor, skipping.`);
      return null;
    }

    const togetherKey = TOGETHER_API_KEY.value();
    if (!togetherKey) {
      console.error('TOGETHER_API_KEY secret not set');
      return null;
    }

    const dish = recette.nom_original || recette.nom || 'dish';
    const prompt = `watercolor painting of ${dish}, loose wet watercolor brushstrokes, paint bleeds and washes, soft pastel tones, white background, hand-painted food illustration, no text, no border`;

    console.log(`Generating watercolor for: ${recette.nom}`);

    // Call Together AI
    let b64Image;
    try {
      const resp = await fetch('https://api.together.ai/v1/images/generations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${togetherKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'black-forest-labs/FLUX.1-schnell',
          prompt,
          width: 512,
          height: 512,
          steps: 4,
          n: 1,
          response_format: 'b64_json',
        }),
        signal: AbortSignal.timeout(90000),
      });

      if (!resp.ok) {
        const err = await resp.text();
        throw new Error(`Together AI ${resp.status}: ${err}`);
      }

      const json = await resp.json();
      b64Image = json?.data?.[0]?.b64_json;
      if (!b64Image) throw new Error('No image in response');
    } catch (e) {
      console.error(`Together AI error for "${recette.nom}": ${e.message}`);
      return null;
    }

    // Upload to Firebase Storage
    let downloadUrl;
    try {
      const storage = getStorage();
      const bucket = storage.bucket();
      const slug = (recette.nom || 'recette')
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

      const filePath = `recettes/${slug}-${Date.now()}.jpg`;
      const file = bucket.file(filePath);

      const buffer = Buffer.from(b64Image, 'base64');
      await file.save(buffer, { contentType: 'image/jpeg', metadata: { cacheControl: 'public, max-age=31536000' } });

      // Make public
      await file.makePublic();
      downloadUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;
    } catch (e) {
      console.error(`Storage upload error: ${e.message}`);
      return null;
    }

    // Update Firestore document
    try {
      await event.data.ref.update({ image_aquarelle: downloadUrl });
      console.log(`Aquarelle generee pour "${recette.nom}": ${downloadUrl}`);
    } catch (e) {
      console.error(`Firestore update error: ${e.message}`);
    }

    return null;
  }
);
