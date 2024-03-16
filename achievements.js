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
            achievementDiv.classList.add('tooltip');

            // Create an img element for the achievement image
            const imgElement = document.createElement('img');
            imgElement.src = 'images/locked.png'; // Assuming the first level's image
            imgElement.classList.add('achievement-image');
            imgElement.id = achievement.id;
            
            // Create a span element
            const spanElement = document.createElement('span');
            spanElement.textContent = achievement.title_locked;
            spanElement.id = achievement.id + "-tooltip"
            spanElement.classList.add('tooltiptext');

            // Append the img to the achievement div, and the div to the container
            achievementDiv.appendChild(imgElement);
            achievementDiv.appendChild(spanElement);
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





async function fetchUserData(username) {
    
    console.log("Starting with fetchUserData()...")
    
    const urls = [
        `https://lichess.org/api/games/user/${username}?rated=true&color=white`,
        `https://lichess.org/api/games/user/${username}?rated=true&color=black`,
        `https://lichess.org/api/user/${username}`
    ];

    const fetchPromises = urls.map(url =>
        fetch(url, { headers: { 'Accept': 'application/x-ndjson' } })
    );

    try {
        const responses = await Promise.all(fetchPromises);
        const [gamesWhiteText, gamesBlackText, userResponse] = await Promise.all(responses.map(res => res.text()));

        const gamesWhite = gamesWhiteText.trim().split('\n').map(JSON.parse);
        const gamesBlack = gamesBlackText.trim().split('\n').map(JSON.parse);
        const userData = JSON.parse(userResponse); // Assuming the user API returns JSON, not NDJSON

        return { gamesWhite, gamesBlack, userData };
    } catch (error) {
        console.error("Error fetching data:", error);
        throw error; // Re-throw error for caller to handle if needed
    }
}

function resetAchievements() {
    const ach = document.getElementsByClassName('achievement-image');

    for (let i = 0; i < ach.length; i++) {
        ach[i].src = 'images/locked.png';
    }
    
    // reset tooltips
    let resetTooltips = document.querySelectorAll('span.tooltiptext');
    resetTooltips.forEach(span => {
        let title;
        let id = span.id.substring(0, span.id.length - 8);
        
        Object.keys(achievementsJSON).forEach(category => {
            const items = achievementsJSON[category];
            // Find the item in the category that matches the given id
            const item = items.find(item => item.id === id);
            if (item) {
                title = item.title_locked;
            }
        });
        
        span.textContent = title;
    });
    
    document.getElementById('summary').innerHTML = '';
}

async function checkAchievements() { // this function gets called by the input button
    
    // Reset achievements, reset summary at the bottom
    resetAchievements(); 
    
    // Create hourglass
    loadDiv = document.getElementById("loading-div");
    loadDiv.innerHTML = '<i id="hourglass" class="fa-regular fa-hourglass-half"></i>&ensp;Loading games...'

    const username = document.getElementById('username').value;
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
    processAchievements(gamesWhite, gamesBlack, userData, username);
    
    // Delete hourglass
    loadDiv.innerHTML = '';
    
}

