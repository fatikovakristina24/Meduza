const CONFIG = {
  restartWholeGame: false,
  clickerTargetScore: 20,
  clickerDuration: 30,
  memoryRounds: [3, 4, 5],
  wordList: ['медуза', 'океан', 'щупальца', 'вода', 'ожог'],
  wishes: [
    'Не бойся течения, ты умеешь плыть',
    'Океан хранит свои тайны, а ты храни свой свет',
    'Красота медузы в ее спокойной свободе',
    'Шторм проходит, океан остаётся',
    'Тишина моря тоже музыка',
    'Волны стирают лишнее, оставляют настоящее',
    'Течения рисуют маршруты'
  ]
};

const state = {
  unlocked: {
    start: true,
    memory: false,
    clicker: false,
    words: false,
    victory: false,
    wishes: false
  },
  memory: {
    roundIndex: 0,
    sequence: [],
    userSequence: [],
    isPlayingBack: false,
    canInteract: false,
    cells: []
  },
  clicker: {
    score: 0,
    timeLeft: CONFIG.clickerDuration,
    started: false,
    timerId: null,
    angry: false,
    angryTimeout: null,
    angryIntervalId: null,
    locked: false,
    finished: false
  },
  words: {
    rows: 11,
    cols: 18,
    grid: [],
    selected: [],
    solved: new Set(),
    placements: [],
    dragging: false,
    dragStart: null,
    finished: false
  },
  wishes: {
    shown: new Set()
  }
};

const el = {
  startGameButton: document.getElementById('startGameButton'),
  replayAllButton: document.getElementById('replayAllButton'),
  memorySection: document.getElementById('memory-section'),
  memoryGrid: document.getElementById('memoryGrid'),
  memoryRound: document.getElementById('memoryRound'),
  memoryStatus: document.getElementById('memoryStatus'),
  memoryStartButton: document.getElementById('memoryStartButton'),
  memoryRestartButton: document.getElementById('memoryRestartButton'),
  clickerSection: document.getElementById('clicker-section'),
  clickerScore: document.getElementById('clickerScore'),
  clickerTime: document.getElementById('clickerTime'),
  clickerStatus: document.getElementById('clickerStatus'),
  clickerJelly: document.getElementById('clickerJelly'),
  clickerJellyImage: document.getElementById('clickerJellyImage'),
  clickerDangerBurst: document.getElementById('clickerDangerBurst'),
  clickerRestartButton: document.getElementById('clickerRestartButton'),
  wordsSection: document.getElementById('words-section'),
  wordGrid: document.getElementById('wordGrid'),
  wordsFound: document.getElementById('wordsFound'),
  wordsClearSelection: document.getElementById('wordsClearSelection'),
  wordsRestartButton: document.getElementById('wordsRestartButton'),
  victorySection: document.getElementById('victory-section'),
  wishesSection: document.getElementById('wishes-section'),
  bubblesField: document.getElementById('bubblesField'),
  messageModal: document.getElementById('messageModal'),
  messageModalTitle: document.getElementById('messageModalTitle'),
  messageModalText: document.getElementById('messageModalText'),
  messageModalClose: document.getElementById('messageModalClose'),
  messageModalAction: document.getElementById('messageModalAction'),
  wishStack: document.getElementById('wishStack')
};

const jellyfishAssets = [
  'assets/jellyfish-white-idle.svg',
  'assets/jellyfish-pink-idle.svg',
  'assets/jellyfish-blue-idle.svg',
  'assets/jellyfish-white-idle.svg',
  'assets/jellyfish-white-idle.svg',
  'assets/jellyfish-blue-idle.svg',
  'assets/jellyfish-pink-idle.svg',
  'assets/jellyfish-white-idle.svg'
];

