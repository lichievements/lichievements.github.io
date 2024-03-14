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
            spanElement.classList.add('tooltiptext');

            // Append the img to the achievement div, and the div to the container
            achievementDiv.appendChild(imgElement);
            achievementDiv.appendChild(spanElement);
            achivement_category.appendChild(achievementDiv);
        });
    }
}

// Load achievements data from data.json and then display achievements
fetch('achievements.json')
    .then(response => response.json())
    .then(data => {
        displayAchievements(data);
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
    //console.log(ach);
    for (let i = 0; i < ach.length; i++) {
        ach[i].src = 'images/locked.png';
    }
    document.getElementById('summary').innerHTML = '';
}

async function checkAchievements() {
    resetAchievements(); // Reset achievements visuals and summary

    const username = document.getElementById('username').value;
    try {
        const { gamesWhite, gamesBlack, userData } = await fetchUserData(username);
        // Now process the data for achievements
        processAchievements(gamesWhite, gamesBlack, userData, username);
        console.log("Achievements checked for", username);
    } catch (error) {
        console.error("Error checking achievements:", error);
    }
}

function processAchievements(gamesWhite, gamesBlack, userData, username) {
    console.log("processAchievements(..)")
    //Check for patron:
    if (userData.patron) {
        document.getElementById('support-patron').src = 'images/patron.png';
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
        console.log("${username}'s account is ${age.toString().padStart(2, '0')} years old.");
    }
    
    // Check number of rated games:
    const totalNumberOfGames = gamesWhite.length + gamesBlack.length
    
    for (let i = 1; i <= 100000; i=i*10) {
        if (totalNumberOfGames >= i) {
            document.getElementById('play-games').src = 'images/play-'+i+'.png';
        }
    }
    
    // Check for openings: 
    let found_opening_sicilian = false;
    let found_opening_french = false;
    let found_opening_pirc = false;
    let found_opening_carokann = false;
    let found_opening_scandinavian = false;
    let found_opening_grob = false;
    let found_opening_bongcloud = false;

    gamesWhite.forEach(game => {
        
        // check for Sicilian 1. e4 c5
        if (!found_opening_sicilian && game.moves.startsWith('e4 c5')) {
            document.getElementById('opening-sicilian').src = 'images/opening-sicilian.png';
            console.log("found a Sicilian")
            console.log()
            found_opening_sicilian = true;
        }
        
        // check for French 1. e4 e6
        if (!found_opening_french && game.moves.startsWith('e4 e6')) {
            document.getElementById('opening-french').src = 'images/opening-french.png';
            console.log("found a French")
            found_opening_french = true;
        }
        
        // check for Pirc 1. e4 d6
        if (!found_opening_pirc && game.moves.startsWith('e4 d6')) {
            document.getElementById('opening-pirc').src = 'images/opening-pirc.png';
            console.log("found a Pirc")
            found_opening_pirc = true;
        }
        
        // check for Caro-Kann 1. e4 c6
        if (!found_opening_carokann && game.moves.startsWith('e4 c6')) {
            document.getElementById('opening-carokann').src = 'images/opening-carokann.png';
            console.log("found a Caro-Kann")
            found_opening_carokann = true;
        }
        
        // check for Scandinavian 1. e4 d5
        if (!found_opening_scandinavian && game.moves.startsWith('e4 d5')) {
            document.getElementById('opening-scandinavian').src = 'images/opening-scandinavian.png';
            console.log("found a Scandinavian")
            found_opening_scandinavian = true;
        }
        
        // check for Grob 1. g4
        if (!found_opening_grob && game.moves.startsWith('g4')) {
            document.getElementById('opening-grob').src = 'images/opening-grob.png';
            console.log("found a Grob")
            found_opening_grob = true;
        }
        
        // check for Bong Cloud 1. e4 e5 2. Ke2
        if (!found_opening_grob && game.moves.startsWith('e4 e5 Ke2')) {
            document.getElementById('opening-bongcloud').src = 'images/opening-bongcloud.png';
            console.log("found a Bong Cloud")
            found_opening_bongcloud = true;
        }
        
    });
    
    gamesBlack.forEach(game => {
        
        // check for Sicilian 1. e4 c5
        if (!found_opening_sicilian && game.moves.startsWith('e4 c5')) {
            document.getElementById('opening-sicilian').src = 'images/opening-sicilian.png';
            console.log("found a Sicilian")
            found_opening_sicilian = true;
        }
        
        // check for French 1. e4 e6
        if (!found_opening_french && game.moves.startsWith('e4 e6')) {
            document.getElementById('opening-french').src = 'images/opening-french.png';
            console.log("found a French")
            found_opening_french = true;
        }
        
        // check for Pirc 1. e4 d6
        if (!found_opening_pirc && game.moves.startsWith('e4 d6')) {
            document.getElementById('opening-pirc').src = 'images/opening-pirc.png';
            console.log("found a Pirc")
            found_opening_pirc = true;
        }
        
        // check for Caro-Kann 1. e4 c6
        if (!found_opening_carokann && game.moves.startsWith('e4 c6')) {
            document.getElementById('opening-carokann').src = 'images/opening-carokann.png';
            console.log("found a Caro-Kann")
            found_opening_carokann = true;
        }
        
        // check for Scandinavian 1. e4 d5
        if (!found_opening_scandinavian && game.moves.startsWith('e4 d5')) {
            document.getElementById('opening-scandinavian').src = 'images/opening-scandinavian.png';
            console.log("found a Scandinavian")
            found_opening_scandinavian = true;
        }
        
        // check for Grob 1. g4
        if (!found_opening_grob && game.moves.startsWith('g4')) {
            document.getElementById('opening-grob').src = 'images/opening-grob.png';
            console.log("found a Grob")
            found_opening_grob = true;
        }
        
        // check for Bong Cloud 1. e4 e5 2. Ke2
        if (!found_opening_grob && game.moves.startsWith('e4 e5 Ke2')) {
            document.getElementById('opening-bongcloud').src = 'images/opening-bongcloud.png';
            console.log("found a Bong Cloud")
            found_opening_bongcloud = true;
        }
        
    });
    
    // Check for mates:
    let found_queen_mate = false;
    let found_rook_mate = false;
    let found_bishop_mate = false;
    let found_knight_mate = false;
    let found_shortCastle_mate = false;
    let found_longCastle_mate = false;
    gamesWhite.forEach(game => {
        
        // Check for queen mate
        if (!found_queen_mate && game.winner == "white" && /Q[^ ]*#/.test(game.moves)) {
            document.getElementById('queen-mate').src = 'images/unlocked.png';
            found_queen_mate = true;
        }
        
        // Check for rook mate
        if (!found_rook_mate && game.winner == "white" && /R[^ ]*#/.test(game.moves)) {
            document.getElementById('rook-mate').src = 'images/unlocked.png';
            found_rook_mate = true;
        }
        
        // Check for bishop mate
        if (!found_bishop_mate && game.winner == "white" && /B[^ ]*#/.test(game.moves)) {
            document.getElementById('bishop-mate').src = 'images/unlocked.png';
            found_bishop_mate = true;
        }
        
        // Check for knight mate
        if (!found_knight_mate && game.winner == "white" && /N[^ ]*#/.test(game.moves)) {
            document.getElementById('knight-mate').src = 'images/unlocked.png';
            found_knight_mate = true;
        }
        
        // Check for short castle mate
        if (!found_shortCastle_mate && game.winner == "white" && /0-0[^ ]*#/.test(game.moves)) {
            document.getElementById('short-castle-mate').src = 'images/unlocked.png';
            found_shortCastle_mate = true;
        }
        
        // Check for short castle mate
        if (!found_shortCastle_mate && game.winner == "white" && /O-O[^ ]*#/.test(game.moves)) {
            document.getElementById('short-castle-mate').src = 'images/unlocked.png';
            found_shortCastle_mate = true;
        }
        
        // Check for long castle mate
        if (!found_longCastle_mate && game.winner == "white" && /0-0-0[^ ]*#/.test(game.moves)) {
            document.getElementById('long-castle-mate').src = 'images/unlocked.png';
            found_longCastle_mate = true;
        }
        
        // Check for long castle mate
        if (!found_longCastle_mate && game.winner == "white" && /O-O-O[^ ]*#/.test(game.moves)) {
            document.getElementById('long-castle-mate').src = 'images/unlocked.png';
            found_longCastle_mate = true;
        }
        
    });
    gamesBlack.forEach(game => {
        
        // Check for queen mate
        if (!found_queen_mate && game.winner == "black" && /Q[^ ]*#/.test(game.moves)) {
            document.getElementById('queen-mate').src = 'images/unlocked.png';
            found_queen_mate = true;
        }
        
        // Check for rook mate
        if (!found_rook_mate && game.winner == "black" && /R[^ ]*#/.test(game.moves)) {
            document.getElementById('rook-mate').src = 'images/unlocked.png';
            found_rook_mate = true;
        }
        
        // Check for bishop mate
        if (!found_bishop_mate && game.winner == "black" && /B[^ ]*#/.test(game.moves)) {
            document.getElementById('bishop-mate').src = 'images/unlocked.png';
            found_bishop_mate = true;
        }
        
        // Check for knight mate
        if (!found_knight_mate && game.winner == "black" && /N[^ ]*#/.test(game.moves)) {
            document.getElementById('knight-mate').src = 'images/unlocked.png';
            found_knight_mate = true;
        }
        
        // Check for short castle mate
        if (!found_shortCastle_mate && game.winner == "black" && /0-0[^ ]*#/.test(game.moves)) {
            document.getElementById('short-castle-mate').src = 'images/unlocked.png';
            found_shortCastle_mate = true;
        }
        
        // Check for short castle mate
        if (!found_shortCastle_mate && game.winner == "black" && /O-O[^ ]*#/.test(game.moves)) {
            document.getElementById('short-castle-mate').src = 'images/unlocked.png';
            found_shortCastle_mate = true;
        }
        
        // Check for long castle mate
        if (!found_longCastle_mate && game.winner == "black" && /0-0-0[^ ]*#/.test(game.moves)) {
            document.getElementById('long-castle-mate').src = 'images/unlocked.png';
            found_longCastle_mate = true;
        }
        
        // Check for long castle mate
        if (!found_longCastle_mate && game.winner == "black" && /O-O-O[^ ]*#/.test(game.moves)) {
            document.getElementById('long-castle-mate').src = 'images/unlocked.png';
            found_longCastle_mate = true;
        }
        
    });
    
    // Summarize: 
    var numAchTotal = document.querySelectorAll('img').length;;
    var numAchUnlocked = document.querySelectorAll('img:not([src="images/locked.png"])').length;

    
    var spanSummary = document.createElement('span');
    spanSummary.textContent = "Unlocked: " + numAchUnlocked + "/" + numAchTotal;
    document.getElementById('summary').appendChild(spanSummary);
    
}











