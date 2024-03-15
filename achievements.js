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
    let found_opening_sicilian = false;
    let found_opening_french = false;
    let found_opening_pirc = false;
    let found_opening_carokann = false;
    let found_opening_scandinavian = false;
    let found_opening_grob = false;
    let found_opening_bongcloud = false;
    let found_mate_queen = false;
    let found_mate_rook = false;
    let found_mate_bishop = false;
    let found_mate_knight = false;
    let found_mate_shortCastle = false;
    let found_mate_longCastle = false;
    
    let counter = 1; // this lets the user know where we're at with analyzing the games
    
    for (let i = 0; i < gamesWhite.length; i++) {
        const game = gamesWhite[i];
    
        loadDiv.innerHTML = 'Analyzing game ' + i + '/' + numberOfGamesTotal;
    
        // check for Grob 1. g4
        if (!found_opening_grob && game.moves.startsWith('g4')) {
            document.getElementById('opening-grob').src = 'images/opening-grob.png';
            console.log("found a Grob");
            found_opening_grob = true;
        }
        
        // Check for queen mate
        if (!found_mate_queen && game.winner == "white" && /Q[^ ]*#/.test(game.moves)) {
            document.getElementById('queen-mate').src = 'images/unlocked.png';
            found_mate_queen = true;
        }
        
        counter += 1;
        
        await sleep(10);
    }
    
    for (let i = 0; i < gamesBlack.length; i++) {
        const game = gamesBlack[i];
    
        loadDiv.innerHTML = 'Analyzing game ' + i + '/' + numberOfGamesTotal;
    
        // check for Sicilian 1. e4 c5
        if (!found_opening_sicilian && game.moves.startsWith('e4 c5')) {
            document.getElementById('opening-sicilian').src = 'images/opening-sicilian.png';
            console.log("found a Sicilian")
            console.log()
            found_opening_sicilian = true;
        }
        
        // Check for queen mate
        if (!found_mate_queen && game.winner == "black" && /Q[^ ]*#/.test(game.moves)) {
            document.getElementById('queen-mate').src = 'images/unlocked.png';
            found_mate_queen = true;
        }
        
        counter += 1;
        
        await sleep(10);
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
        console.log("${username}'s account is ${age.toString().padStart(2, '0')} years old.");
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