function shuffle(array) {
  const clone = [...array];
  for (let i = clone.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [clone[i], clone[j]] = [clone[j], clone[i]];
  }
  return clone;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function normalizeWord(word) {
  return word.toLowerCase().replace(/ё/g, 'е');
}

function getWordCols() {
  if (window.innerWidth <= 680) return 10;
  if (window.innerWidth <= 900) return 12;
  return 18;
}

function getWordRows() {
  if (window.innerWidth <= 680) return 12;
  return 11;
}

function unlockSection(key, section, options = {}) {
  state.unlocked[key] = true;
  section.classList.remove('is-locked');
  section.classList.add('is-active');
  if (options.scroll) {
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

let currentModalAction = null;

function showMessage({ title, text, buttonText = 'Продолжить', onAction }) {
  currentModalAction = typeof onAction === 'function' ? onAction : null;
  el.messageModal.hidden = false;
  el.messageModalTitle.textContent = title || '';
  el.messageModalText.textContent = text || '';
  el.messageModalAction.textContent = buttonText;
  el.messageModalAction.onclick = () => closeMessage({ runAction: true });
}

function closeMessage({ runAction = false } = {}) {
  const action = currentModalAction;
  currentModalAction = null;
  el.messageModal.hidden = true;
  if (runAction && typeof action === 'function') action();
}

el.messageModalClose.addEventListener('click', () => closeMessage({ runAction: true }));
el.messageModal.addEventListener('click', (event) => {
  if (event.target === el.messageModal) closeMessage({ runAction: true });
});

function toggleStartCreatureColor(node) {
  const src = node.getAttribute('src') || '';
  if (src.includes('pink')) {
    node.setAttribute('src', src.replace('pink', 'blue'));
    return;
  }
  if (src.includes('blue')) {
    node.setAttribute('src', src.replace('blue', 'pink'));
  }
}

function setActiveStartCreature(node) {
  document.querySelectorAll('#start-section .start-banner__jelly, #start-section .start-banner__fish').forEach((item) => {
    item.classList.toggle('is-boosted', item === node);
  });
}

function bindStartScreenInteractions() {
  const creatures = document.querySelectorAll('#start-section .start-banner__jelly, #start-section .start-banner__fish');
  const stars = document.querySelectorAll('#start-section .start-banner__star');

  creatures.forEach((node) => {
    node.setAttribute('draggable', 'false');
    node.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      toggleStartCreatureColor(node);
      setActiveStartCreature(node);
    });
  });

  stars.forEach((node) => {
    node.setAttribute('draggable', 'false');
    node.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      node.classList.remove('is-spinning');
      void node.offsetWidth;
      node.classList.add('is-spinning');
    });
    node.addEventListener('animationend', () => {
      node.classList.remove('is-spinning');
    });
  });
}

function resetMemoryBlock() {
  state.memory.roundIndex = 0;
  state.memory.sequence = [];
  state.memory.userSequence = [];
  state.memory.isPlayingBack = false;
  state.memory.canInteract = false;
  el.memoryRound.textContent = '1';
  el.memoryStatus.textContent = 'Нажми «Начать раунд»';
  el.memoryStartButton.disabled = false;
  renderMemoryGrid();
}

function renderMemoryGrid() {
  el.memoryGrid.innerHTML = '';
  state.memory.cells = [];

  jellyfishAssets.forEach((src, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'memory-cell';
    button.dataset.index = String(index);

    const img = document.createElement('img');
    img.src = src;
    img.alt = 'Медуза';

    button.appendChild(img);
    button.addEventListener('click', () => onMemoryCellClick(index));

    state.memory.cells.push(button);
    el.memoryGrid.appendChild(button);
  });
}

function clearMemoryVisualState() {
  state.memory.cells.forEach((cell) => {
    cell.classList.remove('is-playback', 'is-selected', 'is-solved', 'is-wrong');
  });
}

async function startMemoryRound() {
  if (state.memory.isPlayingBack) return;

  clearMemoryVisualState();
  state.memory.userSequence = [];
  state.memory.canInteract = false;
  state.memory.isPlayingBack = true;
  el.memoryStartButton.disabled = true;

  const roundNumber = state.memory.roundIndex + 1;
  const sequenceLength = CONFIG.memoryRounds[state.memory.roundIndex];
  el.memoryRound.textContent = String(roundNumber);
  el.memoryStatus.textContent = 'Запоминай порядок';
  state.memory.sequence = shuffle([...Array(8).keys()]).slice(0, sequenceLength);

  await sleep(300);

  for (const index of state.memory.sequence) {
    const cell = state.memory.cells[index];
    cell.classList.add('is-playback');
    await sleep(560);
    cell.classList.remove('is-playback');
    await sleep(180);
  }

  state.memory.isPlayingBack = false;
  state.memory.canInteract = true;
  el.memoryStatus.textContent = 'Повтори последовательность';
}

