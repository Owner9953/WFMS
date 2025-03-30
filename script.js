// script.js
const TMDB_API_KEY = '3fd2be6f0c70a2a598f084ddfb75487c';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

let page = 1;
let loading = false;
let currentSection = 'home';
let isSearchActive = false;
let searchTimeout;

async function fetchTMDBData(endpoint, params = {}) {
  try {
    const response = await axios.get(`${TMDB_BASE_URL}${endpoint}`, {
      params: {
        api_key: TMDB_API_KEY,
        language: 'en-US',
        page: page,
        ...params
      }
    });
    return response.data.results;
  } catch (error) {
    console.error('Error fetching TMDB data:', error);
    return [];
  }
}

async function loadContent(section = 'home', append = false) {
  if (loading) return;
  loading = true;
  document.getElementById('loading').style.display = 'block';

  let content = [];
  const featuredContent = document.getElementById('featured-content');

  if (!append) {
    featuredContent.innerHTML = '';
    page = 1;
  }

  switch (section) {
    case 'home':
      const movies = await fetchTMDBData('/movie/popular');
      const tvShows = await fetchTMDBData('/tv/popular');
      content = [...movies, ...tvShows].sort(() => 0.5 - Math.random());
      document.getElementById('content-title').textContent = 'Featured Content';
      setActiveNavLink('home');
      break;
    case 'movies':
      content = await fetchTMDBData('/movie/popular');
      document.getElementById('content-title').textContent = 'Popular Movies';
      setActiveNavLink('movies');
      break;
    case 'tv-series':
      content = await fetchTMDBData('/tv/popular');
      document.getElementById('content-title').textContent = 'Popular TV Series';
      setActiveNavLink('tv-series');
      break;
    case 'top-rated':
      const topMovies = await fetchTMDBData('/movie/top_rated');
      const topTvShows = await fetchTMDBData('/tv/top_rated');
      content = [...topMovies, ...topTvShows].sort((a, b) => b.vote_average - a.vote_average);
      document.getElementById('content-title').textContent = 'Top Rated';
      setActiveNavLink('top-rated');
      break;
    case 'upcoming':
      content = await fetchTMDBData('/movie/upcoming');
      document.getElementById('content-title').textContent = 'Upcoming Movies';
      setActiveNavLink('upcoming');
      break;
    default:
      content = [];
  }

  displayContent(content);

  page++;
  loading = false;
  document.getElementById('loading').style.display = 'none';
}

async function searchContent(query, append = false) {
  if (loading) return;
  loading = true;
  document.getElementById('loading').style.display = 'block';

  const featuredContent = document.getElementById('featured-content');

  if (!append) {
    featuredContent.innerHTML = '';
    page = 1;
  }

  document.getElementById('content-title').textContent = `Search Results for "${query}"`;
  setActiveNavLink(null); // Clear active nav link during search

  const movieResults = await fetchTMDBData('/search/movie', { query });
  const tvResults = await fetchTMDBData('/search/tv', { query });

  const content = [...movieResults, ...tvResults].sort(() => 0.5 - Math.random());

  displayContent(content);

  page++;
  loading = false;
  document.getElementById('loading').style.display = 'none';
}

function displayContent(content) {
  const featuredContent = document.getElementById('featured-content');

  for (const item of content) {
    const isMovie = item.hasOwnProperty('title');

    const div = document.createElement('div');
    div.className = 'content-item';
    div.innerHTML = `
      <img src="https://image.tmdb.org/t/p/w500${item.poster_path}" alt="${isMovie ? item.title : item.name} poster" width="200" height="300">
      <div class="info">
        <h3>${isMovie ? item.title : item.name}</h3>
        <p>${isMovie ? (item.release_date ? item.release_date.split('-')[0] : 'N/A') : (item.first_air_date ? item.first_air_date.split('-')[0] : 'N/A')} | ${item.vote_average.toFixed(1)} ⭐</p>
      </div>
    `;
    div.addEventListener('click', () => openModal(item, isMovie));
    featuredContent.appendChild(div);
  }
}