async function processAchievements(gamesWhite, gamesBlack, userData, username) {
    console.log("processAchievements(..)")
    
    const numberOfGamesWhite = gamesWhite.length
    const numberOfGamesBlack = gamesBlack.length
    const numberOfGamesTotal = numberOfGamesWhite + numberOfGamesBlack
    
    // At the start, no achievement is unlocked
    let objectAchievements = {};
    
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
    
    let firstMovesWhite = ["a3", "a4"];
    
    let counter = 1; // this lets the user know where we're at with analyzing the games
    
    for (let i = 0; i < gamesWhite.length; i++) {
        const game = gamesWhite[i];
        let color = "white";
        
        loadDiv.innerHTML = 'Analyzing game ' + i + '/' + numberOfGamesTotal;
        
        if (game.variant == "standard") {
        
            for (let i = 0; i < achievementsJSON["Openings: White"].length; i++) {
                let achID = achievementsJSON["Openings: White"][i].id;
                if (!objectAchievements[achievementsJSON["Openings: White"][i].id] && game.moves.startsWith(achievementsJSON["Openings: White"][i].moves)) {
                    document.getElementById(achID).src = achievementsJSON["Openings: White"].find(item => item.id === achID).image;
                    document.getElementById(achID+'-tooltip').textContent = achievementsJSON["Openings: White"].find(item => item.id === achID).title;
                    objectAchievements[achievementsJSON["Openings: White"][i].id] = true
                };
            };
            
            // eliminate those first moves that have been played, if the list is empty -> achievement
            for (let move of firstMovesWhite) {
                if (game.moves[0] === move) {
                    let index = firstMovesWhite.indexOf(move);
                    if (index !== -1) { // Check if the move is found in the array
                        firstMovesWhite.splice(index, 1); // Remove the move from the array
                    }
                }
            }
            if (firstMovesWhite.length === 0) {
                achID = "opening-allwhite";
                document.getElementById(achID).src = achievementsJSON["Openings: White"].find(item => item.id === achID).image;
                document.getElementById(achID+'-tooltip').textContent = achievementsJSON["Openings: White"].find(item => item.id === achID).title;
            }
            
            // check for pacifist win
            if (!pacifist_win && !game.moves.includes("x") && game.winner == color) {
                achID = "pacifist-win";
                document.getElementById(achID).src = achievementsJSON["Win the Game"].find(item => item.id === achID).image;
                document.getElementById(achID+'-tooltip').textContent = achievementsJSON["Win the Game"].find(item => item.id === achID).title;
                pacifist_win = true;
            }
            
            // check for flag the opponent
            if (!flag_opponent && !game.moves.includes("#") && game.winner == color) {
                achID = "flag-opponent";
                document.getElementById(achID).src = achievementsJSON["Win the Game"].find(item => item.id === achID).image;
                document.getElementById(achID+'-tooltip').textContent = achievementsJSON["Win the Game"].find(item => item.id === achID).title;
                flag_opponent = true;
            }
            
            let list_of_speeds = ["ultraBullet", "bullet", "blitz", "rapid", "classical", "correspondence"];
            
            for (let i=0; i < list_of_speeds.length; i++) {
                if (game.speed == list_of_speeds[i]) {
                    let achID = "play-" + list_of_speeds[i];
                    document.getElementById(achID).src = achievementsJSON["Play Games"].find(item => item.id === achID).image;
                    document.getElementById(achID+'-tooltip').textContent = achievementsJSON["Play Games"].find(item => item.id === achID).title;
                }
            }
            
            // Check for queen mate
            if (!found_mate_queen && game.winner == color && /Q[^ ]*#/.test(game.moves)) {
                document.getElementById('queen-mate').src = achievementsJSON["Win the Game"].find(item => item.id === 'queen-mate').image;
                document.getElementById('queen-mate-tooltip').textContent = achievementsJSON["Win the Game"].find(item => item.id === 'queen-mate').title;
                found_mate_queen = true;
            };
            
            // Check for rook mate
            if (!found_mate_rook && game.winner == color && /R[^ ]*#/.test(game.moves)) {
                document.getElementById('rook-mate').src = achievementsJSON["Win the Game"].find(item => item.id === 'rook-mate').image;
                document.getElementById('rook-mate-tooltip').textContent = achievementsJSON["Win the Game"].find(item => item.id === 'rook-mate').title;
                found_mate_rook = true;
            };
            
            // Check for bishop mate
            if (!found_mate_bishop && game.winner == color && /B[^ ]*#/.test(game.moves)) {
                document.getElementById('bishop-mate').src = achievementsJSON["Win the Game"].find(item => item.id === 'bishop-mate').image;
                document.getElementById('bishop-mate-tooltip').textContent = achievementsJSON["Win the Game"].find(item => item.id === 'bishop-mate').title;
                found_mate_bishop = true;
            };
            
            // Check for knight mate
            if (!found_mate_knight && game.winner == color && /N[^ ]*#/.test(game.moves)) {
                document.getElementById('knight-mate').src = achievementsJSON["Win the Game"].find(item => item.id === 'knight-mate').image;
                document.getElementById('knight-mate-tooltip').textContent = achievementsJSON["Win the Game"].find(item => item.id === 'knight-mate').title;
                found_mate_knight = true;
            };
            
            // Check for short castle mate
            if (!found_mate_castle_short && game.winner == color && /O-O[^ ]*#/.test(game.moves)) {
                document.getElementById('short-castle-mate').src = achievementsJSON["Win the Game"].find(item => item.id === 'short-castle-mate').image;
                document.getElementById('short-castle-mate-tooltip').textContent = achievementsJSON["Win the Game"].find(item => item.id === 'short-castle-mate').title;
                found_mate_castle_short = true;
            };
            
            // Check for long castle mate
            if (!found_mate_castle_long && game.winner == color && /O-O[^ ]*#/.test(game.moves)) {
                document.getElementById('long-castle-mate').src = achievementsJSON["Win the Game"].find(item => item.id === 'long-castle-mate').image;
                document.getElementById('long-castle-mate-tooltip').textContent = achievementsJSON["Win the Game"].find(item => item.id === 'long-castle-mate').title;
                found_mate_castle_long = true;
            };
            
        };
        
        if (game.variant != "standard") {
            // Any variant 
            
            if (game.variant == "crazyhouse") {
                achID = "variant-crazyhouse";
                document.getElementById(achID).src = achievementsJSON["Play Games: Variants"].find(item => item.id === achID).image;
                document.getElementById(achID+'-tooltip').textContent = achievementsJSON["Play Games: Variants"].find(item => item.id === achID).title;
            }
            
            if (game.variant == "chess960") {
                achID = "variant-chess960";
                document.getElementById(achID).src = achievementsJSON["Play Games: Variants"].find(item => item.id === achID).image;
                document.getElementById(achID+'-tooltip').textContent = achievementsJSON["Play Games: Variants"].find(item => item.id === achID).title;
            }
            
            if (game.variant == "kingOfTheHill") {
                achID = "variant-kingOfTheHill";
                document.getElementById(achID).src = achievementsJSON["Play Games: Variants"].find(item => item.id === achID).image;
                document.getElementById(achID+'-tooltip').textContent = achievementsJSON["Play Games: Variants"].find(item => item.id === achID).title;
            }
            
            if (game.variant == "threeCheck") {
                achID = "variant-threeCheck";
                document.getElementById(achID).src = achievementsJSON["Play Games: Variants"].find(item => item.id === achID).image;
                document.getElementById(achID+'-tooltip').textContent = achievementsJSON["Play Games: Variants"].find(item => item.id === achID).title;
            }
            
            if (game.variant == "antichess") {
                achID = "variant-antichess";
                document.getElementById(achID).src = achievementsJSON["Play Games: Variants"].find(item => item.id === achID).image;
                document.getElementById(achID+'-tooltip').textContent = achievementsJSON["Play Games: Variants"].find(item => item.id === achID).title;
            }
            
            if (game.variant == "atomic") {
                achID = "variant-atomic";
                document.getElementById(achID).src = achievementsJSON["Play Games: Variants"].find(item => item.id === achID).image;
                document.getElementById(achID+'-tooltip').textContent = achievementsJSON["Play Games: Variants"].find(item => item.id === achID).title;
            }
            
            if (game.variant == "horde") {
                achID = "variant-horde";
                document.getElementById(achID).src = achievementsJSON["Play Games: Variants"].find(item => item.id === achID).image;
                document.getElementById(achID+'-tooltip').textContent = achievementsJSON["Play Games: Variants"].find(item => item.id === achID).title;
            }
            
            if (game.variant == "racingKings") {
                achID = "variant-racingKings";
                document.getElementById(achID).src = achievementsJSON["Play Games: Variants"].find(item => item.id === achID).image;
                document.getElementById(achID+'-tooltip').textContent = achievementsJSON["Play Games: Variants"].find(item => item.id === achID).title;
            }
            
        }
        
        counter += 1;
        
        await sleep(1);
    }
    
    for (let i = 0; i < gamesBlack.length; i++) {
        const game = gamesBlack[i];
        let color = "black";
        
        loadDiv.innerHTML = 'Analyzing game ' + (i + numberOfGamesWhite) + '/' + numberOfGamesTotal;
        
        if (game.variant == "standard") {

            for (let i = 0; i < achievementsJSON["Openings: Black"].length; i++) {
                let achID = achievementsJSON["Openings: Black"][i].id;
                if (!objectAchievements[achievementsJSON["Openings: Black"][i].id] && game.moves.startsWith(achievementsJSON["Openings: Black"][i].moves)) {
                    document.getElementById(achID).src = achievementsJSON["Openings: Black"].find(item => item.id === achID).image;
                    document.getElementById(achID+'-tooltip').textContent = achievementsJSON["Openings: Black"].find(item => item.id === achID).title;
                    objectAchievements[achievementsJSON["Openings: Black"][i].id] = true
                };
            };
            
            // check for pacifist win
            if (!pacifist_win && !game.moves.includes("x") && game.winner == color) {
                achID = "pacifist-win";
                document.getElementById(achID).src = achievementsJSON["Win the Game"].find(item => item.id === achID).image;
                document.getElementById(achID+'-tooltip').textContent = achievementsJSON["Win the Game"].find(item => item.id === achID).title;
                pacifist_win = true;
            }
            
            // check for flag the opponent
            if (!flag_opponent && !game.moves.includes("#") && game.winner == color) {
                achID = "flag-opponent";
                document.getElementById(achID).src = achievementsJSON["Win the Game"].find(item => item.id === achID).image;
                document.getElementById(achID+'-tooltip').textContent = achievementsJSON["Win the Game"].find(item => item.id === achID).title;
                flag_opponent = true;
            }
            
            let list_of_speeds = ["ultraBullet", "bullet", "blitz", "rapid", "classical", "correspondence"];
            
            for (let i=0; i < list_of_speeds.length; i++) {
                if (game.speed == list_of_speeds[i]) {
                    let achID = "play-" + list_of_speeds[i];
                    document.getElementById(achID).src = achievementsJSON["Play Games"].find(item => item.id === achID).image;
                    document.getElementById(achID+'-tooltip').textContent = achievementsJSON["Play Games"].find(item => item.id === achID).title;
                }
            }
            
            // Check for queen mate
            if (!found_mate_queen && game.winner == color && /Q[^ ]*#/.test(game.moves)) {
                document.getElementById('queen-mate').src = achievementsJSON["Win the Game"].find(item => item.id === 'queen-mate').image;
                document.getElementById('queen-mate-tooltip').textContent = achievementsJSON["Win the Game"].find(item => item.id === 'queen-mate').title;
                found_mate_queen = true;
            };
            
            // Check for rook mate
            if (!found_mate_queen && game.winner == color && /R[^ ]*#/.test(game.moves)) {
                document.getElementById('rook-mate').src = achievementsJSON["Win the Game"].find(item => item.id === 'rook-mate').image;
                document.getElementById('rook-mate-tooltip').textContent = achievementsJSON["Win the Game"].find(item => item.id === 'rook-mate').title;
                found_mate_rook = true;
            };
            
            // Check for bishop mate
            if (!found_mate_bishop && game.winner == color && /B[^ ]*#/.test(game.moves)) {
                document.getElementById('bishop-mate').src = achievementsJSON["Win the Game"].find(item => item.id === 'bishop-mate').image;
                document.getElementById('bishop-mate-tooltip').textContent = achievementsJSON["Win the Game"].find(item => item.id === 'bishop-mate').title;
                found_mate_bishop = true;
            };
            
            // Check for knight mate
            if (!found_mate_knight && game.winner == color && /N[^ ]*#/.test(game.moves)) {
                document.getElementById('knight-mate').src = achievementsJSON["Win the Game"].find(item => item.id === 'knight-mate').image;
                document.getElementById('knight-mate-tooltip').textContent = achievementsJSON["Win the Game"].find(item => item.id === 'knight-mate').title;
                found_mate_knight = true;
            };
            
            // Check for short castle mate
            if (!found_mate_castle_short && game.winner == color && /O-O[^ ]*#/.test(game.moves)) {
                document.getElementById('short-castle-mate').src = achievementsJSON["Win the Game"].find(item => item.id === 'short-castle-mate').image;
                document.getElementById('short-castle-mate-tooltip').textContent = achievementsJSON["Win the Game"].find(item => item.id === 'short-castle-mate').title;
                found_mate_castle_short = true;
            };
            
            // Check for long castle mate
            if (!found_mate_castle_long && game.winner == color && /O-O[^ ]*#/.test(game.moves)) {
                document.getElementById('long-castle-mate').src = achievementsJSON["Win the Game"].find(item => item.id === 'long-castle-mate').image;
                document.getElementById('long-castle-mate-tooltip').textContent = achievementsJSON["Win the Game"].find(item => item.id === 'long-castle-mate').title;
                found_mate_castle_long = true;
            };
        
        };
        
        if (game.variant != "standard") {
            // Any variant 
            
            if (game.variant == "crazyhouse") {
                achID = "variant-crazyhouse";
                document.getElementById(achID).src = achievementsJSON["Play Games: Variants"].find(item => item.id === achID).image;
                document.getElementById(achID+'-tooltip').textContent = achievementsJSON["Play Games: Variants"].find(item => item.id === achID).title;
            }
            
            if (game.variant == "chess960") {
                achID = "variant-chess960";
                document.getElementById(achID).src = achievementsJSON["Play Games: Variants"].find(item => item.id === achID).image;
                document.getElementById(achID+'-tooltip').textContent = achievementsJSON["Play Games: Variants"].find(item => item.id === achID).title;
            }
            
            if (game.variant == "kingOfTheHill") {
                achID = "variant-kingOfTheHill";
                document.getElementById(achID).src = achievementsJSON["Play Games: Variants"].find(item => item.id === achID).image;
                document.getElementById(achID+'-tooltip').textContent = achievementsJSON["Play Games: Variants"].find(item => item.id === achID).title;
            }
            
            if (game.variant == "threeCheck") {
                achID = "variant-threeCheck";
                document.getElementById(achID).src = achievementsJSON["Play Games: Variants"].find(item => item.id === achID).image;
                document.getElementById(achID+'-tooltip').textContent = achievementsJSON["Play Games: Variants"].find(item => item.id === achID).title;
            }
            
            if (game.variant == "antichess") {
                achID = "variant-antichess";
                document.getElementById(achID).src = achievementsJSON["Play Games: Variants"].find(item => item.id === achID).image;
                document.getElementById(achID+'-tooltip').textContent = achievementsJSON["Play Games: Variants"].find(item => item.id === achID).title;
            }
            
            if (game.variant == "atomic") {
                achID = "variant-atomic";
                document.getElementById(achID).src = achievementsJSON["Play Games: Variants"].find(item => item.id === achID).image;
                document.getElementById(achID+'-tooltip').textContent = achievementsJSON["Play Games: Variants"].find(item => item.id === achID).title;
            }
            
            if (game.variant == "horde") {
                achID = "variant-horde";
                document.getElementById(achID).src = achievementsJSON["Play Games: Variants"].find(item => item.id === achID).image;
                document.getElementById(achID+'-tooltip').textContent = achievementsJSON["Play Games: Variants"].find(item => item.id === achID).title;
            }
            
            if (game.variant == "racingKings") {
                achID = "variant-racingKings";
                document.getElementById(achID).src = achievementsJSON["Play Games: Variants"].find(item => item.id === achID).image;
                document.getElementById(achID+'-tooltip').textContent = achievementsJSON["Play Games: Variants"].find(item => item.id === achID).title;
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
        console.log(`${username} is a patron of Lichess.`);
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
        document.getElementById('account-age-tooltip').innerHTML = "Happy Birthday!";
    }
    
    // Check number of rated games:
    for (let i = 1; i <= 100000; i=i*10) {
        if (numberOfGamesTotal >= i) {
            document.getElementById('play-games').src = 'images/play-'+i+'.png';
        }
    }
    
    loadDiv.innerHTML = '';
    
    // Summarize: 
    var numAchTotal = document.querySelectorAll('img').length;;
    var numAchUnlocked = document.querySelectorAll('img:not([src="images/locked.png"])').length;

    
    var spanSummary = document.createElement('span');
    spanSummary.textContent = "Unlocked: " + numAchUnlocked + "/" + numAchTotal;
    document.getElementById('summary').appendChild(spanSummary);
    
}




function showInfo() {
    alert("Hello!\n\nThis website shows achievements that you can collect while playing chess on lichess.\n\nPlease be aware, though, that we are an independent entity and not officially affiliated with, endorsed by, or sponsored by lichess or any of its affiliates. Although the user data is fetched via the lichess API, the content on this website is created and managed independently.\n\nHappy collecting!");
}





function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
