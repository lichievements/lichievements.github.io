import { Chess } from './chess.js'

// Function to display achievements
function displayAchievements(achievements) {
    const container = document.getElementById('achievements-container');

    for (const category in achievements) {
        // Create and append the category title
        const heading = document.createElement('h2');
        heading.textContent = category; // Capitalize first letter
        container.appendChild(heading);
        
        const achivement_category = document.createElement('div');
        achivement_category.classList.add('achievement-category');
        container.appendChild(achivement_category);

        achievements[category].forEach(achievement => {
            // Create a div for each achievement
            const achievementDiv = document.createElement('div');
            achievementDiv.classList.add('achievement');

            // Create an img element for the achievement image
            const imgElement = document.createElement('img');
            imgElement.src = 'images/locked.png'; 
            imgElement.classList.add('achievement-image');
            imgElement.id = achievement.id;
            
            // Create a div for both spans below
            const tooltipDiv = document.createElement('div');
            tooltipDiv.classList.add('tooltip');
            
            // Create a span element for the title
            const spanElement = document.createElement('span');
            spanElement.textContent = achievement.title;
            spanElement.id = achievement.id + "-tooltip-title"
            spanElement.classList.add('tooltip-text');
            spanElement.classList.add('tooltip-title');

            // Create a span element for the details
            const spanElement2 = document.createElement('span');
            //spanElement2.textContent = achievement.details;
            spanElement2.id = achievement.id + "-tooltip-details"
            spanElement2.classList.add('tooltip-text');
            spanElement2.classList.add('tooltip-details');

            // Append the img to the achievement div, and the div to the container
            achievementDiv.appendChild(imgElement);
            tooltipDiv.appendChild(spanElement);
            tooltipDiv.appendChild(spanElement2);
            achievementDiv.appendChild(tooltipDiv);
            achivement_category.appendChild(achievementDiv);
        });
    }
}

let achievementsJSON;

// Load achievements data from data.json and then display achievements
fetch('achievements.json')
    .then(response => response.json())
    .then(data => {
        displayAchievements(data);
        achievementsJSON = data;
    })
    .catch(error => console.error('Error loading achievements data:', error));



let userNotFound;

async function fetchUserData(username) {
    console.log("Starting with fetchUserData()...")
    
    const urls = [
        `https://lichess.org/api/games/user/${username}?rated=true&color=white`,
        `https://lichess.org/api/games/user/${username}?rated=true&color=black`,
        `https://lichess.org/api/user/${username}`
    ];

    try {
        const fetchPromises = urls.map(url =>
            fetch(url, { headers: { 'Accept': 'application/x-ndjson' } })
        );

        const responses = await Promise.all(fetchPromises);

        // Check if any of the responses have a 404 status code
        userNotFound = responses.some(response => response.status === 404);
        if (userNotFound) {
            // Handle the case where the user does not exist
            console.error("User does not exist.");
            document.getElementById("loading-div").innerHTML = 'This user does not exist.';
            return null; 
        }

        // Assuming all requests were successful, proceed to process the responses
        const [gamesWhiteText, gamesBlackText, userResponse] = await Promise.all(responses.map(res => res.text()));

        const gamesWhite = gamesWhiteText.trim().split('\n').map(JSON.parse);
        const gamesBlack = gamesBlackText.trim().split('\n').map(JSON.parse);
        const userData = JSON.parse(userResponse); // Assuming the user API returns JSON, not NDJSON

        return { gamesWhite, gamesBlack, userData };
    } catch (error) {
        console.error("Error fetching data:", error);
        throw error; 
    }
}


function resetAchievements() {
    const ach = document.getElementsByClassName('achievement-image');

    for (let i = 0; i < ach.length; i++) {
        ach[i].src = 'images/locked.png';
    }
    
    // reset tooltips
    let resetTooltips = document.querySelectorAll('span.tooltip-title');
    resetTooltips.forEach(span => {
        let title;
        let id = span.id.substring(0, span.id.length - 14);
        
        Object.keys(achievementsJSON).forEach(category => {
            const items = achievementsJSON[category];
            // Find the item in the category that matches the given id
            const item = items.find(item => item.id === id);
            if (item) {
                title = item.title;
            }
        });
        
        span.textContent = title;
    });
    resetTooltips = document.querySelectorAll('span.tooltip-details');
    resetTooltips.forEach(span => {        
        span.textContent = '';
    });
    
    document.getElementById('summary').innerHTML = '';
}

async function checkAchievements() { // this function gets called by the input button
    
    // Reset achievements, reset summary at the bottom
    resetAchievements(); 
    
    // Create loading icon
    let loadDiv = document.getElementById("loading-div");
    loadDiv.innerHTML = '<i id="loading-icon" class="fa-solid fa-spinner"></i>&ensp;Loading games...'

    const username = document.getElementById('username').value.trim(); // trim removes leading and trailing whitespace
    let gamesWhite, gamesBlack, userData;
    
    try {
        const data = await fetchUserData(username);
        gamesWhite = data.gamesWhite;
        gamesBlack = data.gamesBlack;
        userData = data.userData;
    } catch (error) {
        console.error("Error checking achievements:", error);
    }
    
    // Now process the data for achievements
    processAchievements(gamesWhite, gamesBlack, userData, username, loadDiv);
    
    // Delete loading icon
    loadDiv.innerHTML = '';
    
    if (userNotFound) {
        document.getElementById("loading-div").innerHTML = 'This user does not exist.';
    }
    
}