async function openModal(item, isMovie) {
  const modal = document.getElementById('modal');
  const modalContent = modal.querySelector('.modal-content');

  try {
    const details = await fetchTMDBItem(item.id, isMovie ? 'movie' : 'tv');

    modalContent.innerHTML = `
      <div class="modal-header">
        <h2>${isMovie ? details.title : details.name}</h2>
        <span class="close"><i class="fas fa-times"></i></span>
      </div>
      <div class="modal-body">
        <div class="modal-poster">
          <img src="https://image.tmdb.org/t/p/w500${details.poster_path}" alt="${isMovie ? details.title : details.name} poster">
        </div>
        <div class="modal-details">
          <p><strong>Overview:</strong> ${details.overview}</p>
          <p><strong>Release Date:</strong> ${isMovie ? details.release_date : details.first_air_date}</p>
          <p><strong>Rating:</strong> ${details.vote_average.toFixed(1)} / 10</p>
          <p><strong>Genres:</strong> ${details.genres.map(genre => `<span class="tag">${genre.name}</span>`).join('')}</p>
          <p><strong>Runtime:</strong> ${isMovie ? `${details.runtime} minutes` : `${details.episode_run_time[0] || 'N/A'} minutes per episode`}</p>
          <p><strong>Status:</strong> ${details.status}</p>
          ${isMovie ? `
            <p><strong>Budget:</strong> $${details.budget.toLocaleString()}</p>
            <p><strong>Revenue:</strong> $${details.revenue.toLocaleString()}</p>
          ` : ''}
          <p><strong>IMDB ID:</strong> <a href="https://www.imdb.com/title/${details.imdb_id}" target="_blank">${details.imdb_id}</a></p>
          <h3>Cast</h3>
          <div id="modal-cast"></div>
          ${isMovie ? `<h3>Director</h3><p id="modal-director"></p>` : ''}
          <h3>Production Companies</h3>
          <div>${details.production_companies.map(company => `<span class="tag">${company.name}</span>`).join('')}</div>
        </div>
      </div>
      <div class="modal-trailer">
        <h3>Watch</h3>
        <div id="modal-trailer-container"></div>
      </div>
      <div class="similar-content">
        <h3>Similar Content</h3>
        <div id="modal-similar-content" class="similar-items"></div>
      </div>
    `;

    // Cast
    const castContainer = modalContent.querySelector('#modal-cast');
    const castMembers = details.credits.cast.slice(0, 5);
    castContainer.innerHTML = castMembers.map(actor => `
      <div class="cast-member" data-id="${actor.id}">
        <img src="https://image.tmdb.org/t/p/w200${actor.profile_path}" alt="${actor.name}" onerror="this.src='https://via.placeholder.com/50'">
        <span>${actor.name} as ${actor.character}</span>
      </div>
    `).join('');

    // Add event listeners to cast members
    const castElements = castContainer.querySelectorAll('.cast-member');
    castElements.forEach(castElement => {
      castElement.addEventListener('click', () => openPersonModal(castElement.getAttribute('data-id')));
    });

    // Director (for movies only)
    if (isMovie) {
      const directorContainer = modalContent.querySelector('#modal-director');
      const director = details.credits.crew.find(crew => crew.job === 'Director');
      directorContainer.textContent = director ? director.name : 'N/A';
    }

    // Trailer
    const trailerContainer = modalContent.querySelector('#modal-trailer-container');
    trailerContainer.innerHTML = ''; // Clear existing trailer content

    if (details.imdb_id) {
      const embedURL = isMovie
        ? `https://vidsrc.to/embed/movie/${details.imdb_id}`
        : `https://vidsrc.to/embed/tv/${details.imdb_id}`;
      trailerContainer.innerHTML = `
        <h3>Watch (Use Adblocker for Best Result)</h3>
        <iframe src="${embedURL}" frameborder="0" allowfullscreen style="width:100%;height:450px;"></iframe>
      `;
    } else {
      const trailer = details.videos.results.find(video => video.type === 'Trailer');
      if (trailer) {
        trailerContainer.innerHTML = `
          <h3>Watch (Use Adblocker for Best Result)</h3>
          <iframe src="https://www.youtube.com/embed/${trailer.key}" frameborder="0" allowfullscreen style="width:100%;height:450px;"></iframe>
        `;
      } else {
        trailerContainer.innerHTML = '<p>No trailer available</p>';
      }
    }

    // Similar Content
    const similarContainer = modalContent.querySelector('#modal-similar-content');
    const similarContent = details.similar.results.slice(0, 6);
    similarContainer.innerHTML = similarContent.map(similar => `
      <div class="similar-item" data-id="${similar.id}" data-type="${isMovie ? 'movie' : 'tv'}">
        <img src="https://image.tmdb.org/t/p/w200${similar.poster_path}" alt="${similar.title || similar.name}" onerror="this.src='https://via.placeholder.com/100x150'">
        <p>${similar.title || similar.name}</p>
      </div>
    `).join('');

    // Add event listeners to similar content items
    const similarItems = similarContainer.querySelectorAll('.similar-item');
    similarItems.forEach(item => {
      item.addEventListener('click', async () => {
        const itemId = item.getAttribute('data-id');
        const itemType = item.getAttribute('data-type');
        const itemDetails = await fetchTMDBItem(itemId, itemType);
        openModal(itemDetails, itemType === 'movie');
      });
    });

    // Close button event listener
    const closeBtn = modalContent.querySelector('.close');
    closeBtn.addEventListener('click', () => {
      modal.style.display = 'none';
    });

    modal.style.display = 'block';
  } catch (error) {
    console.error('Error opening modal:', error);
  }
}

