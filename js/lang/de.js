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
  'err.streamBroken': 'Die Verbindung zu Lichess ist abgebrochen, bevor alle deine Partien analysiert waren. Mit „Neu laden“ kannst du es erneut versuchen.',

  // hints.html (section headings come from the achievement titles below)
  'hints.pageTitle': 'Tipps — lichievements',
  'hints.tagline': 'Tipps & Zugfolgen für die Achievements, über die man kaum zufällig stolpert.',
  'hints.back': 'Zurück zu den Achievements',
  'hints.intro': 'Die <strong>Eröffnungssammlungen</strong> verlangen eine ganze Reihe bestimmter Eröffnungen, deshalb schaltet man sie selten zufällig frei. Hier steht genau, was jede davon braucht. Spiele die angegebenen Züge in irgendeiner deiner Partien, und das passende Element wird abgehakt. Außer bei <q>Alle zwanzig ersten Züge</q> ist <strong>die Farbe egal</strong>: Beide Seiten zählen, und jede Eröffnung muss nur ein einziges Mal auf dem Brett erscheinen.',
  'hints.note': 'Hier siehst du deinen Fortschritt aus der letzten Analyse. Lade deine Achievements neu, um den aktuellen Stand zu sehen.',
  'hints.openGame': 'Die Partie auf Lichess öffnen, in der dies freigeschaltet wurde',
  'hints.allwhite': 'Spiele über deine Partien verteilt als <strong>Weiß</strong> alle zwanzig möglichen ersten Züge – jeden legalen Eröffnungszug mindestens einmal.',
  'hints.abcde': 'Lichess ordnet jede Standardpartie einem Code aus der <em>Encyclopaedia of Chess Openings</em> zu – <code>B20</code>, <code>E60</code> und so weiter –, und hier zählt nur der Buchstabe. Spiele eine Partie aus jedem der fünf Bände: <strong>A</strong> die Flankeneröffnungen und irregulären Eröffnungen, <strong>B</strong> die halboffenen Spiele, <strong>C</strong> die offenen Spiele und Französisch, <strong>D</strong> die geschlossenen Spiele, <strong>E</strong> die indischen Verteidigungen. Jede Eröffnung eines Bandes hakt ihn ab, und beide Farben zählen.',
  'hints.ecoTitle': 'ECO-Experte',
  'hints.eco': 'Ein Achievement pro Band, und jedes verlangt den ganzen Band: alle hundert Codes von <code>A00</code> bis <code>A99</code>, und genauso für B, C, D und E. Jede Eröffnung, die unter einem Code eingeordnet ist, zählt, mit beiden Farben. Eine Spalte ist ein Band, eine Zeile sind die beiden Ziffern, und ein Feld füllt sich, sobald du diesen Code gespielt hast.',
  'hints.ecoAria': 'Von dir gespielte ECO-Codes, nach Band',
  'hints.eu': 'Eine Eröffnung pro EU-Mitgliedstaat, 27 insgesamt. Jede Zeile nennt das Land, die Eröffnung und die Züge, die du spielen musst.',
  'hints.scary': 'Spiele diese sechs herrlich gruseligen Eröffnungen.',
  'hints.fantasy': 'Spiele diese sechs Eröffnungen mit Fantasy-Namen.',
  'hints.zoo': 'Spiele zu jedem Tier eine Eröffnung – jede nach einem Tier benannte Eröffnung, fünfunddreißig insgesamt.',
  'hints.champions': 'Spiele zu jedem der sechzehn unumstrittenen Weltmeister eine nach ihm benannte Eröffnung.',
  'hints.championsNote': 'Die Liste endet bei Carlsen: Nach den jüngeren Weltmeistern Ding Liren und Gukesh D. ist bisher keine Eröffnung benannt.',
  'hints.beverages': 'Spiele diese vier Eröffnungen mit Getränke-Namen.',

  // The Union — member states
  'country.AT': 'Österreich',
  'country.BE': 'Belgien',
  'country.BG': 'Bulgarien',
  'country.CY': 'Zypern',
  'country.CZ': 'Tschechien',
  'country.DE': 'Deutschland',
  'country.DK': 'Dänemark',
  'country.EE': 'Estland',
  'country.ES': 'Spanien',
  'country.FI': 'Finnland',
  'country.FR': 'Frankreich',
  'country.GR': 'Griechenland',
  'country.HR': 'Kroatien',
  'country.HU': 'Ungarn',
  'country.IE': 'Irland',
  'country.IT': 'Italien',
  'country.LT': 'Litauen',
  'country.LU': 'Luxemburg',
  'country.LV': 'Lettland',
  'country.MT': 'Malta',
  'country.NL': 'Niederlande',
  'country.PL': 'Polen',
  'country.PT': 'Portugal',
  'country.RO': 'Rumänien',
  'country.SE': 'Schweden',
  'country.SI': 'Slowenien',
  'country.SK': 'Slowakei',
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

