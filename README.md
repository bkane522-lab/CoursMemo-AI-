# CoursMemo AI — V1.6 Audio + Transcription

Cette version sépare clairement le parcours demandé :

1. **Fiche** : titre, thème, import vidéo/audio, options.
2. **Audio** : conversion vidéo → audio quand le navigateur peut extraire la piste audio.
3. **Texte** : transcription Groq, résumé IA, dictée, export TXT.
4. **Premium** : espace prévu pour PDF, export complet et suivi avancé.

## Nouveautés V1.6

- Ajout d’un onglet **Audio**.
- Ajout d’un bouton **Convertir en audio**.
- Ajout d’un aperçu de l’audio converti.
- Ajout d’un bouton **Utiliser pour transcription**.
- Ajout d’un bouton **Télécharger audio**.
- Ajout d’un onglet **Texte** séparé pour la transcription, le résumé IA, la dictée et l’export TXT.
- Le bouton **Transcrire** utilise automatiquement l’audio converti si disponible.
- Cache PWA mis à jour en V1.6.

## Workflow conseillé

1. Créer une fiche.
2. Ajouter une vidéo ou un audio.
3. Aller dans **Audio**.
4. Appuyer sur **Convertir en audio**.
5. Si l’audio est créé, appuyer sur **Utiliser pour transcription**.
6. Aller dans **Texte**.
7. Appuyer sur **Transcrire**.
8. Appuyer sur **Résumé IA**.
9. Enregistrer la fiche.

## Limite importante

La conversion audio dans le navigateur dépend de Chrome Android et du format du fichier vidéo.

Si la vidéo affiche une erreur du type `DEMUXER_ERROR_DETECTED_AAC` ou `Unable to decode audio data`, cela veut dire que le navigateur ne peut pas lire ou extraire correctement la piste audio de ce fichier.

Dans ce cas, la solution fiable reste :

- convertir la vidéo en **MP3** ou **M4A** avec une app externe ;
- ou couper le cours en extraits plus courts ;
- puis importer l’audio dans CoursMemo AI.

## Groq IA

- **Transcrire** envoie le fichier audio/vidéo à Groq avec ta clé API.
- **Résumé IA** envoie la transcription à Groq avec ta clé API.
- La clé est stockée localement sur l’appareil.

## Sécurité

Cette version appelle Groq directement depuis le navigateur. C’est adapté à un usage personnel, mais pas à une application publique payante.

Pour une app publique, il faudra un backend sécurisé qui garde la clé API côté serveur.
