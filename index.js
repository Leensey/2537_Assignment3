// Global variables for timer, total pairs, and Pokémon data cache
let timerInterval;
let totalPairs;
let allPokemon = [];

// Settings for each difficulty level
const levelSettings = {
  easy: { pairs: 3, time: 30 },
  medium: { pairs: 6, time: 60 },
  hard: { pairs: 9, time: 90 },
};

// Fetches a list of all Pokémon (name and URL) from the PokéAPI
async function fetchPokemon() {
  const res = await fetch("https://pokeapi.co/api/v2/pokemon?limit=1500");
  const data = await res.json();
  return data.results; // Array of { name, url }
}

// Selects random Pokémon, fetches their images, and returns a shuffled array of paired image URLs
async function getPokemonImage(allPokemon, count) {
  const selected = []; // Array to hold selected Pokémon
  const used = new Set(); // To avoid duplicatesx

  // Randomly select 'count' unique Pokémon
  while (selected.length < count) {
    const randomIndex = Math.floor(Math.random() * allPokemon.length);
    if (!used.has(randomIndex)) {
      const id = parseInt(allPokemon[randomIndex].url.split("/").slice(-2, -1)[0]);
      const image = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;

      const exists = await new Promise((resolve) => {
        const img = new Image();
        img.src = image;
        img.onload = () => resolve(true);
        img.onerror = () => resolve(false);
      });

      if (exists) {
        used.add(randomIndex);
        selected.push({ name: `pokemon-${id}`, image });
      }
    }
  }

  // Preload only selected images to ensure they're ready for the game
  const preloadImage = (src) =>
    new Promise((resolve) => {
      const img = new Image();
      img.src = src;
      img.onload = () => resolve(src);
    });

  // Wait for all images to load
  const loadedImages = await Promise.all(
    selected.map(p => preloadImage(p.image))
  );

  // Duplicate each image (for matching pairs) and shuffle the array
  const cards = loadedImages.flatMap((src) => [src, src]);
  return cards.sort(() => 0.5 - Math.random());
}

// Main function to set up the game board for a given difficulty level
async function setup(level = 'easy') {
  $('#loading').show(); // Show loading spinner

  // Local state for the current game
  let firstCard = null;
  let secondCard = null;
  let lockBoard = false;
  let matchedPairs = 0;
  const { pairs, time } = levelSettings[level];
  totalPairs = pairs;
  let timeLeft = time;
  let clickCount = 0;
  let powerUpUsed = false;

  // Clear previous game board and set body class for difficulty
  $('#game_grid').empty();
  $('body').removeClass('easy medium hard').addClass(level);

  // Fetch all Pokémon only once and cache for future games
  if (allPokemon.length === 0) {
    allPokemon = await fetchPokemon();
  }

  // Get shuffled card images for the current game
  const cardImages = await getPokemonImage(allPokemon, totalPairs);

  // Create card elements and add them to the game grid
  cardImages.forEach((src) => {
    const card = $(`
      <div class="card">
        <img class="front_face" src="${src}" />
        <img class="back_face" src="back.webp" />
      </div>
    `);
    $('#game_grid').append(card);
  });

  $('#loading').hide(); // Hide loading spinner

  // Card click event handler
  $(".card").on("click", function () {
    if (lockBoard || $(this).hasClass("flip")) return; // Ignore if board is locked or card is already flipped

    $(this).addClass("flip");
    clickCount++;
    updateStatus();

    if (!firstCard) {
      firstCard = this;
      return;
    }

    secondCard = this;
    lockBoard = true; // Prevent further clicks until check is done

    const img1 = $(firstCard).find(".front_face").attr("src");
    const img2 = $(secondCard).find(".front_face").attr("src");

    if (img1 === img2) {
      // Match found: disable further clicks on these cards
      $(firstCard).off("click");
      $(secondCard).off("click");
      matchedPairs++;

      // Power-up: freeze timer for 5 seconds after first match
      if (!powerUpUsed && matchedPairs === 1) {
        powerUpUsed = true;
        clearInterval(timerInterval);
        $('#powerup-message').text('⏸️ Power-Up Activated: Timer Frozen for 5 Seconds!');
        setTimeout(() => {
          $('#powerup-message').text('');
          startTimer();
        }, 5000);
      }

      updateStatus();

      // Check for win condition
      if (matchedPairs === totalPairs) {
        setTimeout(() => {
          alert("You won!");
          clearInterval(timerInterval);
          lockBoard = true;
        }, 300);
      }

      resetTurn();
    } else {
      // No match: flip cards back after a short delay
      setTimeout(() => {
        $(firstCard).removeClass("flip");
        $(secondCard).removeClass("flip");
        resetTurn();
      }, 1000);
    }
  });

  // Helper to reset turn state
  function resetTurn() {
    [firstCard, secondCard] = [null, null];
    lockBoard = false;
    updateStatus();
  }

  // Update game status display
  function updateStatus() {
    $('#clicks').text(`Clicks: ${clickCount}`);
    $('#pairs-left').text(`Pairs left: ${totalPairs - matchedPairs}`);
    $('#pairs-matched').text(`Pairs matched: ${matchedPairs}`);
    $('#total-pairs').text(`Total pairs: ${totalPairs}`);
  }

  // Start or restart the countdown timer
  function startTimer() {
    $('#timer').text(`Time left: ${timeLeft}s`);
    timerInterval = setInterval(() => {
      timeLeft--;
      $('#timer').text(`Time left: ${timeLeft}s`);

      if (timeLeft <= 0) {
        clearInterval(timerInterval);
        lockBoard = true;
        alert("Game Over!");
      }
    }, 1000);
  }

  updateStatus(); // Show initial status
  startTimer();   // Start the timer
}

// Resets the game board and UI
function resetGame() {
  clearInterval(timerInterval);
  $('#game_grid').empty();
  $('body').removeClass('easy medium hard');
}

// jQuery: runs when the page is fully loaded
$(document).ready(function () {
  // Set initial theme based on dropdown value
  $('body').addClass($('#theme-select').val());

  // Start button: reset and start a new game with selected difficulty
  $('#start-btn').on('click', function () {
    const level = $('#difficulty').val();
    resetGame();
    setup(level);
  });

  // Reset button: just reset the board/UI
  $('#reset-btn').on('click', function () { 
    resetGame();
    //reset status display
    $('#clicks').text('Clicks: 0');
    $('#pairs-left').text('Pairs left: 0');
    $('#pairs-matched').text('Pairs matched: 0');
    $('#total-pairs').text('Total pairs: 0');
    $('#timer').text('Time left: 0s');
  });

  // Theme selector: change the theme when dropdown changes
  $('#theme-select').on('change', function () {
    const selectedTheme = $(this).val();
    $('body').removeClass('light dark').addClass(selectedTheme);
  });
});