// --- Helpers for the generated ladders (mirroring those in achievements.js) ---

// speedTier(): 1 / 10 / 100 / 1,000 games in one time control.
const speed = (title, one, many) => ({
  t: title, d: `Spiele ${many}`,
  steps: [
    ['Einsteiger', `Spiele ${one}`],
    ['Stammspieler', `Spiele 10 ${many}`],
    ['Vielspieler', `Spiele 100 ${many}`],
    ['Spezialist', `Spiele 1.000 ${many}`],
  ],
});

// ratingTier(): peak rating 1000 … 2200 in one time control.
const rating = (title, where) => ({
  t: title, d: `Erreiche ${where} immer neue Höchstwertungen`,
  steps: [1000, 1500, 1800, 2000, 2200].map((n, i) => [
    ['Neuling', 'Aufsteiger', 'Fortgeschritten', 'Experte', 'Meisterklasse'][i],
    `Erreiche ${where} eine Wertung von ${n}`,
  ]),
});

// ecoExpert(): all hundred codes of one ECO volume.
const eco = (v) => ({ t: `ECO-${v}-Experte`, d: `Spiele alle hundert ECO-Codes von ${v}00 bis ${v}99` });

// A plain variant: only the details need translating, the names are Lichess's.
const variant = (name) => ({ d: `Spiele eine Partie ${name}` });

