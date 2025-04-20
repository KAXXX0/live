document.addEventListener('DOMContentLoaded', () => {
  // === Device Detection ===
  const isMobile = /Mobi|Android|iPhone|iPad|iPod|Opera Mini|IEMobile/i.test(navigator.userAgent);
  document.body.classList.toggle('mobile', isMobile);
  document.body.classList.toggle('desktop', !isMobile);

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
  const downloadPlaylistBtn = document.getElementById('download-playlist-btn');
  const uploadPlaylistBtn = document.getElementById('upload-playlist-btn');
  const uploadPlaylistInput = document.getElementById('upload-playlist-input');

  // === Mini/Fullscreen Player Elements ===
  const miniPlayer = document.getElementById('mini-player');
  const miniCover = document.getElementById('mini-cover');
  const miniTitle = document.getElementById('mini-title');
  const miniArtist = document.getElementById('mini-artist');
  const miniPrev = document.getElementById('mini-prev');
  const miniPlay = document.getElementById('mini-play');
  const miniNext = document.getElementById('mini-next');

  const fullscreenPlayer = document.getElementById('fullscreen-player');
  const fullscreenCover = document.getElementById('fullscreen-cover');
  const fullscreenTitle = document.getElementById('fullscreen-title');
  const fullscreenArtist = document.getElementById('fullscreen-artist');
  const fullscreenPrev = document.getElementById('fullscreen-prev');
  const fullscreenPlay = document.getElementById('fullscreen-play');
  const fullscreenNext = document.getElementById('fullscreen-next');
  const fullscreenShuffle = document.getElementById('fullscreen-shuffle');
  const fullscreenReplay = document.getElementById('fullscreen-replay');
  const fullscreenProgress = document.getElementById('fullscreen-progress');
  const fullscreenVolume = document.getElementById('fullscreen-volume');
  const closeFullscreen = document.getElementById('close-fullscreen');

  // Timer elements
  const progressTimer = document.getElementById('progress-timer');
  const fullscreenProgressTimer = document.getElementById('fullscreen-progress-timer');

  // === Mobile/Desktop UI Optimizations ===
  if (isMobile) {
    // Hide hover-only effects, reduce animation, adjust controls for touch
    document.body.style.fontSize = '16px';
    if (volumeSlider) volumeSlider.style.width = '120px';
    if (searchBar) searchBar.setAttribute('placeholder', 'Search...');
    // Optionally, auto-hide nav or make controls bigger
    if (playButton) playButton.style.fontSize = '32px';
    if (prevButton) prevButton.style.fontSize = '32px';
    if (nextButton) nextButton.style.fontSize = '32px';
    if (shuffleButton) shuffleButton.style.fontSize = '28px';
    if (replayButton) replayButton.style.fontSize = '28px';
  } else {
    // Desktop: restore/keep larger controls
    document.body.style.fontSize = '18px';
    if (volumeSlider) volumeSlider.style.width = '150px';
  }

  let songQueue = [];
  let currentIndex = 0;
  let isShuffle = false;
  let isReplay = false;

  const updateNowPlaying = () => {
    const currentTrack = songQueue[currentIndex];
    nowPlaying.textContent = (currentTrack && currentTrack.source)
      ? `🎵 Now Playing: ${currentTrack.title}`
      : '🎵 No song playing';
    updatePlayerUI();
  };

  const refreshPlaylistUI = () => {
    playlist.innerHTML = '';
    songQueue.forEach((track, index) => {
      const listItem = document.createElement('li');
      listItem.textContent = track.title;
      listItem.classList.toggle('active', index === currentIndex);

      // Mark missing songs visually
      if (!track.source) {
        listItem.classList.add('missing');
        listItem.title = 'Missing file. Please re-upload this song.';
      }

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
        let next;
        // Ensure shuffle never repeats the same song twice in a row if possible
        if (songQueue.length > 1) {
          do {
            next = Math.floor(Math.random() * songQueue.length);
          } while (next === currentIndex);
        } else {
          next = currentIndex;
        }
        currentIndex = next;
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
      updateTimers();
    }
  });

  audioPlayer.addEventListener('timeupdate', () => {
    if (audioPlayer.duration) {
      progressBar.value = (audioPlayer.currentTime / audioPlayer.duration) * 100;
    }
    updateTimers();
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

        // Check if this file matches a missing song (by id)
        const existingIndex = songQueue.findIndex(song => song.id === id);
        if (existingIndex !== -1) {
          // Restore missing song with actual file and source
          songQueue[existingIndex] = {
            ...songQueue[existingIndex],
            source,
            file
          };
          await saveSongToDB({ id, title: file.name, size: file.size, file });
        } else {
          // New song
          const track = {
            id,
            title: file.name,
            size: file.size,
            source,
            file
          };
          songQueue.push(track);
          await saveSongToDB({ id, title: file.name, size: file.size, file });
        }
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
    // Trigger shake animation
    shuffleButton.classList.remove('shake');
    void shuffleButton.offsetWidth; // force reflow
    if (isShuffle) shuffleButton.classList.add('shake');
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

  // Show shuffle and replay buttons for better discoverability
  shuffleButton.hidden = false;
  replayButton.hidden = false;

  // Keyboard accessibility for logo/menu toggle
  document.querySelector('.logo').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      navLinks.classList.toggle('active');
    }
  });

  // Keyboard shortcuts for playback (space: play/pause, left/right: prev/next)
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.code === 'Space') {
      playButton.click();
      e.preventDefault();
    }
    if (e.code === 'ArrowRight') {
      nextButton.click();
      e.preventDefault();
    }
    if (e.code === 'ArrowLeft') {
      prevButton.click();
      e.preventDefault();
    }
  });

  // Visual feedback for active shuffle/replay
  shuffleButton.classList.toggle('active', isShuffle);
  replayButton.classList.toggle('active', isReplay);

  // Add download playlist button logic
  downloadPlaylistBtn.onclick = () => {
    // Export playlist as JSON (title, id, size only, no blobs)
    const exportData = songQueue.map(({ id, title, size }) => ({ id, title, size }));
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'playlist.json';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  };

  // Upload Playlist Button Logic
  uploadPlaylistBtn.onclick = () => {
    uploadPlaylistInput.click();
  };

  uploadPlaylistInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const imported = JSON.parse(text);
      let added = 0;
      for (const entry of imported) {
        // Only add if not already present
        if (!songQueue.some(song => song.id === entry.id)) {
          // No file blob, so mark as missing
          songQueue.push({
            id: entry.id,
            title: entry.title,
            size: entry.size,
            source: null,
            file: null
          });
          added++;
        }
      }
      refreshPlaylistUI();
      updateNowPlaying();
      savePlaylist();
      // Prompt user to re-upload missing files
      if (added > 0) {
        alert(`Imported ${added} song(s) from playlist. Missing files must be re-uploaded to play.`);
      }
    } catch (err) {
      alert('Failed to import playlist: Invalid file.');
    }
    uploadPlaylistInput.value = '';
  });

  // === Cover Art Extraction ===
  async function extractCoverArt(file) {
    // Try to extract ID3 cover art (if available)
    return new Promise((resolve) => {
      if (!file || !window.FileReader) return resolve('');
      const reader = new FileReader();
      reader.onload = function(e) {
        const arr = new Uint8Array(e.target.result);
        // Simple ID3v2 APIC search (not a full parser)
        let i = 0;
        while (i < arr.length - 10) {
          if (arr[i] === 0x41 && arr[i+1] === 0x50 && arr[i+2] === 0x49 && arr[i+3] === 0x43) { // 'APIC'
            let picStart = i + 10;
            // Find image data start (skip encoding, mime, etc.)
            let zeroCount = 0;
            for (let j = picStart; j < picStart + 300; j++) {
              if (arr[j] === 0) zeroCount++;
              if (zeroCount === 3) {
                picStart = j + 1;
                break;
              }
            }
            const picEnd = arr.length;
            const blob = new Blob([arr.slice(picStart, picEnd)], {type: 'image/jpeg'});
            return resolve(URL.createObjectURL(blob));
          }
          i++;
        }
        resolve('');
      };
      reader.readAsArrayBuffer(file.slice(0, 256*1024));
    });
  }

  // === Update Mini/Fullscreen Player Info ===
  async function updatePlayerUI() {
    const currentTrack = songQueue[currentIndex];
    let coverUrl = '';
    let artist = '';
    if (currentTrack && currentTrack.file) {
      coverUrl = await extractCoverArt(currentTrack.file);
      if (!coverUrl) coverUrl = 'https://dummyimage.com/180x180/232946/0ff1ce&text=♪';
      // Try to parse artist from filename: "Artist - Title.mp3"
      const parts = currentTrack.title.split(' - ');
      artist = parts.length > 1 ? parts[0] : '';
    } else {
      coverUrl = 'https://dummyimage.com/180x180/232946/0ff1ce&text=♪';
    }
    // Mini player
    miniCover.src = coverUrl;
    miniTitle.textContent = currentTrack ? currentTrack.title : 'No song playing';
    miniArtist.textContent = artist;
    // Fullscreen player
    fullscreenCover.src = coverUrl;
    fullscreenTitle.textContent = currentTrack ? currentTrack.title : 'No song playing';
    fullscreenArtist.textContent = artist;
    // Play/pause icons
    const isPlaying = !audioPlayer.paused && audioPlayer.src;
    miniPlay.textContent = isPlaying ? '⏸' : '▶︎';
    fullscreenPlay.textContent = isPlaying ? '⏸' : '▶︎';
    // Shuffle/replay states
    fullscreenShuffle.classList.toggle('active', isShuffle);
    fullscreenReplay.classList.toggle('active', isReplay);
    // Progress
    if (audioPlayer.duration) {
      fullscreenProgress.value = (audioPlayer.currentTime / audioPlayer.duration) * 100;
    } else {
      fullscreenProgress.value = 0;
    }
    fullscreenVolume.value = audioPlayer.volume;
  }

  // Helper to format seconds as mm:ss
  function formatTime(secs) {
    if (isNaN(secs) || !isFinite(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  function updateTimers() {
    const cur = audioPlayer.currentTime || 0;
    const dur = audioPlayer.duration || 0;
    const curStr = formatTime(cur);
    const durStr = formatTime(dur);
    if (progressTimer) progressTimer.textContent = `${curStr} / ${durStr}`;
    if (fullscreenProgressTimer) fullscreenProgressTimer.textContent = `${curStr} / ${durStr}`;
  }

  // === Mini/Fullscreen Player Controls ===
  function playPause() {
    if (audioPlayer.paused) {
      audioPlayer.play().catch(err => {});
    } else {
      audioPlayer.pause();
    }
    updatePlayerUI();
  }
  miniPlay.onclick = playPause;
  fullscreenPlay.onclick = playPause;
  miniPrev.onclick = () => { prevButton.click(); };
  miniNext.onclick = () => { nextButton.click(); };
  fullscreenPrev.onclick = () => { prevButton.click(); };
  fullscreenNext.onclick = () => { nextButton.click(); };
  fullscreenShuffle.onclick = () => { shuffleButton.click(); };
  fullscreenReplay.onclick = () => { replayButton.click(); };
  fullscreenProgress.addEventListener('input', () => {
    if (audioPlayer.duration) {
      audioPlayer.currentTime = (fullscreenProgress.value / 100) * audioPlayer.duration;
      updateTimers();
    }
  });
  fullscreenVolume.addEventListener('input', () => {
    audioPlayer.volume = fullscreenVolume.value;
  });
  closeFullscreen.onclick = () => {
    closeFullscreenPlayer();
  };

  // Expand/collapse logic
  miniPlayer.onclick = () => {
    // Scroll to top before opening fullscreen player
    window.scrollTo({ top: 0, behavior: 'smooth' });
    fullscreenPlayer.classList.add('active');
    fullscreenPlayer.classList.remove('exit');
    document.body.style.overflow = 'hidden';
    // Hide mini-player (slide down)
    miniPlayer.classList.remove('visible');
  };
  fullscreenPlayer.onclick = (e) => {
    if (e.target === fullscreenPlayer) {
      closeFullscreenPlayer();
    }
  };

  function closeFullscreenPlayer() {
    fullscreenPlayer.classList.add('exit');
    setTimeout(() => {
      fullscreenPlayer.classList.remove('active');
      fullscreenPlayer.classList.remove('exit');
      document.body.style.overflow = '';
      // Show mini-player (slide up)
      miniPlayer.classList.add('visible');
    }, 400); // Match CSS transition duration
  }

  // Sync UI on playback events
  audioPlayer.addEventListener('play', updatePlayerUI);
  audioPlayer.addEventListener('pause', updatePlayerUI);
  audioPlayer.addEventListener('timeupdate', updatePlayerUI);
  audioPlayer.addEventListener('volumechange', updatePlayerUI);

  // Also update timers on play, pause, and when loading new track
  audioPlayer.addEventListener('play', updateTimers);
  audioPlayer.addEventListener('pause', updateTimers);
  audioPlayer.addEventListener('loadedmetadata', updateTimers);

  // Show mini-player on load (slide up)
  miniPlayer.classList.add('visible');

  // Initial timer update
  updateTimers();

  updateNowPlaying();
  loadPlaylist();
});