async function openPersonModal(personId) {
  try {
    const person = await fetchTMDBItem(personId, 'person');

    const modal = document.getElementById('modal');
    const modalContent = modal.querySelector('.modal-content');

    modalContent.innerHTML = `
      <div class="modal-header">
        <h2>${person.name}</h2>
        <span class="close"><i class="fas fa-times"></i></span>
      </div>
      <div class="modal-body">
        <div class="modal-poster">
          <img src="https://image.tmdb.org/t/p/w300${person.profile_path}" alt="${person.name}" onerror="this.src='https://via.placeholder.com/300x450'">
        </div>
        <div class="modal-details">
          <p><strong>Birthday:</strong> ${person.birthday || 'N/A'}</p>
          <p><strong>Place of Birth:</strong> ${person.place_of_birth || 'N/A'}</p>
          <p><strong>Known For:</strong> ${person.known_for_department}</p>
          <h3>Biography</h3>
          <p>${person.biography || 'No biography available.'}</p>
          <h3>Known For</h3>
          <div class="known-for-content">
            ${person.combined_credits.cast.slice(0, 6).map(item => `
              <div class="known-for-item" data-id="${item.id}" data-type="${item.media_type}">
                <img src="https://image.tmdb.org/t/p/w200${item.poster_path}" alt="${item.title || item.name}" onerror="this.src='https://via.placeholder.com/100x150'">
                <p>${item.title || item.name}</p>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    // Add event listeners to known for items
    const knownForItems = modalContent.querySelectorAll('.known-for-item');
    knownForItems.forEach(item => {
      item.addEventListener('click', async () => {
        const itemId = item.getAttribute('data-id');
        const itemType = item.getAttribute('data-type');
        const itemDetails = await fetchTMDBItem(itemId, itemType);
        openModal(itemDetails, itemType === 'movie');
      });
    });

    // Add event listener to close button
    const closeBtn = modalContent.querySelector('.close');
    closeBtn.addEventListener('click', () => {
      modal.style.display = 'none';
    });

    modal.style.display = 'block';
  } catch (error) {
    console.error('Error fetching person details:', error);
  }
}

async function fetchTMDBItem(id, type) {
  try {
    const response = await axios.get(`${TMDB_BASE_URL}/${type}/${id}`, {
      params: {
        api_key: TMDB_API_KEY,
        append_to_response: 'credits,videos,similar,combined_credits,external_ids'
      }
    });
    const data = response.data;
    if (data.external_ids) {
      if (type === 'movie') {
        data.imdb_id = data.external_ids.imdb_id;
      } else if (type === 'tv') {
        data.imdb_id = data.external_ids.imdb_id;
      }
    } else {
      data.imdb_id = 'N/A';
    }
    return data;
  } catch (error) {
    console.error('Error fetching TMDB item:', error);
    return null;
  }
}

function setActiveNavLink(section) {
  const navLinks = document.querySelectorAll('nav ul li a');
  navLinks.forEach(link => {
    if (link.getAttribute('data-section') === section) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('search-input');
  const navLinks = document.querySelectorAll('nav ul li a');
  const modal = document.getElementById('modal');
  const lightModeToggle = document.getElementById('light-mode-toggle');

  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.trim();
    clearTimeout(searchTimeout);

    if (query) {
      searchTimeout = setTimeout(() => {
        isSearchActive = true;
        searchContent(query);
      }, 500);
    } else {
      isSearchActive = false;
      loadContent(currentSection);
    }
  });

  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const section = e.target.getAttribute('data-section');
      currentSection = section;
      isSearchActive = false;
      searchInput.value = '';
      loadContent(section);
    });
  });

  window.addEventListener('click', (event) => {
    if (event.target === modal) {
      modal.style.display = 'none';
    }
  });

  lightModeToggle.addEventListener('click', () => {
    document.body.classList.toggle('light-mode');
    const icon = lightModeToggle.querySelector('i');
    if (document.body.classList.contains('light-mode')) {
      icon.classList.remove('fa-sun');
      icon.classList.add('fa-moon');
    } else {
      icon.classList.remove('fa-moon');
      icon.classList.add('fa-sun');
    }
  });

  loadContent(currentSection); // Load initial content based on default section (home)

  window.addEventListener('scroll', () => {
    if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 500 && !loading) {
      if (isSearchActive) {
        searchContent(searchInput.value.trim(), true);
      } else {
        loadContent(currentSection, true);
      }
    }
  });
});