// ============================================================================
// Lichievements — Deutsch
//
// Overlays the English source texts (see js/i18n.js). Anything missing here
// shows in English. Chess terms follow Lichess's own German translation
// (Partie, Wertung, Remis, Patzer, Bedenkzeit …); move lists stay in English
// SAN, exactly as Lichess shows them by default.
// ============================================================================

export const ui = {
  // index.html
  'tagline': 'Melde dich mit Lichess an und entdecke die Achievements, die in deinen Partien stecken.',
  'btn.login': 'Mit Lichess anmelden',
  'btn.reload': 'Neu laden',
  'btn.logout': 'Abmelden',
  'btn.view': 'Zwischen Raster und Liste wechseln',
  'btn.theme': 'Zwischen hellem und dunklem Design wechseln',
  'btn.language': 'Sprache',
  'btn.hints': 'Tipps für knifflige Achievements',
  'btn.github': 'Quellcode auf GitHub ansehen',
  'status.unlocked': 'freigeschaltet',
  'footer.privacy': 'Kein offizielles Angebot von Lichess. Deine Partien werden vollständig in deinem Browser analysiert und verlassen nie dein Gerät. Basiert auf der <a href="https://lichess.org/api" target="_blank" rel="noopener">Lichess-API</a>.',
  'footer.icons': 'Icons von <a href="https://heroicons.com" target="_blank" rel="noopener">Heroicons</a>.',

  // main.js
  'status.analysed': '{done} / {total} Partien analysiert',
  'status.analysedCount': '{done} Partien analysiert',
  'status.restored': 'Wiederhergestellt von deinem letzten Besuch',
  'tile.locked': 'Gesperrtes Achievement',
  'modal.label': 'Achievement-Stufe',
  'modal.close': 'Schließen',
  'modal.prev': 'Vorherige Stufe',
  'modal.next': 'Nächste Stufe',

  // Errors (oauth.js, worker.js)
  'err.declined': 'Die Anmeldung bei Lichess wurde abgelehnt ({reason}).',
  'err.state': 'Die Anmeldung konnte nicht überprüft werden. Bitte melde dich erneut an.',
  'err.token': 'Lichess hat keinen Zugangsschlüssel ausgestellt.',
  'err.noToken': 'Lichess hat keinen Zugangsschlüssel zurückgegeben.',
  'err.account': 'Dein Lichess-Konto konnte nicht geladen werden.',
  'err.stream': 'Deine Partien konnten nicht von Lichess geladen werden.',
};

export const categories = {
  'Checkmates': 'Mattsetzen',
  'Winning Feats': 'Besondere Siege',
  'Win Conditions': 'Partieenden',
  'Board Antics': 'Brettkuriositäten',
  'Openings: White': 'Eröffnungen: Weiß',
  'Openings: Black': 'Eröffnungen: Schwarz',
  'Opening Collections': 'Eröffnungssammlungen',
  'Time Controls': 'Bedenkzeiten',
  'Variants': 'Varianten',
  'Game Types': 'Partiearten',
  'Machines': 'Gegen die Maschine',
  'Milestones': 'Meilensteine',
  'Ratings': 'Wertungen',
  'Records': 'Bilanz',
  'Precision': 'Präzision',
  'Puzzles': 'Taktikaufgaben',
  'Profile & Community': 'Profil & Community',
  'Dedication': 'Ausdauer',
  'Notable Games': 'Besondere Partien',
  'Social': 'Soziales',
  'Tournaments': 'Turniere',
};

export const achievements = {};