function onMemoryCellClick(index) {
  if (!state.unlocked.memory || state.memory.isPlayingBack || !state.memory.canInteract) return;

  const expectedIndex = state.memory.sequence[state.memory.userSequence.length];
  const cell = state.memory.cells[index];

  if (index === expectedIndex) {
    state.memory.userSequence.push(index);
    cell.classList.add('is-selected');

    if (state.memory.userSequence.length === state.memory.sequence.length) {
      state.memory.canInteract = false;
      state.memory.cells.forEach((item) => item.classList.remove('is-selected'));
      state.memory.sequence.forEach((sequenceIndex) => {
        state.memory.cells[sequenceIndex].classList.add('is-solved');
      });

      if (state.memory.roundIndex === CONFIG.memoryRounds.length - 1) {
        el.memoryStatus.textContent = 'Блок пройден';
        setTimeout(() => {
          showMessage({
            title: 'Память медуз',
            text: 'Ты запомнил все три раунда. Открываем следующий блок.',
            onAction: () => {
              unlockSection('clicker', el.clickerSection, { scroll: true });
            }
          });
        }, 350);
      } else {
        state.memory.roundIndex += 1;
        el.memoryRound.textContent = String(state.memory.roundIndex + 1);
        el.memoryStatus.textContent = `Раунд ${state.memory.roundIndex} завершён. Запусти следующий.`;
        el.memoryStartButton.disabled = false;
      }
    }
  } else {
    state.memory.canInteract = false;
    cell.classList.add('is-wrong');
    handleBlockFail('memory', {
      title: 'Ошибка в блоке «Память медуз»',
      text: 'Последовательность сбилась. Блок начнётся заново.'
    });
  }
}

function clearClickerTimers() {
  if (state.clicker.timerId) {
    clearInterval(state.clicker.timerId);
    state.clicker.timerId = null;
  }
  if (state.clicker.angryTimeout) {
    clearTimeout(state.clicker.angryTimeout);
    state.clicker.angryTimeout = null;
  }
  if (state.clicker.angryIntervalId) {
    clearInterval(state.clicker.angryIntervalId);
    state.clicker.angryIntervalId = null;
  }
}

function resetClickerBlock() {
  clearClickerTimers();
  state.clicker.score = 0;
  state.clicker.timeLeft = CONFIG.clickerDuration;
  state.clicker.started = false;
  state.clicker.angry = false;
  state.clicker.locked = false;
  state.clicker.finished = false;
  updateClickerHUD();
  setClickerMood(false);
  syncClickerVisual();
  el.clickerStatus.textContent = 'Первый клик запускает таймер';
}

function updateClickerHUD() {
  el.clickerScore.textContent = String(state.clicker.score);
  el.clickerTime.textContent = String(state.clicker.timeLeft);
}

function syncClickerVisual() {
  const hasStarted = state.clicker.started || state.clicker.finished;
  el.clickerJelly.classList.toggle('is-started', hasStarted);
  el.clickerJellyImage.src = hasStarted
    ? (state.clicker.angry ? 'assets/jellyfish-angry-clicker.svg' : 'assets/jellyfish-blue-idle.svg')
    : 'assets/jellyfish-blue-idle.svg';
}

function setClickerMood(isAngry) {
  state.clicker.angry = isAngry;
  el.clickerJelly.classList.toggle('is-angry', isAngry);
  syncClickerVisual();
}

function setVictoryCelebration(isCelebrating) {
  el.victorySection.classList.toggle('is-celebrating', isCelebrating);
}

function maybeSpawnAngryJelly() {
  if (state.clicker.finished) return;
  if (Math.random() < 0.23) {
    clearTimeout(state.clicker.angryTimeout);
    setClickerMood(true);
    state.clicker.locked = false;
    state.clicker.angryTimeout = setTimeout(() => {
      setClickerMood(false);
    }, 1100);
  }
}