async function processAchievements(gamesWhite, gamesBlack, userData, username, loadDiv) {
    console.log("processAchievements(..)")
    
    const numberOfGamesWhite = gamesWhite.length
    const numberOfGamesBlack = gamesBlack.length
    const numberOfGamesTotal = numberOfGamesWhite + numberOfGamesBlack
    
    // At the start, no achievement is unlocked
    let objectAchievements = {}; // object to track opening achievements
    
    for (let i = 0; i < achievementsJSON["Openings: White"].length; i++) {
        objectAchievements[achievementsJSON["Openings: White"][i].id] = false;
    };
    for (let i = 0; i < achievementsJSON["Openings: Black"].length; i++) {
        objectAchievements[achievementsJSON["Openings: Black"][i].id] = false;
    };

    let found_mate_queen = false;
    let found_mate_rook = false;
    let found_mate_bishop = false;
    let found_mate_knight = false;
    let found_mate_castle_short = false;
    let found_mate_castle_long = false;
    
    let pacifist_win = false;
    let flag_opponent = false;
    
    let firstMovesWhite = ["a3", "a4", 
                           "b3", "b4", 
                           "c3", "c4", 
                           "d3", "d4", 
                           "e3", "e4", 
                           "f3", "f4", 
                           "g3", "g4", 
                           "h3", "h4", 
                           "Na3", "Nc3", 
                           "Nf3", "Nh3"
                           ];
    
    let openingsEU = ["e4 e5 Nc3",                    // AT Vienna Game
                      "e4 c5 Nf3 f5",                 // BE Sicilian Defense: Brussels Gambit
                      "e4 e5 Nf3 Nc6 Bb5 a5",         // BG Ruy Lopez: Bulgarian Variation
                      "e4 e6 d4 Nf6",                 // CY French Defense: Mediterranean Defense
                      "e4 d6 d4 Nf6 Nc3 c6",          // CZ Czech Defense
                      "e4 e5 Nf3 Nc6 Bb5 Nf6",        // DE Ruy Lopez: Berlin Defense
                      "e4 e5 d4 exd4 c3",             // DK Danish Gambit
                      "d4 d5 c4 Bf5",                 // EE Queens Gambit Declined: Baltic Defense
                      "e4 e5 Nf3 Nc6 Bb5",            // ES Ruy Lopez (Spanish Game)
                      "e4 c6 d4 d5 Nd2 dxe4 Nxe4 h6", // FI Caro-Kann Defense Finnish Variation
                      "e4 e6",                        // FR French Defense
                      "e4 b6",                        // GR Greek Defense (aka Owen's Defense)
                      "e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 g3", // HR Sicilian Defense: Najdorf Variation: Zagreb Variation
                      "g3",                           // HU Hungarian Opening
                      "e4 e5 Nf3 Nc6 Nxe5",           // IE Irish Gambit
                      "e4 e5 Nf3 Nc6 Bc4",            // IT Italian Game
                      "d4 Nc6 c4 e5 d5 Nce7",         // LT Mikenas Defense: Lithuanian Variation
                      "e4 e5 Nf3 Nc6 Bb5 Nf6 O-O Bc5 c3 O-O d4 Bb6", // LU Ruy Lopez: Classical Defense: Benelux Variation
                      "e4 e5 Nf3 f5",                 // LV Latvian Gambit
                      "d4 Nf6 g4 Nxg4 f3 Nf6 e4",     // MT Indian Defense: Gibbins-Weidenhagen Gambit: Maltese Falcon
                      "d4 f5",                        // NL Dutch Defense
                      "d4 b5",                        // PL Polish Defense
                      "e4 e5 Bb5",                    // PT Portuguese_Opening
                      "e4 c5 b4 cxb4 a3 d5 exd5 Qxd5 Nf3 e5 Bb2 Nc6 c4 Qe6", // RO Sicilian Defense: Wing Gambit: Romanian Defense
                      "d4 d5 c4 e6 Nc3 c5 cxd5 exd5 Nf3 Nc6 g3 c4", // SE Tarrasch Defense: Swedish Variation
                      "d4 Nf6 c4 c6",                 // SI Slav Indian
                      "d4 d5 c4 c6"                   // SK Slav Defense
                      ];
    
    let openingsScary = ["e4 e5 Nf3 Nc6 Bb5 Nf6 Nxe5", // Ruy Lopez: Halloween Attack
                         "e4 e5 Nf3 Nc6 Nc3 Nf6 Nxe5", // Four Knights Game: Halloween Gambit
                         "e4 e5 Nc3 Nf6 Bc4 Nxe4"      // Vienna Game: Frankenstein-Dracula Variation
                         ];
    
    let openingsFantasy = ["e4 f6 d4 b6 c4 Bb7",        // Owen Defense: Unicorn Variation
                           "e4 e5 Nf3 Nc6 c4 Nf6 Nxe5", // Dresden Opening: The Goblin
                           "d4 Nf6 c4 g5",              // Indian Defense: Medusa Gambit
                           "e4 c6 d4 d5 Nf3 dxe4 Ng5",  // Caro-Kann Defense: Ulysses Gambit
                           "e4 c6 d4 d5 Nc3 dxe4 Nxe4 Nf6 Ng5 h6 Nxf7" // Caro-Kann Defense: Alien Gambit
                           ];
    
    let openingsBeverages = ["d4 Nf6 c4 c5 d5 b5 cxb5 a6 Nc3 axb5 e4 b4 Nb5 d6 Bc4", // Benko Gambit: Nescafe Frappe Attack
                             "g4 g5 f4", // Grob Opening: Double Grob: Coca-Cola Gambit
                             "e4 e5 Nf3 Nc6 d4 exd4 Bc4", // Scotch Game: Scotch Gambit 
                             "Nf3 Na6 e4 Nh6" // Zukertort Opening: Drunken Cavalry Variation
                            ];
    
    let counter = 1; // this lets the user know where we're at with analyzing the games
    let achID;
    
    for (let i = 0; i < gamesWhite.length; i++) {
        const game = gamesWhite[i];
        let color = "white";
        let movesArray = game.moves.split(" ");
        let movesWhiteArray = game.moves.split(" ").filter((element, index) => index % 2 === 0);
        let movesBlackArray = game.moves.split(" ").filter((element, index) => index % 2 === 1);
        let movesWhiteString = movesWhiteArray.join(" ");
        let movesBlackString = movesBlackArray.join(" ");
        
        var chess = new Chess(); // using the chess.js library
        chess.load_pgn(game.moves);
        
        loadDiv.innerHTML = 'Analyzing game ' + i + '/' + numberOfGamesTotal;
        
        if (game.variant == "standard") {
        
            for (let i = 0; i < achievementsJSON["Openings: White"].length; i++) {
                achID = achievementsJSON["Openings: White"][i].id;
                if (!objectAchievements[achievementsJSON["Openings: White"][i].id] && game.moves.startsWith(achievementsJSON["Openings: White"][i].moves)) {
                    document.getElementById(achID).src = achievementsJSON["Openings: White"].find(item => item.id === achID).image;
                    document.getElementById(achID+'-tooltip-details').textContent = achievementsJSON["Openings: White"].find(item => item.id === achID).details;
                    document.getElementById(achID).setAttribute('data-game-id', game.id);
                    objectAchievements[achievementsJSON["Openings: White"][i].id] = true
                };
            };
            
            // takes, takes, takes
            if (movesWhiteString.includes("x")) {
                let streak = 0;
                for (let i = 0; i < movesWhiteArray.length; i++) {
                    if (movesWhiteArray[i].includes('x')) {
                        streak++; 
                        if (streak >= 3) {
                            achID = "takes-takes-takes";
                            document.getElementById(achID).src = achievementsJSON["Play Games"].find(item => item.id === achID).image;
                            document.getElementById(achID+'-tooltip-details').textContent = achievementsJSON["Play Games"].find(item => item.id === achID).details;
                            document.getElementById(achID).setAttribute('data-game-id', game.id);
                        }
                    } else {
                        streak = 0; 
                    }
                }
            }
            
            // lazy king
            if (!movesWhiteString.includes("K") && !movesWhiteString.includes("O-O") && !movesWhiteString.includes("O-O-O") && game.winner == color && game.status == "mate") {
                achID = "lazy-king";
                document.getElementById(achID).src = achievementsJSON["Win the Game"].find(item => item.id === achID).image;
                document.getElementById(achID+'-tooltip-details').textContent = achievementsJSON["Win the Game"].find(item => item.id === achID).details;
                document.getElementById(achID).setAttribute('data-game-id', game.id);
            }
            
            // lazy queen
            if (!movesWhiteString.includes("Q") && game.winner == color && game.status == "mate") {
                achID = "lazy-queen";
                document.getElementById(achID).src = achievementsJSON["Win the Game"].find(item => item.id === achID).image;
                document.getElementById(achID+'-tooltip-details').textContent = achievementsJSON["Win the Game"].find(item => item.id === achID).details;
                document.getElementById(achID).setAttribute('data-game-id', game.id);
            }
            
            // lazy rooks
            if (!movesWhiteString.includes("R") && !movesWhiteString.includes("O-O") && !movesWhiteString.includes("O-O-O") && game.winner == color && game.status == "mate") {
                achID = "lazy-rook";
                document.getElementById(achID).src = achievementsJSON["Win the Game"].find(item => item.id === achID).image;
                document.getElementById(achID+'-tooltip-details').textContent = achievementsJSON["Win the Game"].find(item => item.id === achID).details;
                document.getElementById(achID).setAttribute('data-game-id', game.id);
            }
            
            // lazy bishop
            if (!movesWhiteString.includes("B") && game.winner == color && game.status == "mate") {
                achID = "lazy-bishop";
                document.getElementById(achID).src = achievementsJSON["Win the Game"].find(item => item.id === achID).image;
                document.getElementById(achID+'-tooltip-details').textContent = achievementsJSON["Win the Game"].find(item => item.id === achID).details;
                document.getElementById(achID).setAttribute('data-game-id', game.id);
            }
            
            // lazy knight
            if (!movesWhiteString.includes("N") && game.winner == color && game.status == "mate") {
                achID = "lazy-knight";
                document.getElementById(achID).src = achievementsJSON["Win the Game"].find(item => item.id === achID).image;
                document.getElementById(achID+'-tooltip-details').textContent = achievementsJSON["Win the Game"].find(item => item.id === achID).details;
                document.getElementById(achID).setAttribute('data-game-id', game.id);
            }
            
            // kings journey
            if ((movesWhiteString.includes("Ka8") || movesWhiteString.includes("Kxa8") || movesWhiteString.includes("Kb8") || movesWhiteString.includes("Kxb8") || movesWhiteString.includes("Kc8") || movesWhiteString.includes("Kxc8") || movesWhiteString.includes("Kd8") || movesWhiteString.includes("Kxd8") || movesWhiteString.includes("Ke8") || movesWhiteString.includes("Kxe8") || movesWhiteString.includes("Kf8") || movesWhiteString.includes("Kxf8") || movesWhiteString.includes("Kg8") || movesWhiteString.includes("Kxg8") || movesWhiteString.includes("Kh8") || movesWhiteString.includes("Kxh8")) && game.winner == color) {
                achID = "kings-journey";
                document.getElementById(achID).src = achievementsJSON["Win the Game"].find(item => item.id === achID).image;
                document.getElementById(achID+'-tooltip-details').textContent = achievementsJSON["Win the Game"].find(item => item.id === achID).details;
                document.getElementById(achID).setAttribute('data-game-id', game.id);
            }
            
            // underpromote to everything
            if (movesWhiteString.includes("=Q") && movesWhiteString.includes("=R") && movesWhiteString.includes("=B") && movesWhiteString.includes("=N")) {
                achID = "promotion-party";
                document.getElementById(achID).src = achievementsJSON["Play Games"].find(item => item.id === achID).image;
                document.getElementById(achID+'-tooltip-details').textContent = achievementsJSON["Play Games"].find(item => item.id === achID).details;
                document.getElementById(achID).setAttribute('data-game-id', game.id);
            }
            
            // underpromote to a knight
            if (movesWhiteString.includes("=N")) {
                achID = "underpromote-knight";
                document.getElementById(achID).src = achievementsJSON["Play Games"].find(item => item.id === achID).image;
                document.getElementById(achID+'-tooltip-details').textContent = achievementsJSON["Play Games"].find(item => item.id === achID).details;
                document.getElementById(achID).setAttribute('data-game-id', game.id);
            }
            
            // underpromote to a bishop
            if (movesWhiteString.includes("=B")) {
                achID = "underpromote-bishop";
                document.getElementById(achID).src = achievementsJSON["Play Games"].find(item => item.id === achID).image;
                document.getElementById(achID+'-tooltip-details').textContent = achievementsJSON["Play Games"].find(item => item.id === achID).details;
                document.getElementById(achID).setAttribute('data-game-id', game.id);
            }
            
            // underpromote to a rook
            if (movesWhiteString.includes("=R")) {
                achID = "underpromote-rook";
                document.getElementById(achID).src = achievementsJSON["Play Games"].find(item => item.id === achID).image;
                document.getElementById(achID+'-tooltip-details').textContent = achievementsJSON["Play Games"].find(item => item.id === achID).details;
                document.getElementById(achID).setAttribute('data-game-id', game.id);
            }
            
            // underachiever
            if (game.winner == color && ["mate", "resign", "outoftime"].includes(game.status) && (movesWhiteString.includes("=R") || movesWhiteString.includes("=B") || movesWhiteString.includes("=N"))) {
                achID = "underachiever";
                document.getElementById(achID).src = achievementsJSON["Win the Game"].find(item => item.id === achID).image;
                document.getElementById(achID+'-tooltip-details').textContent = achievementsJSON["Win the Game"].find(item => item.id === achID).details;
                document.getElementById(achID).setAttribute('data-game-id', game.id);
            }
            
            // survivor
            if (game.winner == color && ["mate", "resign", "outoftime"].includes(game.status) && movesBlackString.includes("+")) {
                let regex = new RegExp("\\+", 'g');
                let checks = movesBlackString.match(regex) || [];
                let checksN = checks.length;
                if (checksN > 4) {
                    achID = "survivor";
                    document.getElementById(achID).src = achievementsJSON["Win the Game"].find(item => item.id === achID).image;
                    document.getElementById(achID+'-tooltip-details').textContent = achievementsJSON["Win the Game"].find(item => item.id === achID).details;
                    document.getElementById(achID).setAttribute('data-game-id', game.id);
                }
            }
            
            // queen party
            if (movesWhiteString.includes("=Q")) {
                var chess1 = new Chess();
                for (let move of movesArray){
                    chess1.move(move);
                    let matches = chess1.fen().split(' ')[0].match(/Q/g);
                    if (matches && matches.length > 1) {
                        achID = "queen-party";
                        document.getElementById(achID).src = achievementsJSON["Play Games"].find(item => item.id === achID).image;
                        document.getElementById(achID+'-tooltip-details').textContent = achievementsJSON["Play Games"].find(item => item.id === achID).details;
                        document.getElementById(achID).setAttribute('data-game-id', game.id);
                    }
                }
                
            }
            
            // eliminate those first moves that have been played, if the list is empty -> achievement
            for (let move of firstMovesWhite) {
                if (movesWhiteArray[0] === move) {
                    let index = firstMovesWhite.indexOf(move);
                    if (index !== -1) { // Check if the move is found in the array
                        firstMovesWhite.splice(index, 1); // Remove the move from the array
                    }
                }
            }
            if (firstMovesWhite.length === 0) {
                achID = "openings-allwhite";
                document.getElementById(achID).src = achievementsJSON["Openings: Collections"].find(item => item.id === achID).image;
                document.getElementById(achID+'-tooltip-details').textContent = achievementsJSON["Openings: Collections"].find(item => item.id === achID).details;
            }
            
            // eliminate openings from openings-eu
            for (let move of openingsEU) {
                if (game.moves.startsWith(move)) {
                    let index = openingsEU.indexOf(move);
                    if (index !== -1) { // Check if the move is found in the array
                        openingsEU.splice(index, 1); // Remove the move from the array
                    }
                }
            }
            if (openingsEU.length === 0) {
                achID = "openings-eu";
                document.getElementById(achID).src = achievementsJSON["Openings: Collections"].find(item => item.id === achID).image;
                document.getElementById(achID+'-tooltip-details').textContent = achievementsJSON["Openings: Collections"].find(item => item.id === achID).details;
            }
            
            // eliminate openings from openings-scary
            for (let move of openingsScary) {
                if (game.moves.startsWith(move)) {
                    let index = openingsScary.indexOf(move);
                    if (index !== -1) { // Check if the move is found in the array
                        openingsScary.splice(index, 1); // Remove the move from the array
                    }
                }
            }
            if (openingsScary.length === 0) {
                achID = "openings-scary";
                document.getElementById(achID).src = achievementsJSON["Openings: Collections"].find(item => item.id === achID).image;
                document.getElementById(achID+'-tooltip-details').textContent = achievementsJSON["Openings: Collections"].find(item => item.id === achID).details;
            }
            
            // eliminate openings from openings-fantasy
            for (let move of openingsFantasy) {
                if (game.moves.startsWith(move)) {
                    let index = openingsFantasy.indexOf(move);
                    if (index !== -1) { // Check if the move is found in the array
                        openingsFantasy.splice(index, 1); // Remove the move from the array
                    }
                }
            }
            if (openingsFantasy.length === 0) {
                achID = "openings-fantasy";
                document.getElementById(achID).src = achievementsJSON["Openings: Collections"].find(item => item.id === achID).image;
                document.getElementById(achID+'-tooltip-details').textContent = achievementsJSON["Openings: Collections"].find(item => item.id === achID).details;
            }
            
            // eliminate openings from openings-beverages
            for (let move of openingsBeverages) {
                if (game.moves.startsWith(move)) {
                    let index = openingsBeverages.indexOf(move);
                    if (index !== -1) { // Check if the move is found in the array
                        openingsBeverages.splice(index, 1); // Remove the move from the array
                    }
                }
            }
            if (openingsBeverages.length === 0) {
                achID = "openings-beverages";
                document.getElementById(achID).src = achievementsJSON["Openings: Collections"].find(item => item.id === achID).image;
                document.getElementById(achID+'-tooltip-details').textContent = achievementsJSON["Openings: Collections"].find(item => item.id === achID).details;
            }
            
            // check for pacifist win
            if (!pacifist_win && !game.moves.includes("x") && game.winner == color && game.status == "mate") {
                achID = "pacifist-win";
                document.getElementById(achID).src = achievementsJSON["Win the Game"].find(item => item.id === achID).image;
                document.getElementById(achID+'-tooltip-details').textContent = achievementsJSON["Win the Game"].find(item => item.id === achID).details;
                document.getElementById(achID).setAttribute('data-game-id', game.id);
                pacifist_win = true;
            }
            
            // check for flag the opponent
            if (!flag_opponent && game.status == "outoftime" && !game.moves.includes("#") && game.winner == color) {
                achID = "flag-opponent";
                document.getElementById(achID).src = achievementsJSON["Win the Game"].find(item => item.id === achID).image;
                document.getElementById(achID+'-tooltip-details').textContent = achievementsJSON["Win the Game"].find(item => item.id === achID).details;
                document.getElementById(achID).setAttribute('data-game-id', game.id);
                flag_opponent = true;
            }
            
            let list_of_speeds = ["ultraBullet", "bullet", "blitz", "rapid", "classical", "correspondence"];
            
            for (let i=0; i < list_of_speeds.length; i++) {
                if (game.speed == list_of_speeds[i]) {
                    achID = "play-" + list_of_speeds[i];
                    document.getElementById(achID).src = achievementsJSON["Play Games"].find(item => item.id === achID).image;
                    document.getElementById(achID+'-tooltip-details').textContent = achievementsJSON["Play Games"].find(item => item.id === achID).details;
                }
            }
            
            // Check for queen mate
            if (!found_mate_queen && game.winner == color && /Q[^ ]*#/.test(game.moves)) {
                document.getElementById('queen-mate').src = achievementsJSON["Win the Game"].find(item => item.id === 'queen-mate').image;
                document.getElementById('queen-mate-tooltip-details').textContent = achievementsJSON["Win the Game"].find(item => item.id === 'queen-mate').details;
                document.getElementById('queen-mate').setAttribute('data-game-id', game.id);
                found_mate_queen = true;
            };
            
            // Check for rook mate
            if (!found_mate_rook && game.winner == color && /R[^ ]*#/.test(game.moves)) {
                document.getElementById('rook-mate').src = achievementsJSON["Win the Game"].find(item => item.id === 'rook-mate').image;
                document.getElementById('rook-mate-tooltip-details').textContent = achievementsJSON["Win the Game"].find(item => item.id === 'rook-mate').details;
                document.getElementById('rook-mate').setAttribute('data-game-id', game.id);
                found_mate_rook = true;
            };
            
            // Check for bishop mate
            if (!found_mate_bishop && game.winner == color && /B[^ ]*#/.test(game.moves)) {
                document.getElementById('bishop-mate').src = achievementsJSON["Win the Game"].find(item => item.id === 'bishop-mate').image;
                document.getElementById('bishop-mate-tooltip-details').textContent = achievementsJSON["Win the Game"].find(item => item.id === 'bishop-mate').details;
                document.getElementById('bishop-mate').setAttribute('data-game-id', game.id);
                found_mate_bishop = true;
            };
            
            // Check for knight mate
            if (!found_mate_knight && game.winner == color && /N[^ ]*#/.test(game.moves)) {
                document.getElementById('knight-mate').src = achievementsJSON["Win the Game"].find(item => item.id === 'knight-mate').image;
                document.getElementById('knight-mate-tooltip-details').textContent = achievementsJSON["Win the Game"].find(item => item.id === 'knight-mate').details;
                document.getElementById('knight-mate').setAttribute('data-game-id', game.id);
                found_mate_knight = true;
            };
            
            // Check for short castle mate
            if (!found_mate_castle_short && game.winner == color && /O-O[^ ]*#/.test(game.moves)) {
                document.getElementById('short-castle-mate').src = achievementsJSON["Win the Game"].find(item => item.id === 'short-castle-mate').image;
                document.getElementById('short-castle-mate-tooltip-details').textContent = achievementsJSON["Win the Game"].find(item => item.id === 'short-castle-mate').details;
                document.getElementById('short-castle-mate').setAttribute('data-game-id', game.id);
                found_mate_castle_short = true;
            };
            
            // Check for long castle mate
            if (!found_mate_castle_long && game.winner == color && /O-O[^ ]*#/.test(game.moves)) {
                document.getElementById('long-castle-mate').src = achievementsJSON["Win the Game"].find(item => item.id === 'long-castle-mate').image;
                document.getElementById('long-castle-mate-tooltip-details').textContent = achievementsJSON["Win the Game"].find(item => item.id === 'long-castle-mate').details;
                document.getElementById('long-castle-mate').setAttribute('data-game-id', game.id);
                found_mate_castle_long = true;
            };
            
            // Check for en passant mate (as white)
            let possible_ends = ["a5 bxa6#", "b5 axb6#", "b5 cxb6#", "c5 bxc6#", "c5 dxc6#", "d5 cxd6#", "d5 exd6#", "e5 dxe6#", "e5 fxe6#", "f5 exf6#", "f5 gxf6#", "g5 fxg6#", "g5 hxg6#", "h5 gxh6#"];
            for (let i of possible_ends) {
                if (game.winner == color && game.moves.includes(i)) {
                    achID = "en-passant-mate";
                    document.getElementById(achID).src = achievementsJSON["Win the Game"].find(item => item.id === achID).image;
                    document.getElementById(achID+'-tooltip-details').textContent = achievementsJSON["Win the Game"].find(item => item.id === achID).details;
                document.getElementById(achID).setAttribute('data-game-id', game.id);
                };
            };
            
        };
        
        if (game.variant != "standard") {
            // Any variant 
            
            if (game.variant == "crazyhouse") {
                achID = "variant-crazyhouse";
                document.getElementById(achID).src = achievementsJSON["Play Games: Variants"].find(item => item.id === achID).image;
                document.getElementById(achID+'-tooltip-details').textContent = achievementsJSON["Play Games: Variants"].find(item => item.id === achID).details;
            }
            
            if (game.variant == "chess960") {
                achID = "variant-chess960";
                document.getElementById(achID).src = achievementsJSON["Play Games: Variants"].find(item => item.id === achID).image;
                document.getElementById(achID+'-tooltip-details').textContent = achievementsJSON["Play Games: Variants"].find(item => item.id === achID).details;
            }
            
            if (game.variant == "kingOfTheHill") {
                achID = "variant-kingOfTheHill";
                document.getElementById(achID).src = achievementsJSON["Play Games: Variants"].find(item => item.id === achID).image;
                document.getElementById(achID+'-tooltip-details').textContent = achievementsJSON["Play Games: Variants"].find(item => item.id === achID).details;
            }
            
            if (game.variant == "threeCheck") {
                achID = "variant-threeCheck";
                document.getElementById(achID).src = achievementsJSON["Play Games: Variants"].find(item => item.id === achID).image;
                document.getElementById(achID+'-tooltip-details').textContent = achievementsJSON["Play Games: Variants"].find(item => item.id === achID).details;
            }
            
            if (game.variant == "antichess") {
                achID = "variant-antichess";
                document.getElementById(achID).src = achievementsJSON["Play Games: Variants"].find(item => item.id === achID).image;
                document.getElementById(achID+'-tooltip-details').textContent = achievementsJSON["Play Games: Variants"].find(item => item.id === achID).details;
            }
            
            if (game.variant == "atomic") {
                achID = "variant-atomic";
                document.getElementById(achID).src = achievementsJSON["Play Games: Variants"].find(item => item.id === achID).image;
                document.getElementById(achID+'-tooltip-details').textContent = achievementsJSON["Play Games: Variants"].find(item => item.id === achID).details;
            }
            
            if (game.variant == "horde") {
                achID = "variant-horde";
                document.getElementById(achID).src = achievementsJSON["Play Games: Variants"].find(item => item.id === achID).image;
                document.getElementById(achID+'-tooltip-details').textContent = achievementsJSON["Play Games: Variants"].find(item => item.id === achID).details;
            }
            
            if (game.variant == "racingKings") {
                achID = "variant-racingKings";
                document.getElementById(achID).src = achievementsJSON["Play Games: Variants"].find(item => item.id === achID).image;
                document.getElementById(achID+'-tooltip-details').textContent = achievementsJSON["Play Games: Variants"].find(item => item.id === achID).details;
            }
            
        }
        
        counter += 1;
        
        await sleep(1);
    }
    
    for (let i = 0; i < gamesBlack.length; i++) {
        const game = gamesBlack[i];
        let color = "black";
        let movesArray = game.moves.split(" ");
        let movesWhiteArray = game.moves.split(" ").filter((element, index) => index % 2 === 0);
        let movesBlackArray = game.moves.split(" ").filter((element, index) => index % 2 === 1);
        let movesWhiteString = movesWhiteArray.join(" ");
        let movesBlackString = movesBlackArray.join(" ");
        
        var chess = new Chess(); // using the chess.js library
        chess.load_pgn(game.moves);
        
        loadDiv.innerHTML = 'Analyzing game ' + (i + numberOfGamesWhite) + '/' + numberOfGamesTotal;
        
        if (game.variant == "standard") {

            for (let i = 0; i < achievementsJSON["Openings: Black"].length; i++) {
                achID = achievementsJSON["Openings: Black"][i].id;
                if (!objectAchievements[achievementsJSON["Openings: Black"][i].id] && game.moves.startsWith(achievementsJSON["Openings: Black"][i].moves)) {
                    document.getElementById(achID).src = achievementsJSON["Openings: Black"].find(item => item.id === achID).image;
                    document.getElementById(achID+'-tooltip-details').textContent = achievementsJSON["Openings: Black"].find(item => item.id === achID).details;
                    document.getElementById(achID).setAttribute('data-game-id', game.id);
                    objectAchievements[achievementsJSON["Openings: Black"][i].id] = true
                };
            };
            
            // takes, takes, takes
            if (movesBlackString.includes("x")) {
                let streak = 0;
                for (let i = 0; i < movesBlackArray.length; i++) {
                    if (movesBlackArray[i].includes('x')) {
                        streak++; 
                        if (streak >= 3) {
                            achID = "takes-takes-takes";
                            document.getElementById(achID).src = achievementsJSON["Play Games"].find(item => item.id === achID).image;
                            document.getElementById(achID+'-tooltip-details').textContent = achievementsJSON["Play Games"].find(item => item.id === achID).details;
                            document.getElementById(achID).setAttribute('data-game-id', game.id);
                        }
                    } else {
                        streak = 0; 
                    }
                }
            }
            
            // lazy king
            if (!movesBlackString.includes("K") && !movesBlackString.includes("O-O") && !movesBlackString.includes("O-O-O") && game.winner == color && game.status == "mate") {
                achID = "lazy-king";
                document.getElementById(achID).src = achievementsJSON["Win the Game"].find(item => item.id === achID).image;
                document.getElementById(achID+'-tooltip-details').textContent = achievementsJSON["Win the Game"].find(item => item.id === achID).details;
                document.getElementById(achID).setAttribute('data-game-id', game.id);
            }
            
            // lazy queen
            if (!movesBlackString.includes("Q") && game.winner == color && game.status == "mate") {
                achID = "lazy-queen";
                document.getElementById(achID).src = achievementsJSON["Win the Game"].find(item => item.id === achID).image;
                document.getElementById(achID+'-tooltip-details').textContent = achievementsJSON["Win the Game"].find(item => item.id === achID).details;
                document.getElementById(achID).setAttribute('data-game-id', game.id);
            }
            
            // lazy rooks
            if (!movesBlackString.includes("R") && !movesBlackString.includes("O-O") && !movesBlackString.includes("O-O-O") && game.winner == color && game.status == "mate") {
                achID = "lazy-rook";
                document.getElementById(achID).src = achievementsJSON["Win the Game"].find(item => item.id === achID).image;
                document.getElementById(achID+'-tooltip-details').textContent = achievementsJSON["Win the Game"].find(item => item.id === achID).details;
                document.getElementById(achID).setAttribute('data-game-id', game.id);
            }
            
            // lazy bishop
            if (!movesBlackString.includes("B") && game.winner == color && game.status == "mate") {
                achID = "lazy-bishop";
                document.getElementById(achID).src = achievementsJSON["Win the Game"].find(item => item.id === achID).image;
                document.getElementById(achID+'-tooltip-details').textContent = achievementsJSON["Win the Game"].find(item => item.id === achID).details;
                document.getElementById(achID).setAttribute('data-game-id', game.id);
            }
            
            // lazy knight
            if (!movesBlackString.includes("N") && game.winner == color && game.status == "mate") {
                achID = "lazy-knight";
                document.getElementById(achID).src = achievementsJSON["Win the Game"].find(item => item.id === achID).image;
                document.getElementById(achID+'-tooltip-details').textContent = achievementsJSON["Win the Game"].find(item => item.id === achID).details;
                document.getElementById(achID).setAttribute('data-game-id', game.id);
            }
            
            // kings journey
            if ((movesBlackString.includes("Ka1") || movesBlackString.includes("Kxa1") || movesBlackString.includes("Kb1") || movesBlackString.includes("Kxb1") || movesBlackString.includes("Kc1") || movesBlackString.includes("Kxc1") || movesBlackString.includes("Kd1") || movesBlackString.includes("Kxd1") || movesBlackString.includes("Ke1") || movesBlackString.includes("Kxe1") || movesBlackString.includes("Kf1") || movesBlackString.includes("Kxf1") || movesBlackString.includes("Kg1") || movesBlackString.includes("Kxg1") || movesBlackString.includes("Kh1") || movesBlackString.includes("Kxh1")) && game.winner == color) {
                achID = "kings-journey";
                document.getElementById(achID).src = achievementsJSON["Win the Game"].find(item => item.id === achID).image;
                document.getElementById(achID+'-tooltip-details').textContent = achievementsJSON["Win the Game"].find(item => item.id === achID).details;
                document.getElementById(achID).setAttribute('data-game-id', game.id);
            }
            
            // underpromote to everything
            if (movesBlackString.includes("=Q") && movesBlackString.includes("=R") && movesBlackString.includes("=B") && movesBlackString.includes("=N")) {
                achID = "promotion-party";
                document.getElementById(achID).src = achievementsJSON["Play Games"].find(item => item.id === achID).image;
                document.getElementById(achID+'-tooltip-details').textContent = achievementsJSON["Play Games"].find(item => item.id === achID).details;
                document.getElementById(achID).setAttribute('data-game-id', game.id);
            }
            
            // underpromote to a knight
            if (movesBlackString.includes("=N")) {
                achID = "underpromote-knight";
                document.getElementById(achID).src = achievementsJSON["Play Games"].find(item => item.id === achID).image;
                document.getElementById(achID+'-tooltip-details').textContent = achievementsJSON["Play Games"].find(item => item.id === achID).details;
                document.getElementById(achID).setAttribute('data-game-id', game.id);
            }
            
            // underpromote to a bishop
            if (movesBlackString.includes("=B")) {
                achID = "underpromote-bishop";
                document.getElementById(achID).src = achievementsJSON["Play Games"].find(item => item.id === achID).image;
                document.getElementById(achID+'-tooltip-details').textContent = achievementsJSON["Play Games"].find(item => item.id === achID).details;
                document.getElementById(achID).setAttribute('data-game-id', game.id);
            }
            
            // underpromote to a rook
            if (movesBlackString.includes("=R")) {
                achID = "underpromote-rook";
                document.getElementById(achID).src = achievementsJSON["Play Games"].find(item => item.id === achID).image;
                document.getElementById(achID+'-tooltip-details').textContent = achievementsJSON["Play Games"].find(item => item.id === achID).details;
                document.getElementById(achID).setAttribute('data-game-id', game.id);
            }
            
            // underachiever
            if (game.winner == color && ["mate", "resign", "outoftime"].includes(game.status) && (movesBlackString.includes("=R") || movesBlackString.includes("=B") || movesBlackString.includes("=N"))) {
                achID = "underachiever";
                document.getElementById(achID).src = achievementsJSON["Win the Game"].find(item => item.id === achID).image;
                document.getElementById(achID+'-tooltip-details').textContent = achievementsJSON["Win the Game"].find(item => item.id === achID).details;
                document.getElementById(achID).setAttribute('data-game-id', game.id);
            }
            
            // survivor
            if (game.winner == color && ["mate", "resign", "outoftime"].includes(game.status) && movesWhiteString.includes("+")) {
                let regex = new RegExp("\\+", 'g');
                let checks = movesWhiteString.match(regex) || [];
                let checksN = checks.length;
                if (checksN > 4) {
                    achID = "survivor";
                    document.getElementById(achID).src = achievementsJSON["Win the Game"].find(item => item.id === achID).image;
                    document.getElementById(achID+'-tooltip-details').textContent = achievementsJSON["Win the Game"].find(item => item.id === achID).details;
                    document.getElementById(achID).setAttribute('data-game-id', game.id);
                }
            }
            
            // queen party
            if (movesBlackString.includes("=Q")) {
                var chess1 = new Chess();
                for (let move of movesArray){
                    chess1.move(move);
                    let matches = chess1.fen().split(' ')[0].match(/q/g);
                    if (matches && matches.length > 1) {
                        achID = "queen-party";
                        document.getElementById(achID).src = achievementsJSON["Play Games"].find(item => item.id === achID).image;
                        document.getElementById(achID+'-tooltip-details').textContent = achievementsJSON["Play Games"].find(item => item.id === achID).details;
                        document.getElementById(achID).setAttribute('data-game-id', game.id);
                    }
                }
                
            }
            
            // eliminate openings from openings-eu
            for (let move of openingsEU) {
                if (game.moves.startsWith(move)) {
                    let index = openingsEU.indexOf(move);
                    if (index !== -1) { // Check if the move is found in the array
                        openingsEU.splice(index, 1); // Remove the move from the array
                    }
                }
            }
            if (openingsEU.length === 0) {
                achID = "openings-eu";
                document.getElementById(achID).src = achievementsJSON["Openings: Collections"].find(item => item.id === achID).image;
                document.getElementById(achID+'-tooltip-details').textContent = achievementsJSON["Openings: Collections"].find(item => item.id === achID).details;
            }
            
            // eliminate openings from openings-scary
            for (let move of openingsScary) {
                if (game.moves.startsWith(move)) {
                    let index = openingsScary.indexOf(move);
                    if (index !== -1) { // Check if the move is found in the array
                        openingsScary.splice(index, 1); // Remove the move from the array
                    }
                }
            }
            if (openingsScary.length === 0) {
                achID = "openings-scary";
                document.getElementById(achID).src = achievementsJSON["Openings: Collections"].find(item => item.id === achID).image;
                document.getElementById(achID+'-tooltip-details').textContent = achievementsJSON["Openings: Collections"].find(item => item.id === achID).details;
            }
            
            // eliminate openings from openings-fantasy
            for (let move of openingsFantasy) {
                if (game.moves.startsWith(move)) {
                    let index = openingsFantasy.indexOf(move);
                    if (index !== -1) { // Check if the move is found in the array
                        openingsFantasy.splice(index, 1); // Remove the move from the array
                    }
                }
            }
            if (openingsFantasy.length === 0) {
                achID = "openings-fantasy";
                document.getElementById(achID).src = achievementsJSON["Openings: Collections"].find(item => item.id === achID).image;
                document.getElementById(achID+'-tooltip-details').textContent = achievementsJSON["Openings: Collections"].find(item => item.id === achID).details;
            }
            
            // eliminate openings from openings-beverages
            for (let move of openingsBeverages) {
                if (game.moves.startsWith(move)) {
                    let index = openingsBeverages.indexOf(move);
                    if (index !== -1) { // Check if the move is found in the array
                        openingsBeverages.splice(index, 1); // Remove the move from the array
                    }
                }
            }
            if (openingsBeverages.length === 0) {
                achID = "openings-beverages";
                document.getElementById(achID).src = achievementsJSON["Openings: Collections"].find(item => item.id === achID).image;
                document.getElementById(achID+'-tooltip-details').textContent = achievementsJSON["Openings: Collections"].find(item => item.id === achID).details;
            }
            
            // check for pacifist win
            if (!pacifist_win && !game.moves.includes("x") && game.winner == color && game.status == "mate") {
                achID = "pacifist-win";
                document.getElementById(achID).src = achievementsJSON["Win the Game"].find(item => item.id === achID).image;
                document.getElementById(achID+'-tooltip-details').textContent = achievementsJSON["Win the Game"].find(item => item.id === achID).details;
                document.getElementById(achID).setAttribute('data-game-id', game.id);
                pacifist_win = true;
            }
            
            // check for flag the opponent
            if (!flag_opponent && game.status == "outoftime" && !game.moves.includes("#") && game.winner == color) {
                achID = "flag-opponent";
                document.getElementById(achID).src = achievementsJSON["Win the Game"].find(item => item.id === achID).image;
                document.getElementById(achID+'-tooltip-details').textContent = achievementsJSON["Win the Game"].find(item => item.id === achID).details;
                document.getElementById(achID).setAttribute('data-game-id', game.id);
                flag_opponent = true;
            }
            
            let list_of_speeds = ["ultraBullet", "bullet", "blitz", "rapid", "classical", "correspondence"];
            
            for (let i=0; i < list_of_speeds.length; i++) {
                if (game.speed == list_of_speeds[i]) {
                    achID = "play-" + list_of_speeds[i];
                    document.getElementById(achID).src = achievementsJSON["Play Games"].find(item => item.id === achID).image;
                    document.getElementById(achID+'-tooltip-details').textContent = achievementsJSON["Play Games"].find(item => item.id === achID).details;
                }
            }
            
            // Check for queen mate
            if (!found_mate_queen && game.winner == color && /Q[^ ]*#/.test(game.moves)) {
                document.getElementById('queen-mate').src = achievementsJSON["Win the Game"].find(item => item.id === 'queen-mate').image;
                document.getElementById('queen-mate-tooltip-details').textContent = achievementsJSON["Win the Game"].find(item => item.id === 'queen-mate').details;
                document.getElementById('queen-mate').setAttribute('data-game-id', game.id);
                found_mate_queen = true;
            };
            
            // Check for rook mate
            if (!found_mate_queen && game.winner == color && /R[^ ]*#/.test(game.moves)) {
                document.getElementById('rook-mate').src = achievementsJSON["Win the Game"].find(item => item.id === 'rook-mate').image;
                document.getElementById('rook-mate-tooltip-details').textContent = achievementsJSON["Win the Game"].find(item => item.id === 'rook-mate').details;
                document.getElementById('rook-mate').setAttribute('data-game-id', game.id);
                found_mate_rook = true;
            };
            
            // Check for bishop mate
            if (!found_mate_bishop && game.winner == color && /B[^ ]*#/.test(game.moves)) {
                document.getElementById('bishop-mate').src = achievementsJSON["Win the Game"].find(item => item.id === 'bishop-mate').image;
                document.getElementById('bishop-mate-tooltip-details').textContent = achievementsJSON["Win the Game"].find(item => item.id === 'bishop-mate').details;
                document.getElementById('bishop-mate').setAttribute('data-game-id', game.id);
                found_mate_bishop = true;
            };
            
            // Check for knight mate
            if (!found_mate_knight && game.winner == color && /N[^ ]*#/.test(game.moves)) {
                document.getElementById('knight-mate').src = achievementsJSON["Win the Game"].find(item => item.id === 'knight-mate').image;
                document.getElementById('knight-mate-tooltip-details').textContent = achievementsJSON["Win the Game"].find(item => item.id === 'knight-mate').details;
                document.getElementById('knight-mate').setAttribute('data-game-id', game.id);
                found_mate_knight = true;
            };
            
            // Check for short castle mate
            if (!found_mate_castle_short && game.winner == color && /O-O[^ ]*#/.test(game.moves)) {
                document.getElementById('short-castle-mate').src = achievementsJSON["Win the Game"].find(item => item.id === 'short-castle-mate').image;
                document.getElementById('short-castle-mate-tooltip-details').textContent = achievementsJSON["Win the Game"].find(item => item.id === 'short-castle-mate').details;
                document.getElementById('short-castle-mate').setAttribute('data-game-id', game.id);
                found_mate_castle_short = true;
            };
            
            // Check for long castle mate
            if (!found_mate_castle_long && game.winner == color && /O-O[^ ]*#/.test(game.moves)) {
                document.getElementById('long-castle-mate').src = achievementsJSON["Win the Game"].find(item => item.id === 'long-castle-mate').image;
                document.getElementById('long-castle-mate-tooltip-details').textContent = achievementsJSON["Win the Game"].find(item => item.id === 'long-castle-mate').details;
                document.getElementById('long-castle-mate').setAttribute('data-game-id', game.id);
                found_mate_castle_long = true;
            };
            
            // Check for en passant mate (as black)
            let possible_ends = ["a4 bxa3#", "b4 axb3#", "b4 cxb3#", "c4 bxc3#", "c4 dxc3#", "d4 cxd3#", "d4 exd3#", "e4 dxe3#", "e4 fxe3#", "f4 exf3#", "f4 gxf3#", "g4 fxg3#", "g4 hxg3#", "h4 gxh3#"];
            for (let i of possible_ends) {
                if (game.winner == color && game.moves.includes(i)) {
                    achID = "en-passant-mate";
                    document.getElementById(achID).src = achievementsJSON["Win the Game"].find(item => item.id === achID).image;
                    document.getElementById(achID+'-tooltip-details').textContent = achievementsJSON["Win the Game"].find(item => item.id === achID).details;
                    document.getElementById(achID).setAttribute('data-game-id', game.id);
                };
            };
        
        };
        
        if (game.variant != "standard") {
            // Any variant 
            
            if (game.variant == "crazyhouse") {
                achID = "variant-crazyhouse";
                document.getElementById(achID).src = achievementsJSON["Play Games: Variants"].find(item => item.id === achID).image;
                document.getElementById(achID+'-tooltip-details').textContent = achievementsJSON["Play Games: Variants"].find(item => item.id === achID).details;
            }
            
            if (game.variant == "chess960") {
                achID = "variant-chess960";
                document.getElementById(achID).src = achievementsJSON["Play Games: Variants"].find(item => item.id === achID).image;
                document.getElementById(achID+'-tooltip-details').textContent = achievementsJSON["Play Games: Variants"].find(item => item.id === achID).details;
            }
            
            if (game.variant == "kingOfTheHill") {
                achID = "variant-kingOfTheHill";
                document.getElementById(achID).src = achievementsJSON["Play Games: Variants"].find(item => item.id === achID).image;
                document.getElementById(achID+'-tooltip-details').textContent = achievementsJSON["Play Games: Variants"].find(item => item.id === achID).details;
            }
            
            if (game.variant == "threeCheck") {
                achID = "variant-threeCheck";
                document.getElementById(achID).src = achievementsJSON["Play Games: Variants"].find(item => item.id === achID).image;
                document.getElementById(achID+'-tooltip-details').textContent = achievementsJSON["Play Games: Variants"].find(item => item.id === achID).details;
            }
            
            if (game.variant == "antichess") {
                achID = "variant-antichess";
                document.getElementById(achID).src = achievementsJSON["Play Games: Variants"].find(item => item.id === achID).image;
                document.getElementById(achID+'-tooltip-details').textContent = achievementsJSON["Play Games: Variants"].find(item => item.id === achID).details;
            }
            
            if (game.variant == "atomic") {
                achID = "variant-atomic";
                document.getElementById(achID).src = achievementsJSON["Play Games: Variants"].find(item => item.id === achID).image;
                document.getElementById(achID+'-tooltip-details').textContent = achievementsJSON["Play Games: Variants"].find(item => item.id === achID).details;
            }
            
            if (game.variant == "horde") {
                achID = "variant-horde";
                document.getElementById(achID).src = achievementsJSON["Play Games: Variants"].find(item => item.id === achID).image;
                document.getElementById(achID+'-tooltip-details').textContent = achievementsJSON["Play Games: Variants"].find(item => item.id === achID).details;
            }
            
            if (game.variant == "racingKings") {
                achID = "variant-racingKings";
                document.getElementById(achID).src = achievementsJSON["Play Games: Variants"].find(item => item.id === achID).image;
                document.getElementById(achID+'-tooltip-details').textContent = achievementsJSON["Play Games: Variants"].find(item => item.id === achID).details;
            }
            
        }
        
        counter += 1;
        
        await sleep(1);
    }
    
    loadDiv.innerHTML = 'Analyzing user data...';
    
    //Check for patron:
    if (userData.patron) {
        document.getElementById('support-patron').src = 'images/patron.png';
        document.getElementById('support-patron').classList.add("goldshadow");
        document.getElementById('support-patron-tooltip-details').textContent = "Thanks for supporting Lichess!"; 
        console.log(`${username} is a patron of Lichess.`);
    }
    //console.log("######");
    //console.log(userData);
    //console.log(userData.perfs);
    //console.log(userData.perfs.streak);
    // Check puzzles // runs and score
    if (userData?.perfs?.streak?.runs > 0) {
        achID = "puzzle-streak";
        document.getElementById(achID).src = achievementsJSON["Puzzles"].find(item => item.id === achID).image;
        document.getElementById(achID+'-tooltip-details').textContent = achievementsJSON["Puzzles"].find(item => item.id === achID).details;
    }
    if (userData?.perfs?.streak?.score >= 30) {
        achID = "puzzle-streak-score";
        document.getElementById(achID).src = achievementsJSON["Puzzles"].find(item => item.id === achID).image;
        document.getElementById(achID+'-tooltip-details').textContent = achievementsJSON["Puzzles"].find(item => item.id === achID).details;
    }
    if (userData?.perfs?.storm?.runs > 0) {
        achID = "puzzle-storm";
        document.getElementById(achID).src = achievementsJSON["Puzzles"].find(item => item.id === achID).image;
        document.getElementById(achID+'-tooltip-details').textContent = achievementsJSON["Puzzles"].find(item => item.id === achID).details;
    }
    if (userData?.perfs?.storm?.score >= 30) {
        achID = "puzzle-storm-score";
        document.getElementById(achID).src = achievementsJSON["Puzzles"].find(item => item.id === achID).image;
        document.getElementById(achID+'-tooltip-details').textContent = achievementsJSON["Puzzles"].find(item => item.id === achID).details;
    }
    if (userData?.perfs?.racer?.runs > 0) {
        achID = "puzzle-racer";
        document.getElementById(achID).src = achievementsJSON["Puzzles"].find(item => item.id === achID).image;
        document.getElementById(achID+'-tooltip-details').textContent = achievementsJSON["Puzzles"].find(item => item.id === achID).details;
    }
    if (userData?.perfs?.racer?.score >= 30) {
        achID = "puzzle-racer-score";
        document.getElementById(achID).src = achievementsJSON["Puzzles"].find(item => item.id === achID).image;
        document.getElementById(achID+'-tooltip-details').textContent = achievementsJSON["Puzzles"].find(item => item.id === achID).details;
    }
    
    // Check playtime total and tv:
    if (userData.playTime) {
        if (userData.playTime.total > 0) {
            achID = "playtime";
            document.getElementById(achID).src = achievementsJSON["Miscellaneous"].find(item => item.id === achID).image;
            //document.getElementById(achID+'-tooltip-details').textContent = achievementsJSON["Miscellaneous"].find(item => item.id === achID).details;
            let time = userData.playTime.total;
            let unit = " seconds";
            if (time > 86400) {
                time = time / 86400;
                unit = " days";
            }
            else if (time > 3600) {
                time = time / 3600;
                unit = " hours";
            }
            else if (time > 60) {
                time = time / 60;
                unit = " minutes";
            }
            document.getElementById(achID+'-tooltip-details').textContent = "You played for more than " + Math.floor(time) + unit;
        }
        if (userData.playTime.tv > 0) {
            achID = "tv";
            document.getElementById(achID).src = achievementsJSON["Miscellaneous"].find(item => item.id === achID).image;
            //document.getElementById(achID+'-tooltip-details').textContent = achievementsJSON["Miscellaneous"].find(item => item.id === achID).details;
            let time = userData.playTime.tv;
            let unit = " seconds";
            if (time > 86400) {
                time = time / 86400;
                unit = " days";
            }
            else if (time > 3600) {
                time = time / 3600;
                unit = " hours";
            }
            else if (time > 60) {
                time = time / 60;
                unit = " minutes";
            }
            document.getElementById(achID+'-tooltip-details').textContent = "You appeared on TV for more than " + Math.floor(time) + unit;
        }
    }
    
    
    
    //Check for account age
    const createdAtDate = new Date(userData.createdAt);
    const currentDate = new Date();

    const differenceInMilliseconds = currentDate - createdAtDate;
    const differenceInYears = differenceInMilliseconds / (1000 * 60 * 60 * 24 * 365); // Convert milliseconds to years
    const age = Math.floor(differenceInYears);
    
    if (age > 0) {
        //document.getElementById('account-age').src = "images/age-${age.toString().padStart(2, '0')}.png";
        document.getElementById('account-age').src = "images/birthday.png";
        document.getElementById('account-age-tooltip-details').textContent = "Your account is " + age + " years old";
    }
    
    // Check number of rated games:
    for (let i = 1; i <= 100000; i=i*10) {
        if (numberOfGamesTotal >= i) {
            document.getElementById('play-games').src = 'images/play-'+i+'.png';
            document.getElementById('play-games-tooltip-details').textContent = "You have played " + numberOfGamesTotal + " rated games";
        }
    }
    
    loadDiv.innerHTML = '';
    
    // Summarize: 
    var numAchTotal = document.querySelectorAll('img').length;;
    var numAchUnlocked = document.querySelectorAll('img:not([src="images/locked.png"])').length;

    
    var spanSummary = document.createElement('span');
    spanSummary.textContent = "Unlocked: " + numAchUnlocked + "/" + numAchTotal;
    document.getElementById('summary').appendChild(spanSummary);
    
    addCursorToImg();
    addLinksToImg();
    
}




function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

window.checkAchievements = checkAchievements;


// add event listener for linking to a game
function addLinksToImg() {
    document.querySelectorAll('img.achievement-image').forEach(function(img) {
        img.addEventListener('click', function(e) {
            // Ensure the event target is the image and it has the required attribute
            if (e.target.hasAttribute('data-game-id')) {
                // Retrieve the URL from the data-game-id attribute
                let imageUrl = "https://lichess.org/" + e.target.getAttribute('data-game-id');
                
                // Check the width of the image to determine if it's been expanded
                // Since the image is scaled, its width would change accordingly
                let scaleX = e.target.getBoundingClientRect().width / e.target.offsetWidth;
                
                // If the image is expanded, scaleX == 1.08, proceed to open the URL
                if (scaleX > 1.) {
                    window.open(imageUrl, '_blank');
                } 
            }
        });
    });
}


// set class to img that has data-game-id
function addCursorToImg() {
    document.querySelectorAll('img.achievement-image').forEach(function(img) {
        // Check if the data-game-id attribute exists
        if (img.hasAttribute('data-game-id')) {
            img.classList.add('clickable');
        }
    });
}

