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
            spanElement.textContent = achievement.title;
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





async function getUserData() {

    // reset all achievements
    const ach = document.getElementsByClassName('achievement-image');
    console.log(ach);
    for (let i = 0; i < ach.length; i++) {
        ach[i].src = 'images/locked.png';
    }

    const username = document.getElementById('username').value;

    const urlWhite = `https://lichess.org/api/games/user/${username}?rated=true&color=white`;
    const urlBlack = `https://lichess.org/api/games/user/${username}?rated=true&color=black`;
    const urlUser = `https://lichess.org/api/user/${username}`;

    const responseWhite = await fetch(urlWhite, {
        headers: {
            'Accept': 'application/x-ndjson'
        }
    });
    const responseBlack = await fetch(urlBlack, {
        headers: {
            'Accept': 'application/x-ndjson'
        }
    });
    const responseUser = await fetch(urlUser, {
        headers: {
            'Accept': 'application/x-ndjson'
        }
    });

    // The API returns games in NDJSON format
    const textWhite = await responseWhite.text();
    const gamesWhite = textWhite.trim().split('\n').map(JSON.parse);
    
    console.log("Found " + gamesWhite.length + " games as white")
    
    const textBlack = await responseBlack.text();
    const gamesBlack = textBlack.trim().split('\n').map(JSON.parse);
    
    console.log("Found " + gamesBlack.length + " games as black")
    
    const userData = await responseUser.json();
    if (userData.patron) {
        document.getElementById('support-patron').src = 'images/patron.png';
        console.log(`${username} is a patron of Lichess.`);
    }
    
    const totalNumberOfGames = gamesWhite.length + gamesBlack.length
    
    for (let i = 1; i <= 100000; i=i*10) {
        if (totalNumberOfGames >= i) {
            document.getElementById('play-games').src = 'images/play-'+i+'.png';
        }
    }

    let found_opening_sicilian = false;
    let found_opening_french = false;
    let found_opening_pirc = false;
    let found_opening_carokann = false;
    let found_opening_scandinavian = false;
    let found_opening_grob = false;

    gamesWhite.forEach(game => {
        
        // check for Sicilian 1. e4 c5
        if (!found_opening_sicilian && game.moves.startsWith('e4 c5')) {
            document.getElementById('opening-sicilian').src = 'images/unlocked.png';
            console.log("found a Sicilian")
            found_opening_sicilian = true;
        }
        
        // check for French 1. e4 e6
        if (!found_opening_french && game.moves.startsWith('e4 e6')) {
            document.getElementById('opening-french').src = 'images/unlocked.png';
            console.log("found a French")
            found_opening_french = true;
        }
        
        // check for Pirc 1. e4 d6
        if (!found_opening_pirc && game.moves.startsWith('e4 d6')) {
            document.getElementById('opening-pirc').src = 'images/unlocked.png';
            console.log("found a Pirc")
            found_opening_pirc = true;
        }
        
        // check for Caro-Kann 1. e4 c6
        if (!found_opening_carokann && game.moves.startsWith('e4 c6')) {
            document.getElementById('opening-carokann').src = 'images/unlocked.png';
            console.log("found a Caro-Kann")
            found_opening_carokann = true;
        }
        
        // check for Scandinavian 1. e4 d5
        if (!found_opening_scandinavian && game.moves.startsWith('e4 d5')) {
            document.getElementById('opening-scandinavian').src = 'images/unlocked.png';
            console.log("found a Scandinavian")
            found_opening_scandinavian = true;
        }
        
        // check for Grob 1. g4
        if (!found_opening_grob && game.moves.startsWith('g4')) {
            document.getElementById('opening-grob').src = 'images/unlocked.png';
            console.log("found a Grob")
            found_opening_grob = true;
        }
        
    });
    
    gamesBlack.forEach(game => {
        
        // check for Sicilian 1. e4 c5
        if (!found_opening_sicilian && game.moves.startsWith('e4 c5')) {
            document.getElementById('opening-sicilian').src = 'images/unlocked.png';
            console.log("found a Sicilian")
            found_opening_sicilian = true;
        }
        
        // check for French 1. e4 e6
        if (!found_opening_french && game.moves.startsWith('e4 e6')) {
            document.getElementById('opening-french').src = 'images/unlocked.png';
            console.log("found a French")
            found_opening_french = true;
        }
        
        // check for Pirc 1. e4 d6
        if (!found_opening_pirc && game.moves.startsWith('e4 d6')) {
            document.getElementById('opening-pirc').src = 'images/unlocked.png';
            console.log("found a Pirc")
            found_opening_pirc = true;
        }
        
        // check for Caro-Kann 1. e4 c6
        if (!found_opening_carokann && game.moves.startsWith('e4 c6')) {
            document.getElementById('opening-carokann').src = 'images/unlocked.png';
            console.log("found a Caro-Kann")
            found_opening_carokann = true;
        }
        
        // check for Scandinavian 1. e4 d5
        if (!found_opening_scandinavian && game.moves.startsWith('e4 d5')) {
            document.getElementById('opening-scandinavian').src = 'images/unlocked.png';
            console.log("found a Scandinavian")
            found_opening_scandinavian = true;
        }
        
        // check for Grob 1. g4
        if (!found_opening_grob && game.moves.startsWith('g4')) {
            document.getElementById('opening-grob').src = 'images/unlocked.png';
            console.log("found a Grob")
            found_opening_grob = true;
        }
        
    });
    
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
        
        // Check for long castle mate
        if (!found_longCastle_mate && game.winner == "white" && /0-0-0[^ ]*#/.test(game.moves)) {
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
        
        // Check for long castle mate
        if (!found_longCastle_mate && game.winner == "black" && /0-0-0[^ ]*#/.test(game.moves)) {
            document.getElementById('long-castle-mate').src = 'images/unlocked.png';
            found_longCastle_mate = true;
        }
        
    });
    
    // Summarize how many achievements are unlocked in div#summary
    var numAchTotal = document.querySelectorAll('img').length;;
    var numAchUnlocked = document.querySelectorAll('img:not([src="images/locked.png"])').length;

    
    var spanSummary = document.createElement('span');
    spanSummary.textContent = "Unlocked: " + numAchUnlocked + "/" + numAchTotal;
    document.getElementById('summary').appendChild(spanSummary);
    
}