export const achievements = {
  // Checkmates
  'queen-mate': { t: 'Damenmatt', d: 'Setze mit der Dame matt' },
  'rook-mate': { t: 'Turmmatt', d: 'Setze mit einem Turm matt' },
  'bishop-mate': { t: 'Läufermatt', d: 'Setze mit einem Läufer matt' },
  'knight-mate': { t: 'Springermatt', d: 'Setze mit einem Springer matt' },
  'short-castle-mate': { t: 'Matt durch kurze Rochade', d: 'Setze mit der kurzen Rochade matt' },
  'long-castle-mate': { t: 'Matt durch lange Rochade', d: 'Setze mit der langen Rochade matt' },
  'en-passant-mate': { t: 'Matt en passant', d: 'Setze matt, indem du en passant schlägst' },
  'pawn-finish': { t: 'Matt durch Umwandlung', d: 'Setze matt, indem du einen Bauern in eine Dame umwandelst' },
  'pawn-finish-deluxe': { t: 'Matt durch Unterverwandlung', d: 'Setze matt, indem du einen Bauern unterverwandelst' },
  'pacifist-win': { t: 'Matt ohne Schlagen', d: 'Setze matt in einer Partie, in der keine Seite je geschlagen hat' },
  'check-check-mate': { t: 'Schach, Schach, Matt', d: 'Gib mit drei Zügen in Folge Schach, Schach und dann Matt' },
  'lazy-king': { t: 'Matt ohne Königszug', d: 'Setze matt, ohne deinen König je gezogen zu haben' },
  'lazy-queen': { t: 'Matt ohne Damenzug', d: 'Setze matt, ohne deine Dame je gezogen zu haben' },
  'lazy-rook': { t: 'Matt ohne Turmzug', d: 'Setze matt, ohne deine Türme je gezogen zu haben' },
  'lazy-bishop': { t: 'Matt ohne Läuferzug', d: 'Setze matt, ohne deine Läufer je gezogen zu haben' },
  'lazy-knight': { t: 'Matt ohne Springerzug', d: 'Setze matt, ohne deine Springer je gezogen zu haben' },
  'checkmate-sprint': { t: 'Schachserie bis zum Matt', d: 'Gib viermal in Folge Schach und setze dann matt' },
  'long-kill': { t: 'Spätes Matt', d: 'Setze nach dem 60. Zug matt' },

  // Winning Feats
  'survivor': { t: 'Sieg unter Beschuss', d: 'Gewinne eine Partie, in der du mindestens fünfmal Schach bekommen hast' },
  'underachiever': { t: 'Sieg mit Unterverwandlung', d: 'Gewinne eine Partie, in der du einen Bauern unterverwandelt hast' },
  'kings-journey': { t: 'Königswanderung', d: 'Gewinne, nachdem dein König die gegnerische Grundreihe erreicht hat (die 8. für Weiß, die 1. für Schwarz)' },
  'queen-grand-tour': { t: 'Damen-Rundreise', d: 'Gewinne eine Partie, in der deine Dame alle vier Ecken des Bretts besucht hat (a1, a8, h1, h8)' },
  'knight-grand-tour': { t: 'Springer-Rundreise', d: 'Gewinne eine Partie, in der deine Springer alle vier Ecken des Bretts besucht haben (a1, a8, h1, h8)' },
  'underdog': { t: 'Sieg gegen einen Stärkeren', d: 'Besiege einen Gegner, der mindestens 200 Punkte höher gewertet ist als du, keine der beiden Wertungen vorläufig' },
  'giant-slayer': { t: 'Titelträger besiegt', d: 'Besiege einen Spieler mit Titel' },
  'comeback': {
    t: 'Sieg trotz Materialrückstand', d: 'Gewinne, obwohl du Material zurücklagst',
    steps: [
      ['Leichtfigur weniger', 'Gewinne nach einem Rückstand von einer Leichtfigur (3 Punkte)'],
      ['Turm weniger', 'Gewinne nach einem Rückstand von einem Turm (5 Punkte)'],
      ['Dame weniger', 'Gewinne nach einem Rückstand von einer Dame (9 Punkte)'],
    ],
  },
  'swindle': { t: 'Ins Patt gerettet', d: 'Rette dich ins Patt, obwohl du mindestens 8 Punkte Material zurückliegst' },
  'win-streak': {
    t: 'Siegesserie', d: 'Gewinne Partie um Partie, ohne Remis oder Niederlage dazwischen',
    steps: [
      ['3 Siege in Folge', 'Gewinne drei Partien hintereinander'],
      ['5 Siege in Folge', 'Gewinne fünf Partien hintereinander'],
      ['10 Siege in Folge', 'Gewinne zehn Partien hintereinander'],
      ['25 Siege in Folge', 'Gewinne fünfundzwanzig Partien hintereinander'],
    ],
  },
  'best-win': {
    t: 'Stärkster besiegter Gegner', d: 'Besiege immer stärkere Gegner',
    steps: [1600, 1800, 2000, 2200].map((n) => [`${n}er besiegt`, `Besiege einen Gegner mit einer Wertung von mindestens ${n}`]),
  },

  // Win Conditions
  'win-checkmate': { t: 'Sieg durch Matt', d: 'Gewinne eine Partie durch Schachmatt' },
  'win-resign': { t: 'Sieg durch Aufgabe', d: 'Gewinne eine Partie, weil dein Gegner aufgibt' },
  'flag-opponent': { t: 'Sieg auf Zeit', d: 'Gewinne, weil deinem Gegner die Zeit ausgeht' },
  'win-abandon': { t: 'Sieg durch Verlassen', d: 'Gewinne eine Partie, weil dein Gegner sie verlassen hat' },
  'stalemate-forced': { t: 'Gegner patt gesetzt', d: 'Setze deinen Gegner patt – ihm bleibt kein legaler Zug, dir nur ein halber Punkt' },
  'stalemate-received': { t: 'Selbst patt gesetzt', d: 'Werde selbst patt gesetzt und rette einen halben Punkt aus einer verlorenen Partie' },

  // Board Antics
  'queen-party': { t: 'Mehrere Damen', d: 'Habe mehr als eine eigene Dame gleichzeitig auf dem Brett' },
  'underpromote-knight': { t: 'Umwandlung in einen Springer', d: 'Wandle einen Bauern in einen Springer um' },
  'underpromote-bishop': { t: 'Umwandlung in einen Läufer', d: 'Wandle einen Bauern in einen Läufer um' },
  'underpromote-rook': { t: 'Umwandlung in einen Turm', d: 'Wandle einen Bauern in einen Turm um' },
  'promotion-party': { t: 'Alle vier Umwandlungen', d: 'Wandle in einer Partie in Dame, Turm, Läufer und Springer um' },
  'takes-takes-takes': { t: 'Schlagen, schlagen, schlagen', d: 'Schlage mit drei deiner Züge in Folge' },
  'en-passant': { t: 'En passant', d: 'Schlage einen Bauern en passant' },
  'promotions': {
    t: 'Umwandlungen', d: 'Wandle mehrere Bauern in einer einzigen Partie um',
    steps: [
      ['Zwei Umwandlungen', 'Wandle in einer Partie zwei Bauern um'],
      ['Drei Umwandlungen', 'Wandle in einer Partie drei Bauern um'],
      ['Fünf Umwandlungen', 'Wandle in einer Partie fünf Bauern um'],
      ['Acht Umwandlungen', 'Wandle in einer Partie alle acht Bauern um'],
    ],
  },

  // Openings: White (the details are move lists and stay as they are)
  'opening-italian': { t: 'Italienische Partie' },
  'opening-ruylopez': { t: 'Spanische Partie' },
  'opening-scotch': { t: 'Schottische Partie' },
  'opening-queensgambit': { t: 'Damengambit' },
  'opening-kingsgambit': { t: 'Königsgambit' },
  'opening-english': { t: 'Englische Eröffnung' },
  'opening-reti': { t: 'Réti-Eröffnung' },
  'opening-grob': { t: 'Grob-Angriff' },
  'opening-bongcloud': { t: 'Bongcloud' },
  'opening-huebschgambit': { t: 'Hübsch-Gambit' },
  'opening-london': { t: 'Londoner System' },
  'opening-vienna': { t: 'Wiener Partie' },
  'opening-bishopsopening': { t: 'Läuferspiel' },
  'opening-catalan': { t: 'Katalanische Eröffnung' },
  'opening-larsen': { t: 'Nimzowitsch-Larsen-Angriff' },
  'opening-trompowsky': { t: 'Trompowsky-Angriff' },
  'opening-fourknights': { t: 'Vierspringerspiel' },

  // Openings: Black
  'opening-sicilian': { t: 'Sizilianische Verteidigung' },
  'opening-carokann': { t: 'Caro-Kann-Verteidigung' },
  'opening-scandinavian': { t: 'Skandinavische Verteidigung' },
  'opening-pirc': { t: 'Pirc-Verteidigung' },
  'opening-french': { t: 'Französische Verteidigung' },
  'opening-indiandefense': { t: 'Indische Verteidigung' },
  'opening-doublebongcloud': { t: 'Doppel-Bongcloud' },
  'opening-kingsindian': { t: 'Königsindische Verteidigung' },
  'opening-nimzoindian': { t: 'Nimzowitsch-Indische Verteidigung' },
  'opening-grunfeld': { t: 'Grünfeld-Indische Verteidigung' },
  'opening-qgd': { t: 'Abgelehntes Damengambit' },
  'opening-slav': { t: 'Slawische Verteidigung' },
  'opening-alekhine': { t: 'Aljechin-Verteidigung' },
  'opening-philidor': { t: 'Philidor-Verteidigung' },
  'opening-petrov': { t: 'Russische Verteidigung' },

  // Opening Collections
  'openings-allwhite': { t: 'Alle zwanzig ersten Züge', d: 'Spiele als Weiß alle zwanzig möglichen ersten Züge' },
  'openings-abcde': { t: 'Alle fünf ECO-Bände', d: 'Spiele eine Eröffnung aus jedem der fünf ECO-Bände, A bis E' },
  'openings-eco-a': eco('A'),
  'openings-eco-b': eco('B'),
  'openings-eco-c': eco('C'),
  'openings-eco-d': eco('D'),
  'openings-eco-e': eco('E'),
  'openings-eu': { t: 'Eröffnungen der EU', d: 'Spiele zu jedem EU-Mitgliedstaat eine passende Eröffnung' },
  'openings-scary': { t: 'Gruselige Eröffnungen', d: 'Spiele richtig gruselige Eröffnungen' },
  'openings-fantasy': { t: 'Fantasy-Eröffnungen', d: 'Spiele Eröffnungen mit Fantasy-Namen' },
  'openings-zoo': { t: 'Tier-Eröffnungen', d: 'Spiele zu jedem Tier eine Eröffnung' },
  'openings-champions': { t: 'Eröffnungen der Weltmeister', d: 'Spiele zu jedem Weltmeister eine nach ihm benannte Eröffnung' },
  'openings-beverages': { t: 'Getränke-Eröffnungen', d: 'Spiele Eröffnungen mit Getränke-Namen' },
  'opening-loyalty': {
    t: 'Lieblingseröffnung', d: 'Kehre immer wieder zu einer Lieblingseröffnung zurück',
    steps: [
      ['25-mal gespielt', 'Spiele eine Eröffnung (gleicher ECO-Code) 25-mal'],
      ['100-mal gespielt', 'Spiele eine Eröffnung 100-mal'],
      ['500-mal gespielt', 'Spiele eine Eröffnung 500-mal'],
    ],
  },

  // Time Controls
  'play-ultrabullet': speed('UltraBullet', 'eine UltraBullet-Partie', 'UltraBullet-Partien'),
  'play-bullet': speed('Bullet', 'eine Bulletpartie', 'Bulletpartien'),
  'play-blitz': speed('Blitz', 'eine Blitzpartie', 'Blitzpartien'),
  'play-rapid': speed('Schnellschach', 'eine Schnellschachpartie', 'Schnellschachpartien'),
  'play-classical': speed('Klassisch', 'eine klassische Partie', 'klassische Partien'),
  'play-correspondence': speed('Fernschach', 'eine Fernschachpartie', 'Fernschachpartien'),
  'clock-hyperbullet': { t: 'Hyperbullet', d: 'Spiele eine Partie mit höchstens 30 Sekunden Grundbedenkzeit' },
  'clock-increment': { t: 'Großes Inkrement', d: 'Spiele eine Partie mit mindestens 30 Sekunden Inkrement' },
  'clock-slowburn': { t: 'Lange Bedenkzeit', d: 'Spiele eine Partie mit mindestens 30 Minuten Grundbedenkzeit' },

  // Variants
  'variant-crazyhouse': variant('Crazyhouse'),
  'variant-chess960': variant('Chess960'),
  'variant-kingofthehill': variant('King of the Hill'),
  'variant-threecheck': variant('Three-Check'),
  'variant-antichess': variant('Antichess'),
  'variant-atomic': variant('Atomic'),
  'variant-horde': variant('Horde'),
  'variant-racingkings': variant('Racing Kings'),

  // Game Types
  'source-simul': { t: 'Simultan', d: 'Spiele eine Partie in einer Simultanvorstellung' },
  'source-position': { t: 'Eigene Stellung', d: 'Spiele eine Partie aus einer selbst aufgebauten Stellung' },
  'source-friend': { t: 'Freundschaftspartie', d: 'Spiele eine Herausforderung gegen einen Freund' },
  'casual-win': { t: 'Ungewerteter Sieg', d: 'Gewinne eine ungewertete Partie' },

  // Machines
  'play-computer': { t: 'Gegen den Computer', d: 'Spiele eine Partie gegen den Computer' },
  'beat-stockfish': {
    t: 'Stockfish besiegen', d: 'Besiege den Lichess-Computer Stufe um Stufe, aus der normalen Grundstellung',
    steps: [1, 2, 3, 4, 5, 6, 7, 8].map((n) => [`Stufe ${n}`, `Besiege den Lichess-Computer auf Stufe ${n}`]),
  },
  'beat-maia': {
    t: 'Maia besiegen', d: 'Besiege Maia, die Engine, die wie ein Mensch spielen soll, aus der normalen Grundstellung',
    steps: [1, 5, 9].map((n, i) => [`Maia ${n}`, `Besiege maia${n}, das Netz, das von Spielern mit ${[1100, 1500, 1900][i]} Wertung gelernt hat`]),
  },

  // Milestones
  'play': {
    t: 'Gespielte Partien', d: 'Spiele immer mehr Partien, von der ersten bis zur hunderttausendsten',
    steps: [
      ['Die erste Partie', 'Spiele deine erste Partie'],
      ['Einsteiger', 'Spiele 10 Partien'],
      ['Stammspieler', 'Spiele 100 Partien'],
      ['Vielspieler', 'Spiele 1.000 Partien'],
      ['Veteran', 'Spiele 10.000 Partien'],
      ['Legende', 'Spiele 100.000 Partien'],
    ],
  },
  'account-age': {
    t: 'Kontoalter', d: 'Bleib Jahr für Jahr dabei',
    steps: [
      ['Ein Jahr dabei', 'Habe ein Konto, das mindestens ein Jahr alt ist'],
      ['Fünf Jahre dabei', 'Habe ein Konto, das mindestens fünf Jahre alt ist'],
      ['Zehn Jahre dabei', 'Habe ein Konto, das mindestens zehn Jahre alt ist'],
    ],
  },

  // Ratings
  'rating-bullet': rating('Bullet-Wertung', 'im Bullet'),
  'rating-blitz': rating('Blitz-Wertung', 'im Blitz'),
  'rating-rapid': rating('Schnellschach-Wertung', 'im Schnellschach'),
  'rating-classical': rating('Klassische Wertung', 'in klassischen Partien'),
  'rating-established': { t: 'Feste Wertung', d: 'Lass in einer beliebigen Spielart die vorläufige Wertung hinter dir' },
  'rating-gain': {
    t: 'Großer Wertungsgewinn', d: 'Gewinne in einer einzigen Partie viele Wertungspunkte, sobald deine Wertung nicht mehr vorläufig ist',
    steps: [50, 100, 200, 300].map((n) => [`+${n} Punkte`, `Gewinne ${n} Wertungspunkte in einer Partie`]),
  },
  'rating-loss': {
    t: 'Großer Wertungsverlust', d: 'Verliere in einer einzigen Partie viele Wertungspunkte, sobald deine Wertung nicht mehr vorläufig ist',
    steps: [50, 100, 200, 300].map((n) => [`−${n} Punkte`, `Verliere ${n} Wertungspunkte in einer Partie`]),
  },

  // Records
  'wins': {
    t: 'Siege', d: 'Sammle immer mehr Siege',
    steps: [
      ['Erster Sieg', 'Gewinne deine erste Partie'],
      ['10 Siege', 'Gewinne 10 Partien'],
      ['100 Siege', 'Gewinne 100 Partien'],
      ['1.000 Siege', 'Gewinne 1.000 Partien'],
    ],
  },
  'losses': {
    t: 'Niederlagen', d: 'Aus jeder Niederlage lernt man etwas',
    steps: [
      ['Erste Niederlage', 'Verliere eine Partie'],
      ['10 Niederlagen', 'Verliere 10 Partien'],
      ['100 Niederlagen', 'Verliere 100 Partien'],
      ['1.000 Niederlagen', 'Verliere 1.000 Partien'],
    ],
  },
  'draws': {
    t: 'Remis', d: 'Teile dir den Punkt',
    steps: [
      ['Erstes Remis', 'Spiele eine Partie remis'],
      ['10 Remis', 'Spiele 10 Partien remis'],
      ['100 Remis', 'Spiele 100 Partien remis'],
    ],
  },
  'rated': {
    t: 'Gewertete Partien', d: 'Setze deine Wertung aufs Spiel',
    steps: [
      ['100 gewertete Partien', 'Spiele 100 gewertete Partien'],
      ['1.000 gewertete Partien', 'Spiele 1.000 gewertete Partien'],
      ['10.000 gewertete Partien', 'Spiele 10.000 gewertete Partien'],
    ],
  },
  'disconnects': {
    t: 'Verbindung verloren', d: 'Partien, die dir das Netzwerk genommen hat',
    steps: [
      ['Erster Abbruch', 'Verliere während einer Partie die Verbindung'],
      ['10 Abbrüche', 'Verliere in 10 Partien die Verbindung'],
      ['100 Abbrüche', 'Verliere in 100 Partien die Verbindung'],
    ],
  },
  'loss-streak': {
    t: 'Niederlagenserie', d: 'Überstehe eine Serie von Niederlagen',
    steps: [
      ['3 Niederlagen in Folge', 'Verliere drei Partien hintereinander'],
      ['5 Niederlagen in Folge', 'Verliere fünf Partien hintereinander'],
      ['10 Niederlagen in Folge', 'Verliere zehn Partien hintereinander'],
    ],
  },

  // Precision
  'accuracy': {
    t: 'Genauigkeit', d: 'Spiele eine analysierte Partie mit hoher Genauigkeit',
    steps: [90, 95, 99].map((n) => [`${n} % Genauigkeit`, `Beende eine analysierte Partie mit ${n} % Genauigkeit`]),
  },
  'no-blunders': { t: 'Ohne Patzer', d: 'Gewinne eine analysierte Partie von mindestens 25 Zügen ohne einen einzigen Patzer' },
  'spotless': { t: 'Fehlerfrei', d: 'Gewinne eine analysierte Partie von mindestens 20 Zügen ohne Ungenauigkeit, Fehler oder Patzer' },
  'low-acpl': { t: 'Kaum Centipawn-Verlust', d: 'Verliere in einer analysierten Partie von mindestens 30 Zügen im Schnitt weniger als 20 Centipawns pro Zug' },
  'endgame-precision': { t: 'Präzises Endspiel', d: 'Erreiche 90 % Genauigkeit im Endspiel einer analysierten Partie' },
  'outplayed': { t: 'Klar überlegen', d: 'Gewinne eine analysierte Partie mit mindestens 20 Prozentpunkten mehr Genauigkeit als dein Gegner' },

  // Puzzles
  'puzzle-solve': {
    t: 'Gelöste Aufgaben', d: 'Arbeite dich durch die Taktikaufgaben',
    steps: [
      ['Erste Aufgabe', 'Löse eine Lichess-Aufgabe'],
      ['10 Aufgaben', 'Löse 10 Aufgaben'],
      ['100 Aufgaben', 'Löse 100 Aufgaben'],
      ['1.000 Aufgaben', 'Löse 1.000 Aufgaben'],
      ['10.000 Aufgaben', 'Löse 10.000 Aufgaben'],
    ],
  },
  'puzzle-rating': {
    t: 'Aufgabenwertung', d: 'Steigere deine Wertung bei den Taktikaufgaben',
    steps: [1000, 1500, 2000, 2500].map((n) => [`Wertung ${n}`, `Erreiche eine Aufgabenwertung von ${n}`]),
  },
  'storm': {
    t: 'Puzzle Storm', d: 'Jage einen höheren Puzzle-Storm-Rekord',
    steps: [
      ['Storm gespielt', 'Spiele Puzzle Storm'],
      ['50 Punkte', 'Erziele 50 Punkte in Puzzle Storm'],
      ['100 Punkte', 'Erziele 100 Punkte in Puzzle Storm'],
    ],
  },
  'storm-combo': {
    t: 'Storm-Kombo', d: 'Halte in Puzzle Storm eine Kombo am Leben',
    steps: [10, 20, 30, 50].map((n) => [`Kombo ${n}`, `Erreiche in einem Puzzle-Storm-Lauf eine Kombo von ${n}`]),
  },
  'storm-highest': {
    t: 'Schwerste Storm-Aufgabe', d: 'Knacke unter Zeitdruck immer schwerere Aufgaben',
    steps: [1500, 2000, 2500].map((n) => [`${n}er gelöst`, `Löse in einem Puzzle-Storm-Lauf eine Aufgabe mit Wertung ${n}`]),
  },
  'storm-binge': {
    t: 'Storm-Läufe an einem Tag', d: 'Spiele viele Puzzle-Storm-Läufe an einem einzigen Tag',
    steps: [
      ['5 Läufe', 'Spiele fünf Puzzle-Storm-Läufe an einem Tag'],
      ['10 Läufe', 'Spiele 10 Puzzle-Storm-Läufe an einem Tag'],
      ['25 Läufe', 'Spiele 25 Puzzle-Storm-Läufe an einem Tag'],
    ],
  },
  'racer': {
    t: 'Puzzle Racer', d: 'Jage einen höheren Puzzle-Racer-Rekord',
    steps: [
      ['Racer gespielt', 'Spiele Puzzle Racer'],
      ['50 Punkte', 'Erziele 50 Punkte in Puzzle Racer'],
      ['100 Punkte', 'Erziele 100 Punkte in Puzzle Racer'],
    ],
  },
  'streak': {
    t: 'Puzzle Streak', d: 'Verlängere deine Puzzle-Streak-Serie',
    steps: [
      ['Streak gespielt', 'Spiele Puzzle Streak'],
      ['Serie von 50', 'Erreiche eine Serie von 50'],
      ['Serie von 100', 'Erreiche eine Serie von 100'],
    ],
  },
  'puzzle-theme': { t: 'Themen-Spezialist', d: 'Löse mindestens 50 Aufgaben eines einzigen Themas' },
  'puzzle-performance': {
    t: 'Aufgaben-Performance', d: 'Steigere deine Performance im Aufgaben-Dashboard',
    steps: [1800, 2000, 2200, 2400].map((n) => [`Performance ${n}`, `Erreiche eine Aufgaben-Performance von ${n}`]),
  },

  // Profile & Community
  'profile-flag': { t: 'Flagge gesetzt', d: 'Lege die Flagge deines Landes oder deiner Region fest' },
  'profile-bio': { t: 'Profiltext', d: 'Schreibe einen Profiltext' },
  'profile-name': { t: 'Echter Name', d: 'Gib deinen echten Namen an' },
  'profile-fide': { t: 'FIDE verknüpft', d: 'Verknüpfe eine FIDE-Wertung oder FIDE-ID' },
  'account-title': { t: 'Titelträger', d: 'Trage einen Titel auf Lichess' },
  'account-verified': { t: 'Verifiziert', d: 'Lass dein Konto verifizieren' },
  'support-patron': { t: 'Patron', d: 'Werde Lichess-Patron' },
  'account-flair': { t: 'Flair', d: 'Wähle ein Flair für dein Profil' },
  'count-bookmark': { t: 'Lesezeichen', d: 'Setze ein Lesezeichen auf eine Partie' },
  'count-import': { t: 'Partie importiert', d: 'Importiere eine Partie' },
  'account-streamer': { t: 'Streamer', d: 'Sei ein Lichess-Streamer' },

  // Dedication
  'playtime': {
    t: 'Spielzeit', d: 'Sammle Stunden am Brett',
    steps: [
      ['Eine Stunde', 'Spiele insgesamt eine Stunde'],
      ['Ein ganzer Tag', 'Spiele insgesamt 24 Stunden'],
      ['100 Stunden', 'Spiele insgesamt 100 Stunden'],
      ['1.000 Stunden', 'Spiele insgesamt 1.000 Stunden'],
    ],
  },
  'tv-time': { t: 'Auf Lichess TV', d: 'Werde auf Lichess TV gezeigt' },
  'session-games': { t: 'Viele Partien am Stück', d: 'Spiele mindestens 20 Partien in einer Sitzung' },
  'session-time': { t: 'Lange Sitzung', d: 'Spiele zwei Stunden am Stück' },
  'days-streak': {
    t: 'Tag für Tag', d: 'Spiele Tag für Tag, ohne einen auszulassen',
    steps: [
      ['Eine Woche', 'Spiele an sieben Tagen in Folge'],
      ['Zwei Wochen', 'Spiele an 14 Tagen in Folge'],
      ['Ein ganzer Monat', 'Spiele an 30 Tagen in Folge'],
      ['Hundert Tage', 'Spiele an 100 Tagen in Folge'],
      ['Ein ganzes Jahr', 'Spiele an 365 Tagen in Folge'],
    ],
  },

  // Notable Games
  'miniature': { t: 'Miniatur', d: 'Gewinne eine Partie in höchstens 10 Zügen' },
  'marathon': {
    t: 'Lange Partien', d: 'Spiele immer längere Partien',
    steps: [60, 80, 100, 120].map((n) => [`${n} Züge`, `Spiele eine Partie mit mindestens ${n} Zügen`]),
  },
  'scholars-mate': { t: 'Schäfermatt', d: 'Setze in den ersten vier Zügen mit der Dame matt' },
  'fools-mate': { t: 'Narrenmatt', d: 'Setze mit dem Narrenmatt in zwei Zügen matt' },
  'night-owl': { t: 'Nachtpartie', d: 'Spiele eine Partie zwischen Mitternacht und 5 Uhr morgens (deine Ortszeit)' },
  'quickfire': { t: 'Sieg in sechs Zügen', d: 'Gewinne eine Partie in höchstens sechs Zügen' },
  'so-close': { t: 'Knapp daneben', d: 'Verliere eine Partie, in der du mindestens zehnmal Schach gegeben hast' },
  'bongcloud-victory': { t: 'Sieg mit Bongcloud', d: 'Gewinne eine Partie nach der Bongcloud-Eröffnung (1. e4 e5 2. Ke2)' },
  'long-endgame': { t: 'Langes Endspiel', d: 'Spiele eine Partie, deren Endspiel mindestens 40 Halbzüge dauerte' },
  'book-ending': { t: 'Sieg vor dem Mittelspiel', d: 'Gewinne eine Partie, die endete, bevor das Mittelspiel begann' },

  // Social
  'teams': {
    t: 'Teams', d: 'Werde Teil der Community',
    steps: [
      ['Erstes Team', 'Tritt einem Team bei'],
      ['Drei Teams', 'Sei Mitglied in drei Teams'],
      ['Zehn Teams', 'Sei Mitglied in zehn Teams'],
    ],
  },
  'follow': {
    t: 'Folgen', d: 'Baue dein Netzwerk auf',
    steps: [
      ['Erster Spieler', 'Folge einem anderen Spieler'],
      ['Zehn Spieler', 'Folge zehn Spielern'],
      ['Fünfzig Spieler', 'Folge fünfzig Spielern'],
    ],
  },
  'study-write': { t: 'Studie erstellt', d: 'Erstelle eine Studie' },

  // Tournaments
  'arena-play': { t: 'Arena-Teilnahme', d: 'Spiele in einem Arena-Turnier mit' },
  'arena-host': { t: 'Turnier veranstaltet', d: 'Erstelle ein eigenes Turnier' },
  'arena-podium': { t: 'Auf dem Podest', d: 'Belege in einer Arena einen der ersten drei Plätze' },
  'arena-win': { t: 'Arena gewonnen', d: 'Gewinne ein Arena-Turnier' },
  'arena-warrior': { t: 'Sieg in der Arena', d: 'Gewinne eine Partie in einem Arena-Turnier' },
  'swiss-play': { t: 'Schweizer Turnier', d: 'Spiele eine Partie in einem Schweizer Turnier' },
  'swiss-win': { t: 'Sieg im Schweizer Turnier', d: 'Gewinne eine Partie in einem Schweizer Turnier' },
  'arena-points': {
    t: 'Arena-Punkte', d: 'Sammle mit der Zeit Arena-Punkte',
    steps: [
      ['100 Punkte', 'Erziele insgesamt 100 Arena-Punkte'],
      ['1.000 Punkte', 'Erziele insgesamt 1.000 Arena-Punkte'],
      ['10.000 Punkte', 'Erziele insgesamt 10.000 Arena-Punkte'],
    ],
  },
  'tournament-games': {
    t: 'Turnierpartien', d: 'Sammle Partien in Turnieren',
    steps: [
      ['10 Turnierpartien', 'Spiele 10 Turnierpartien'],
      ['100 Turnierpartien', 'Spiele 100 Turnierpartien'],
      ['1.000 Turnierpartien', 'Spiele 1.000 Turnierpartien'],
      ['5.000 Turnierpartien', 'Spiele 5.000 Turnierpartien'],
    ],
  },
  'berserk': {
    t: 'Berserk', d: 'Halbiere deine Bedenkzeit für doppelten Ruhm',
    steps: [
      ['Erster Berserk', 'Spiele eine Turnierpartie mit Berserk'],
      ['10-mal Berserk', 'Spiele 10 Turnierpartien mit Berserk'],
      ['100-mal Berserk', 'Spiele 100 Turnierpartien mit Berserk'],
      ['1.000-mal Berserk', 'Spiele 1.000 Turnierpartien mit Berserk'],
    ],
  },
};