function scheduleAngryJelly() {
  if (state.clicker.angryIntervalId) return;
  state.clicker.angryIntervalId = setInterval(() => {
    if (!state.clicker.started || state.clicker.finished) return;

    clearTimeout(state.clicker.angryTimeout);
    setClickerMood(true);
    state.clicker.locked = false;

    state.clicker.angryTimeout = setTimeout(() => {
      setClickerMood(false);
    }, 1100);
  }, 6000);
}

function startClickerTimer() {
  if (state.clicker.started) return;
  state.clicker.started = true;
  syncClickerVisual();
  scheduleAngryJelly();
  el.clickerStatus.textContent = 'Собери 50 очков за 30 секунд';
  state.clicker.timerId = setInterval(() => {
    state.clicker.timeLeft -= 1;
    updateClickerHUD();

    if (state.clicker.timeLeft <= 0) {
      clearClickerTimers();
      if (state.clicker.score >= CONFIG.clickerTargetScore) {
        finishClickerSuccess();
      } else {
        handleBlockFail('clicker', {
          title: 'Время вышло',
          text: `Ты набрал ${state.clicker.score} из ${CONFIG.clickerTargetScore} очков. Блок начнётся заново.`
        });
      }
    }
  }, 1000);
}

function finishClickerSuccess() {
  clearClickerTimers();
  state.clicker.finished = true;
  state.clicker.locked = true;
  setClickerMood(false);
  syncClickerVisual();
  el.clickerStatus.textContent = 'Блок пройден';
  showMessage({
    title: 'Медузий кликер',
    text: 'Цель достигнута. Можно переходить к поиску слов.',
    onAction: () => unlockSection('words', el.wordsSection, { scroll: true })
  });
}

function onClickerJellyClick() {
  if (!state.unlocked.clicker || state.clicker.finished || state.clicker.locked) return;

  if (!state.clicker.started) {
    startClickerTimer();
  }

  el.clickerJelly.classList.remove('is-hit');
  void el.clickerJelly.offsetWidth;
  el.clickerJelly.classList.add('is-hit');

  if (state.clicker.angry) {
    handleBlockFail('clicker', {
      title: 'Злая медуза',
      text: 'На злую медузу нажимать нельзя. Блок начнётся заново.'
    });
    return;
  }

  state.clicker.score += 1;
  updateClickerHUD();
  el.clickerStatus.textContent = `${state.clicker.score} / ${CONFIG.clickerTargetScore}`;

  if (state.clicker.score >= CONFIG.clickerTargetScore) {
    finishClickerSuccess();
    return;
  }

}


function resetWordsBlock() {
  state.words.rows = getWordRows();
  state.words.cols = getWordCols();
  state.words.grid = [];
  state.words.selected = [];
  state.words.solved = new Set();
  state.words.placements = [];
  state.words.dragging = false;
  state.words.dragStart = null;
  state.words.finished = false;
  el.wordGrid.style.setProperty('--word-cols', String(state.words.cols));
  buildWordSearch();
  renderWordsFound();
}

function createEmptyGrid(rows, cols) {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => ''));
}

function canPlaceWord(grid, word, row, col, direction) {
  const letters = [...word];
  for (let i = 0; i < letters.length; i += 1) {
    const targetRow = direction === 'vertical' ? row + i : row;
    const targetCol = direction === 'horizontal' ? col + i : col;
    if (targetRow >= grid.length || targetCol >= grid[0].length) return false;
    const current = grid[targetRow][targetCol];
    if (current && current !== letters[i]) return false;
  }
  return true;
}

function placeWord(grid, word, row, col, direction) {
  const cells = [];
  [...word].forEach((letter, i) => {
    const targetRow = direction === 'vertical' ? row + i : row;
    const targetCol = direction === 'horizontal' ? col + i : col;
    grid[targetRow][targetCol] = letter;
    cells.push(`${targetRow}-${targetCol}`);
  });
  return cells;
}

