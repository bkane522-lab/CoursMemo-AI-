# CoursMemo AI — V1.5.1.1 Groq IA

Version qui ajoute les fonctions demandées à partir de l’idée Resutrans : transcription IA et résumé IA avec une clé Groq, tout en gardant l’interface CoursMemo AI.

## Nouveautés

- Bouton **Clé IA** pour enregistrer une clé API Groq localement sur l’appareil.
- Bouton **Transcrire** : envoie l’audio/vidéo à l’API de transcription Groq.
- Bouton **Résumé IA** : transforme la transcription en résumé, points clés, corrections et objectifs.
- Zone **Résumé IA** ajoutée dans la fiche.
- Export TXT enrichi : titre, thème, transcription, résumé IA et notes personnelles.
- Import média local conservé via IndexedDB.
- Si un fichier dépasse la limite prévue, tentative d’extraction audio locale en WAV mono 16 kHz avant envoi.
- Cache PWA mis à jour en V1.5.1.

## Utilisation

1. Déploie le projet sur Vercel.
2. Ouvre l’app sur téléphone.
3. Appuie sur **Clé IA** et colle ta clé Groq `gsk_...`.
4. Crée une fiche de cours.
5. Ajoute une vidéo ou un audio.
6. Appuie sur **Transcrire**.
7. Appuie sur **Résumé IA**.
8. Enregistre et exporte en TXT si besoin.

## Confidentialité

Les titres, notes, transcriptions et médias restent stockés sur l’appareil via localStorage/IndexedDB.

Quand tu appuies sur **Transcrire**, le fichier média est envoyé directement depuis le navigateur vers Groq.

Quand tu appuies sur **Résumé IA**, le texte de transcription est envoyé directement depuis le navigateur vers Groq.

## Sécurité importante

Cette version appelle Groq directement depuis le navigateur. C’est pratique pour un usage personnel, mais ce n’est pas conseillé pour une app publique, car une clé API utilisée côté navigateur peut être visible dans les outils développeur.

Pour une version publique ou payante, il faudra passer par un backend sécurisé qui garde la clé API côté serveur.

## Limites connues

- Les fichiers très longs peuvent dépasser la limite acceptée par l’API.
- L’extraction audio locale dépend du navigateur et du format vidéo.
- La fiche PDF n’est pas encore branchée.
- Pas de synchronisation cloud : les données restent sur l’appareil.


## Correctif V1.5.1 — gros fichiers vidéo Android

Cette version ajoute un second mode d’extraction audio pour les grosses vidéos MP4 : l’app lit la vidéo localement, en arrière-plan, puis enregistre seulement la piste audio compressée en WebM/Opus avant l’envoi à Groq. Cela évite le chargement complet en mémoire qui provoquait l’erreur `Unable to decode audio data` sur certains fichiers vidéo volumineux.

À savoir : cette extraction peut durer presque le temps réel de la vidéo. Il faut laisser l’écran ouvert pendant l’extraction. Si l’audio extrait dépasse encore 25 Mo, il faudra couper la vidéo en plusieurs parties.
