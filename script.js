document.addEventListener('DOMContentLoaded', () => {
  // === IndexedDB Utilities ===
  const dbName = 'musicPlayerDB';
  const storeName = 'songs';

  const openDB = () => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName, 1);
      request.onerror = () => reject('Failed to open IndexedDB');
      request.onsuccess = () => resolve(request.result);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName, { keyPath: 'id' });
        }
      };
    });
  };

  const saveSongToDB = async (song) => {
    const db = await openDB();
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).put(song);
    return tx.complete;
  };

  const getAllSongsFromDB = async () => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject('Failed to get songs');
    });
  };

  const clearDB = async () => {
    const db = await openDB();
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).clear();
    return tx.complete;
  };

  // === DOM Elements ===
  const audioPlayer = document.getElementById('audio');
  const dropZone = document.getElementById('drop-zone');
  const playlist = document.getElementById('playlist');
  const nowPlaying = document.getElementById('now-playing');
  const playButton = document.getElementById('play');
  const nextButton = document.getElementById('next');
  const prevButton = document.getElementById('prev');
  const volumeSlider = document.getElementById('volume');
  const progressBar = document.getElementById('progress-bar');
  const searchBar = document.getElementById('search-bar');
  const clearPlaylistButton = document.getElementById('clear-playlist');
  const fileUpload = document.getElementById('file-upload');
  const themeToggle = document.getElementById('theme-toggle');
  const shuffleButton = document.getElementById('shuffle');
  const replayButton = document.getElementById('replay');

  let songQueue = [];
  let currentIndex = 0;
  let isShuffle = false;
  let isReplay = false;

  const updateNowPlaying = () => {
    const currentTrack = songQueue[currentIndex];
    nowPlaying.textContent = (currentTrack && currentTrack.source)
      ? `🎵 Now Playing: ${currentTrack.title}`
      : '🎵 No song playing';
  };

  const refreshPlaylistUI = () => {
    playlist.innerHTML = '';
    songQueue.forEach((track, index) => {
      const listItem = document.createElement('li');
      listItem.textContent = track.title;
      listItem.classList.toggle('active', index === currentIndex);

      listItem.onclick = () => {
        if (track.source) {
          currentIndex = index;
          playTrack();
        } else {
          alert('This song is not available. Please re-upload it.');
        }
      };

      const deleteButton = document.createElement('button');
      deleteButton.textContent = '❌';
      deleteButton.onclick = async (e) => {
        e.stopPropagation();
        await deleteFromDB(track.id);
        songQueue.splice(index, 1);
        if (index === currentIndex) {
          audioPlayer.pause();
          currentIndex = 0;
          if (songQueue.length && songQueue[currentIndex].source) playTrack();
        } else if (index < currentIndex) {
          currentIndex--;
        }
        refreshPlaylistUI();
        updateNowPlaying();
        savePlaylist();
      };

      listItem.appendChild(deleteButton);
      playlist.appendChild(listItem);
    });
  };

  const playTrack = () => {
    const currentTrack = songQueue[currentIndex];
    if (!currentTrack || !currentTrack.source) return;
    audioPlayer.src = currentTrack.source;
    audioPlayer.play().catch(err => console.error('Playback failed:', err));
    playButton.textContent = '⏸';
    updateNowPlaying();
    refreshPlaylistUI();
  };

  playButton.onclick = () => {
    if (audioPlayer.paused) {
      audioPlayer.play().catch(err => console.error('Playback failed:', err));
      playButton.textContent = '⏸';
    } else {
      audioPlayer.pause();
      playButton.textContent = '▶︎';
    }
  };

  nextButton.onclick = () => {
    if (songQueue.length) {
      if (isShuffle) {
        currentIndex = Math.floor(Math.random() * songQueue.length);
      } else {
        currentIndex = (currentIndex + 1) % songQueue.length;
      }
      playTrack();
    }
  };

  prevButton.onclick = () => {
    if (songQueue.length) {
      currentIndex = (currentIndex - 1 + songQueue.length) % songQueue.length;
      playTrack();
    }
  };

  volumeSlider.oninput = () => {
    audioPlayer.volume = volumeSlider.value;
  };

  progressBar.addEventListener('input', () => {
    if (audioPlayer.duration) {
      audioPlayer.currentTime = (progressBar.value / 100) * audioPlayer.duration;
    }
  });

  audioPlayer.addEventListener('timeupdate', () => {
    if (audioPlayer.duration) {
      progressBar.value = (audioPlayer.currentTime / audioPlayer.duration) * 100;
    }
  });

  audioPlayer.addEventListener('ended', () => {
    if (isReplay) {
      playTrack();
    } else {
      nextButton.onclick();
    }
  });

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('hover');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('hover');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('hover');
    handleFiles(e.dataTransfer.files);
  });

  fileUpload.addEventListener('change', (e) => {
    handleFiles(e.target.files);
  });

  const handleFiles = async (files) => {
    for (const file of files) {
      if (file.type === 'audio/mpeg') {
        const id = `${file.name}-${file.size}`;
        const source = URL.createObjectURL(file);

        const track = {
          id,
          title: file.name,
          size: file.size,
          source,
          file
        };

        const existingIndex = songQueue.findIndex(song => song.id === id);
        if (existingIndex !== -1) {
          songQueue[existingIndex] = track;
        } else {
          songQueue.push(track);
        }

        await saveSongToDB({ id, title: file.name, size: file.size, file });
      }
    }

    if (!audioPlayer.src && songQueue.length) {
      const firstPlayable = songQueue.findIndex(song => song.source);
      if (firstPlayable !== -1) {
        currentIndex = firstPlayable;
        playTrack();
      }
    }

    refreshPlaylistUI();
    updateNowPlaying();
    savePlaylist();
  };

  const deleteFromDB = async (id) => {
    const db = await openDB();
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).delete(id);
    return tx.complete;
  };

  const savePlaylist = () => {
    localStorage.setItem('currentIndex', currentIndex);
  };

  const loadPlaylist = async () => {
    const savedIndex = localStorage.getItem('currentIndex');
    currentIndex = savedIndex ? parseInt(savedIndex, 10) : 0;

    const storedSongs = await getAllSongsFromDB();
    songQueue = storedSongs.map(song => ({
      id: song.id,
      title: song.title,
      size: song.size,
      source: URL.createObjectURL(song.file),
      file: song.file
    }));

    refreshPlaylistUI();
    updateNowPlaying();
  };

  searchBar.addEventListener('input', () => {
    const query = searchBar.value.toLowerCase();
    [...playlist.children].forEach((item) => {
      const title = item.firstChild.textContent.toLowerCase();
      item.style.display = title.includes(query) ? '' : 'none';
    });
  });

  clearPlaylistButton.onclick = async () => {
    songQueue = [];
    audioPlayer.pause();
    currentIndex = 0;
    await clearDB();
    refreshPlaylistUI();
    updateNowPlaying();
    savePlaylist();
  };

  themeToggle.onclick = () => {
    document.body.classList.toggle('dark-mode');
    document.body.classList.toggle('light-mode');
  };

  shuffleButton.onclick = () => {
    isShuffle = !isShuffle;
    shuffleButton.classList.toggle('active', isShuffle);
  };

  replayButton.onclick = () => {
    isReplay = !isReplay;
    replayButton.classList.toggle('active', isReplay);
  };

  const navbar = document.querySelector('.navbar');
  const navLinks = document.querySelector('.nav-links');

  // Add scroll reaction to change navbar style
  window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  });

  // Toggle mobile menu
  document.querySelector('.logo').addEventListener('click', () => {
    navLinks.classList.toggle('active');
  });

  updateNowPlaying();
  loadPlaylist();
});