function buildWordSearch() {
  const rows = state.words.rows;
  const cols = state.words.cols;
  const grid = createEmptyGrid(rows, cols);
  const placements = [];
  const normalizedWords = CONFIG.wordList.map(normalizeWord);
  const maxWordLength = Math.max(...normalizedWords.map((word) => word.length));

  if (cols < maxWordLength || rows < normalizedWords.length) {
    throw new Error('Недостаточно места для генерации сетки слов');
  }

  const availableRows = shuffle([...Array(rows).keys()]).slice(0, normalizedWords.length);

  normalizedWords.forEach((word, index) => {
    const row = availableRows[index];
    const col = randomInt(0, cols - word.length);
    const cells = placeWord(grid, word, row, col, 'horizontal');
    placements.push({ word, direction: 'horizontal', cells });
  });

  const alphabet = 'абвгдежзиклмнопрстуфхцчшщыэюя';
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      if (!grid[row][col]) {
        grid[row][col] = alphabet[randomInt(0, alphabet.length - 1)];
      }
    }
  }

  state.words.grid = grid;
  state.words.placements = placements;
  renderWordGrid();
}

function renderWordsFound() {
  el.wordsFound.innerHTML = '';
  CONFIG.wordList.forEach((word) => {
    const pill = document.createElement('span');
    pill.className = 'words-pill';
    pill.textContent = word;
    if (state.words.solved.has(normalizeWord(word))) pill.classList.add('is-solved');
    el.wordsFound.appendChild(pill);
  });
}

function renderWordGrid() {
  el.wordGrid.innerHTML = '';

  state.words.grid.forEach((row, rowIndex) => {
    row.forEach((letter, colIndex) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `word-cell ${(rowIndex + colIndex) % 2 === 0 ? 'word-cell--light' : 'word-cell--dark'}`;
      button.textContent = letter;
      button.dataset.row = String(rowIndex);
      button.dataset.col = String(colIndex);
      button.dataset.key = `${rowIndex}-${colIndex}`;

      button.addEventListener('mousedown', (event) => startWordDrag(event, rowIndex, colIndex));
      button.addEventListener('mouseenter', () => updateWordDrag(rowIndex, colIndex));

      button.addEventListener(
        'touchstart',
        (event) => startWordDrag(event, rowIndex, colIndex),
        { passive: false }
      );

      button.addEventListener('dragstart', (event) => event.preventDefault());

      el.wordGrid.appendChild(button);
    });
  });

  syncWordGridClasses();
}

function getTouchPoint(event) {
  if (event.touches && event.touches[0]) return event.touches[0];
  if (event.changedTouches && event.changedTouches[0]) return event.changedTouches[0];
  return null;
}

function getWordCellFromTouchEvent(event) {
  const point = getTouchPoint(event);
  if (!point) return null;

  const target = document.elementFromPoint(point.clientX, point.clientY);
  return target ? target.closest('.word-cell') : null;
}

function startWordDrag(event, row, col) {
  if (!state.unlocked.words || state.words.finished) return;

  if (event.type === 'mousedown' && event.button !== 0) return;

  if (event.cancelable) {
    event.preventDefault();
  }

  state.words.dragging = true;
  state.words.dragStart = { row, col, key: `${row}-${col}` };
  state.words.selected = [{ key: `${row}-${col}` }];

  syncWordGridClasses();
}

function updateWordDrag(row, col) {
  if (!state.words.dragging || !state.words.dragStart || state.words.finished) return;

  state.words.selected = buildSelectionPath(state.words.dragStart, {
    row,
    col,
    key: `${row}-${col}`
  });

  syncWordGridClasses();
}

function handleWordTouchMove(event) {
  if (!state.words.dragging || !state.unlocked.words || state.words.finished) return;

  if (event.cancelable) {
    event.preventDefault();
  }

  const cell = getWordCellFromTouchEvent(event);
  if (!cell) return;

  updateWordDrag(Number(cell.dataset.row), Number(cell.dataset.col));
}

function finishWordDrag() {
  if (!state.words.dragging) return;

  state.words.dragging = false;
  state.words.dragStart = null;

  const resolved = maybeResolveWord();

  if (!resolved) {
    state.words.selected = [];
    syncWordGridClasses();
  }
}

function getWordCellElement(key) {
  return el.wordGrid.querySelector(`[data-key="${key}"]`);
}

function syncWordGridClasses() {
  const selectedSet = new Set(state.words.selected.map((item) => item.key));
  const solvedSet = new Set();
  state.words.placements.forEach((placement) => {
    if (state.words.solved.has(placement.word)) {
      placement.cells.forEach((cell) => solvedSet.add(cell));
    }
  });

  el.wordGrid.querySelectorAll('.word-cell').forEach((cell) => {
    const key = cell.dataset.key;
    cell.classList.toggle('is-selected', selectedSet.has(key));
    cell.classList.toggle('is-solved', solvedSet.has(key));
  });
}

function clearWordSelection() {
  state.words.selected = [];
  state.words.dragging = false;
  state.words.dragStart = null;
  syncWordGridClasses();
}

function selectionToWord() {
  return state.words.selected.map(({ key }) => {
    const [row, col] = key.split('-').map(Number);
    return state.words.grid[row][col];
  }).join('');
}

function isSelectionContiguous(selected) {
  if (selected.length <= 1) return false;
  const coords = selected.map(({ key }) => key.split('-').map(Number));
  const rows = coords.map(([row]) => row);
  const cols = coords.map(([, col]) => col);
  const allSameRow = rows.every((row) => row === rows[0]);
  const allSameCol = cols.every((col) => col === cols[0]);
  if (!allSameRow && !allSameCol) return false;

  if (allSameRow) {
    const sorted = [...cols].sort((a, b) => a - b);
    return sorted.every((value, index) => index === 0 || value - sorted[index - 1] === 1);
  }

  const sorted = [...rows].sort((a, b) => a - b);
  return sorted.every((value, index) => index === 0 || value - sorted[index - 1] === 1);
}

function maybeResolveWord() {
  if (!isSelectionContiguous(state.words.selected)) return false;

  const selectedKeys = state.words.selected.map(({ key }) => key);
  const reversedKeys = [...selectedKeys].reverse();
  const matchedPlacement = state.words.placements.find((placement) => {
    if (state.words.solved.has(placement.word)) return false;
    const direct = placement.cells.length === selectedKeys.length && placement.cells.every((cell, index) => cell === selectedKeys[index]);
    const reverse = placement.cells.length === reversedKeys.length && placement.cells.every((cell, index) => cell === reversedKeys[index]);
    return direct || reverse;
  });

  if (!matchedPlacement) return false;

  state.words.solved.add(matchedPlacement.word);
  state.words.finished = true;
  state.words.dragging = false;
  state.words.dragStart = null;
  state.words.selected = [];
  renderWordsFound();
  syncWordGridClasses();

  showMessage({
    title: 'Слово найдено',
    text: `Ты нашёл слово «${matchedPlacement.word}». Открываем победный экран.`,
    onAction: () => {
      unlockSection('victory', el.victorySection, { scroll: true });
      setVictoryCelebration(true);
      setTimeout(() => unlockSection('wishes', el.wishesSection), 220);
    }
  });

  return true;
}

function buildSelectionPath(start, end) {
  if (!start) return [];

  if (start.row === end.row) {
    const minCol = Math.min(start.col, end.col);
    const maxCol = Math.max(start.col, end.col);

    return Array.from(
      { length: maxCol - minCol + 1 },
      (_, index) => ({ key: `${start.row}-${minCol + index}` })
    );
  }

  if (start.col === end.col) {
    const minRow = Math.min(start.row, end.row);
    const maxRow = Math.max(start.row, end.row);

    return Array.from(
      { length: maxRow - minRow + 1 },
      (_, index) => ({ key: `${minRow + index}-${start.col}` })
    );
  }

  return [{ key: start.key }];
}



function createWishCard(text) {
  const card = document.createElement('article');
  card.className = 'wish-card';
  card.innerHTML = `
    <button class="wish-card__close" type="button" aria-label="Закрыть">×</button>
    <p class="wish-card__text"></p>
  `;
  card.querySelector('.wish-card__text').textContent = text;
  card.querySelector('.wish-card__close').addEventListener('click', () => card.remove());
  return card;
}

function renderBubbles() {
  el.bubblesField.innerHTML = '';
  const desktopPositions = [
    { left: '3%', top: '58%' },
    { left: '16%', top: '63%' },
    { left: '29%', top: '42%' },
    { left: '46%', top: '22%' },
    { left: '62%', top: '48%' },
    { left: '76%', top: '18%' },
    { left: '88%', top: '56%' }
  ];
  const mobilePositions = [
    { left: '4%', top: '58%' },
    { left: '20%', top: '30%' },
    { left: '41%', top: '70%' },
    { left: '55%', top: '28%' },
    { left: '72%', top: '62%' },
    { left: '84%', top: '24%' },
    { left: '34%', top: '54%' }
  ];

  const positions = window.innerWidth <= 680 ? mobilePositions : desktopPositions;

  CONFIG.wishes.forEach((wish, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'bubble-button';
    button.style.left = positions[index % positions.length].left;
    button.style.top = positions[index % positions.length].top;
    button.style.animationDelay = `${index * 0.35}s`;
    button.innerHTML = '<img src="assets/bubble.svg" alt="Пузырь с пожеланием" />';
    button.addEventListener('click', () => onBubbleClick(button, wish, index));
    el.bubblesField.appendChild(button);
  });
}

function onBubbleClick(button, wish, index) {
  button.classList.add('is-popped');
  button.disabled = true;
  state.wishes.shown.add(index);

  const card = createWishCard(wish);
  el.wishStack.prepend(card);

  if (state.wishes.shown.size === 1) {
    showMessage({
      title: 'Финальный бонус',
      text: 'Можно лопать любые пузыри и открывать новые пожелания.',
      onAction: closeMessage
    });
  }
}

function handleBlockFail(block, message) {
  if (CONFIG.restartWholeGame) {
    showMessage({
      ...message,
      buttonText: 'Начать заново',
      onAction: resetWholeGame
    });
    return;
  }

  const handlers = {
    memory: resetMemoryBlock,
    clicker: resetClickerBlock,
    words: resetWordsBlock
  };

  showMessage({
    ...message,
    buttonText: 'Переиграть блок',
    onAction: handlers[block]
  });
}

function resetWholeGame() {
  closeMessage();
  state.unlocked.memory = false;
  state.unlocked.clicker = false;
  state.unlocked.words = false;
  state.unlocked.victory = false;
  state.unlocked.wishes = false;
  setVictoryCelebration(false);

  [el.memorySection, el.clickerSection, el.wordsSection, el.victorySection, el.wishesSection].forEach((section) => {
    section.classList.add('is-locked');
    section.classList.remove('is-active');
  });

  resetMemoryBlock();
  resetClickerBlock();
  resetWordsBlock();
  state.wishes.shown = new Set();
  el.wishStack.innerHTML = '';
  renderBubbles();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function bindEvents() {
  el.startGameButton.addEventListener('click', () => {
    if (!state.unlocked.memory) {
      unlockSection('memory', el.memorySection, { scroll: true });
    } else {
      el.memorySection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });

  el.replayAllButton.addEventListener('click', resetWholeGame);
  el.memoryStartButton.addEventListener('click', startMemoryRound);
  el.memoryRestartButton.addEventListener('click', resetMemoryBlock);
  el.clickerJelly.addEventListener('click', onClickerJellyClick);
  el.clickerRestartButton.addEventListener('click', resetClickerBlock);
  el.wordsClearSelection.addEventListener('click', clearWordSelection);
  el.wordsRestartButton.addEventListener('click', resetWordsBlock);

  document.addEventListener('mouseup', finishWordDrag);
  document.addEventListener('touchmove', handleWordTouchMove, { passive: false });
  document.addEventListener('touchend', finishWordDrag, { passive: false });
  document.addEventListener('touchcancel', finishWordDrag, { passive: false });

  el.wordGrid.style.touchAction = 'none';

  document.querySelectorAll('.js-clicker-fish').forEach((fish) => {
    fish.addEventListener('click', () => {
      fish.classList.remove('is-swimming');
      void fish.offsetWidth;
      fish.classList.add('is-swimming');
    });
  });

  window.addEventListener('resize', () => {
    resetWordsBlock();
    renderBubbles();
  });
}

function init() {
  setVictoryCelebration(false);
  renderMemoryGrid();
  resetMemoryBlock();
  resetClickerBlock();
  resetWordsBlock();
  renderBubbles();
  bindEvents();
  bindStartScreenInteractions();
}


init();
