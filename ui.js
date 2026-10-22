import { game } from './app.js';
import { GAME_CELLS, GAME_DECKS, LEVEL_INFO } from './gameData.js';

// DOM Elements
const boardGrid = document.getElementById('boardGrid');
const headerPlayerCount = document.getElementById('headerPlayerCount');
const activePlayerDot = document.getElementById('activePlayerDot');
const activePlayerName = document.getElementById('activePlayerName');
const activePlayerCellBadge = document.getElementById('activePlayerCellBadge');
const activePlayerRequestSnippet = document.getElementById('activePlayerRequestSnippet');
const lblRound = document.getElementById('lblRound');
const turnPlayerName = document.getElementById('turnPlayerName');
const birthAlertBox = document.getElementById('birthAlertBox');
const blockAlertBox = document.getElementById('blockAlertBox');
const blockAlertText = document.getElementById('blockAlertText');
const cloudStatusBadge = document.getElementById('cloudStatusBadge');

// Card View Elements
const cardCellNumber = document.getElementById('cardCellNumber');
const cardCellLevelBadge = document.getElementById('cardCellLevelBadge');
const cardCellTitle = document.getElementById('cardCellTitle');
const cardCardTitleAlt = document.getElementById('cardCardTitleAlt');
const cardActionBadge = document.getElementById('cardActionBadge');
const cardDescription = document.getElementById('cardDescription');
const cardQuestionsList = document.getElementById('cardQuestionsList');
const cellActionButtons = document.getElementById('cellActionButtons');

// Dossier & Inputs
const dossierPlayerName = document.getElementById('dossierPlayerName');
const inputPlayerRequest = document.getElementById('inputPlayerRequest');
const textareaPlayerInsights = document.getElementById('textareaPlayerInsights');

// Toast
const toastNotification = document.getElementById('toastNotification');
const toastMessage = document.getElementById('toastMessage');
const toastIcon = document.getElementById('toastIcon');

// Modals
const modalPlayers = document.getElementById('modalPlayers');
const modalDossier = document.getElementById('modalDossier');
const modalDecks = document.getElementById('modalDecks');
const modalRules = document.getElementById('modalRules');
const modalSync = document.getElementById('modalSync');

// Rows order for Snake Board Layout (top to bottom)
const BOARD_ROWS = [
  [104, 103, 102, 101, 100, 99, 98, 97, 96, 95, 94, 93, 92],
  [79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91],
  [78, 77, 76, 75, 74, 73, 72, 71, 70, 69, 68, 67, 66],
  [53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65],
  [52, 51, 50, 49, 48, 47, 46, 45, 44, 43, 42, 41, 40],
  [27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39],
  [26, 25, 24, 23, 22, 21, 20, 19, 18, 17, 16, 15, 14],
  [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]
];

function initUI() {
  renderBoard();
  updateUI();
  setupEventListeners();

  // Listen to external/cloud updates
  game.onStateChange(() => {
    updateUI();
  });

  if (window.location.hash && window.location.hash.includes('#session=')) {
    showToast('Состояние игры загружено из ссылки!', '🔗');
  } else if (game.state.cloudRoomId) {
    showToast(`Подключено к облачной комнате: ${game.state.cloudRoomId}`, '☁️');
  }
}

function renderBoard() {
  boardGrid.innerHTML = '';

  BOARD_ROWS.forEach(row => {
    row.forEach(cellId => {
      const cellData = game.getCell(cellId);
      const cellEl = document.createElement('div');
      cellEl.className = `game-cell cell-level-${cellData.level}`;
      cellEl.dataset.id = cellId;

      if (cellData.type === 'lotus') cellEl.classList.add('cell-lotus');
      if (cellId === 98) cellEl.classList.add('cell-insight');

      let badgeHtml = '';
      if (cellData.vectorTarget) {
        badgeHtml = `<span class="badge-icon text-amber-300 font-mono font-bold" title="Переход на ${cellData.vectorTarget}">➔${cellData.vectorTarget}</span>`;
      } else if (cellData.type === 'loss') {
        badgeHtml = `<span class="badge-icon text-rose-300" title="Потеря ресурса">❌</span>`;
      } else if (cellData.type === 'lotus') {
        badgeHtml = `<span class="badge-icon text-amber-300" title="Лотос / Ресурс">🪷</span>`;
      } else if (cellData.type === 'resource') {
        badgeHtml = `<span class="badge-icon text-emerald-300" title="Ресурс">❤️</span>`;
      } else if (cellData.type === 'card') {
        badgeHtml = `<span class="badge-icon text-indigo-200" title="Взять карту">🃏</span>`;
      } else if (cellData.type === 'exit') {
        badgeHtml = `<span class="badge-icon text-rose-400" title="Выход">🛑</span>`;
      }

      cellEl.innerHTML = `
        <div class="flex items-center justify-between pointer-events-none">
          <span class="text-[11px] font-black font-mono leading-none ${cellId === 98 ? 'text-amber-400' : 'text-slate-200'}">${cellId}</span>
          ${badgeHtml}
        </div>
        <div class="text-[10px] font-semibold text-slate-100 leading-tight truncate my-0.5 pointer-events-none" title="${cellData.boardName}">
          ${cellData.boardName}
        </div>
        <div class="players-tokens-container flex items-center gap-1 flex-wrap min-h-[18px]">
        </div>
      `;

      cellEl.addEventListener('click', () => {
        selectCell(cellId);
      });

      boardGrid.appendChild(cellEl);
    });
  });
}

function updateUI() {
  const player = game.getActivePlayer();
  if (!player) return;

  headerPlayerCount.textContent = game.state.players.length;
  lblRound.textContent = game.state.round;

  activePlayerDot.style.backgroundColor = player.color.hex;
  activePlayerName.textContent = player.name;
  activePlayerCellBadge.textContent = `Клетка ${player.currentCell}`;
  activePlayerRequestSnippet.textContent = player.request ? `«${player.request}»` : '«Запрос не указан»';

  turnPlayerName.textContent = player.name;
  dossierPlayerName.textContent = player.name;

  // Cloud status badge
  if (cloudStatusBadge) {
    if (game.state.cloudRoomId && game.isCloudSyncActive) {
      cloudStatusBadge.className = 'text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1 font-mono';
      cloudStatusBadge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> ☁️ ${game.state.cloudRoomId}`;
      cloudStatusBadge.title = 'Облачная синхронизация активна';
    } else {
      cloudStatusBadge.className = 'text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 flex items-center gap-1 font-mono';
      cloudStatusBadge.innerHTML = `<span>⚪</span> Локально`;
      cloudStatusBadge.title = 'Данные сохраняются локально в браузере';
    }
  }

  if (!player.isBorn && player.currentCell === 98) {
    birthAlertBox.classList.remove('hidden');
  } else {
    birthAlertBox.classList.add('hidden');
  }

  const visits = player.cellVisits[player.currentCell] || 0;
  if (visits >= 3) {
    blockAlertBox.classList.remove('hidden');
    blockAlertText.innerHTML = `<b>БЛОК!</b> Игрок встал на клетку ${player.currentCell} уже ${visits}-й раз! По правилам игры это психологический блок!`;
  } else {
    blockAlertBox.classList.add('hidden');
  }

  for (let lvl = 1; lvl <= 6; lvl++) {
    const el = document.getElementById(`resVal${lvl}`);
    if (el) el.textContent = player.resources[lvl] || 0;
  }

  if (document.activeElement !== inputPlayerRequest) {
    inputPlayerRequest.value = player.request || '';
  }
  if (document.activeElement !== textareaPlayerInsights) {
    textareaPlayerInsights.value = player.notes.insights || '';
  }

  renderPlayerTokens();
  renderSelectedCard();
  renderMovesLog();
}

function renderPlayerTokens() {
  document.querySelectorAll('.players-tokens-container').forEach(c => c.innerHTML = '');

  document.querySelectorAll('.game-cell').forEach(c => {
    const id = parseInt(c.dataset.id);
    if (id === game.state.selectedCellId) {
      c.classList.add('selected');
    } else {
      c.classList.remove('selected');
    }
  });

  game.state.players.forEach((p, idx) => {
    const cellEl = document.querySelector(`.game-cell[data-id="${p.currentCell}"]`);
    if (cellEl) {
      const container = cellEl.querySelector('.players-tokens-container');
      if (container) {
        const token = document.createElement('div');
        token.className = `player-token shadow-lg`;
        token.style.backgroundColor = p.color.hex;
        token.title = `${p.name} (Клетка ${p.currentCell})`;
        token.textContent = p.name.charAt(0).toUpperCase();

        if (idx === game.state.activePlayerIndex) {
          token.classList.add('ring-2', 'ring-amber-300');
        }

        token.addEventListener('click', (e) => {
          e.stopPropagation();
          game.state.activePlayerIndex = idx;
          game.state.selectedCellId = p.currentCell;
          updateUI();
        });

        container.appendChild(token);
      }
    }
  });
}

function selectCell(cellId) {
  game.state.selectedCellId = cellId;
  renderBoardSelectedHighlight();
  renderSelectedCard();
}

function renderBoardSelectedHighlight() {
  document.querySelectorAll('.game-cell').forEach(c => {
    const id = parseInt(c.dataset.id);
    if (id === game.state.selectedCellId) {
      c.classList.add('selected');
    } else {
      c.classList.remove('selected');
    }
  });
}

function renderSelectedCard() {
  const cell = game.getCell(game.state.selectedCellId);
  const player = game.getActivePlayer();
  const lvl = LEVEL_INFO.find(l => l.level === cell.level);

  cardCellNumber.textContent = `№ ${cell.id}`;
  cardCellLevelBadge.textContent = `${cell.level} Уровень • ${lvl ? lvl.name : ''}`;
  cardCellLevelBadge.className = `text-xs px-2 py-0.5 rounded-full border font-semibold ${lvl ? lvl.bgClass + '/30 ' + lvl.textClass + ' ' + lvl.borderClass : ''}`;

  cardCellTitle.textContent = cell.boardName;
  cardCardTitleAlt.textContent = cell.cardName !== cell.boardName ? `Карточка: «${cell.cardName}»` : 'Название на поле и карте совпадает';
  cardActionBadge.textContent = cell.icon || '✨';
  cardDescription.textContent = cell.desc || '';

  cardQuestionsList.innerHTML = '';
  if (cell.questions && cell.questions.length > 0) {
    cell.questions.forEach(q => {
      const li = document.createElement('li');
      li.textContent = q;
      cardQuestionsList.appendChild(li);
    });
  } else {
    const li = document.createElement('li');
    li.textContent = 'Исследуйте ощущения в теле и мысли по запросу.';
    cardQuestionsList.appendChild(li);
  }

  cellActionButtons.innerHTML = '';

  if (cell.vectorTarget) {
    const btnVector = document.createElement('button');
    btnVector.className = 'w-full py-2 px-3 rounded-lg bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-xs transition flex items-center justify-center gap-1.5 shadow';
    btnVector.innerHTML = `<span>🚀</span> Совершить переход по стрелке на клетку ${cell.vectorTarget}`;
    btnVector.addEventListener('click', () => {
      if (player) {
        game.moveToCell(player, cell.vectorTarget, `🚀 Переход по стрелке с клетки ${cell.id} на клетку ${cell.vectorTarget}`);
        updateUI();
        showToast(`Переход на клетку ${cell.vectorTarget}!`, '🚀');
      }
    });
    cellActionButtons.appendChild(btnVector);
  }

  const btnRow = document.createElement('div');
  btnRow.className = 'grid grid-cols-2 gap-2';

  const btnAddRes = document.createElement('button');
  btnAddRes.className = 'py-1.5 px-2 rounded-lg bg-emerald-900/60 hover:bg-emerald-800 text-emerald-200 border border-emerald-700/60 text-xs font-semibold flex items-center justify-center gap-1';
  btnAddRes.innerHTML = `<span>+</span> Ресурс (${lvl ? lvl.name.split('/')[0] : ''})`;
  btnAddRes.addEventListener('click', () => {
    game.changeResource(cell.level, 1);
    updateUI();
    showToast(`+1 Ресурс (${lvl.name}) получен!`, '💎');
  });

  const btnSubRes = document.createElement('button');
  btnSubRes.className = 'py-1.5 px-2 rounded-lg bg-rose-950/60 hover:bg-rose-900 text-rose-200 border border-rose-800/60 text-xs font-semibold flex items-center justify-center gap-1';
  btnSubRes.innerHTML = `<span>-</span> Списать ресурс`;
  btnSubRes.addEventListener('click', () => {
    game.changeResource(cell.level, -1);
    updateUI();
    showToast(`-1 Ресурс (${lvl.name}) списан`, '⚠️');
  });

  btnRow.appendChild(btnAddRes);
  btnRow.appendChild(btnSubRes);
  cellActionButtons.appendChild(btnRow);

  if (cell.deck) {
    const btnDeck = document.createElement('button');
    btnDeck.className = 'w-full py-1.5 px-3 rounded-lg bg-indigo-900/60 hover:bg-indigo-800 text-indigo-200 border border-indigo-700/60 text-xs font-semibold flex items-center justify-center gap-1.5';
    btnDeck.innerHTML = `<span>🃏</span> Вытянуть карту: «${cell.deck}»`;
    btnDeck.addEventListener('click', () => {
      openDeckModal(cell.deck);
    });
    cellActionButtons.appendChild(btnDeck);
  }
}

function renderMovesLog() {
  const container = document.getElementById('movesLogList');
  if (!container) return;

  if (game.state.log.length === 0) {
    container.innerHTML = '<div class="text-slate-400 italic">Ждем первого броска!</div>';
    return;
  }

  container.innerHTML = '';
  game.state.log.slice(0, 10).forEach(entry => {
    const item = document.createElement('div');
    item.className = 'p-1.5 rounded bg-slate-900/60 border border-slate-800/80 flex items-start justify-between gap-2 text-[11px]';
    item.innerHTML = `
      <div class="flex items-start gap-1.5">
        <span class="text-slate-400 font-mono text-[10px] mt-0.5">${entry.timestamp}</span>
        <div>
          <b class="text-amber-300">${entry.playerName}:</b> ${entry.message}
          ${entry.blockWarning ? `<div class="text-rose-400 font-bold">${entry.blockWarning}</div>` : ''}
        </div>
      </div>
      <span class="px-1.5 py-0.2 rounded bg-slate-800 text-[10px] font-mono text-slate-300">№${entry.toCell}</span>
    `;
    container.appendChild(item);
  });
}

function setupEventListeners() {
  document.querySelectorAll('.btn-dice').forEach(btn => {
    btn.addEventListener('click', () => {
      const roll = parseInt(btn.dataset.roll);
      executeRoll(roll);
    });
  });

  document.getElementById('btnRollRandom').addEventListener('click', () => {
    const roll = Math.floor(Math.random() * 6) + 1;
    executeRoll(roll);
  });

  document.getElementById('btnManualJump').addEventListener('click', () => {
    const input = document.getElementById('inputManualCell');
    const val = parseInt(input.value);
    if (!isNaN(val) && val >= 1 && val <= 104) {
      const player = game.getActivePlayer();
      if (player) {
        game.moveToCell(player, val, `Ручная перестановка на клетку ${val}`);
        input.value = '';
        updateUI();
        showToast(`Переставлен на клетку ${val}`, '🎯');
      }
    }
  });

  document.getElementById('btnNextPlayer').addEventListener('click', () => {
    game.nextTurn();
    updateUI();
    const cur = game.getActivePlayer();
    if (cur) {
      showToast(`Ход передан игроку: ${cur.name}`, '⏭️');
    }
  });

  document.querySelectorAll('.btn-res-change').forEach(btn => {
    btn.addEventListener('click', () => {
      const lvl = parseInt(btn.dataset.level);
      const delta = parseInt(btn.dataset.delta);
      game.changeResource(lvl, delta);
      updateUI();
    });
  });

  document.getElementById('btnGiveBase6').addEventListener('click', () => {
    const p = game.getActivePlayer();
    if (p) {
      game.giveAllBaseResources(p);
      updateUI();
      showToast('Выдано 6 базовых ресурсов!', '✨');
    }
  });

  inputPlayerRequest.addEventListener('input', (e) => {
    const p = game.getActivePlayer();
    if (p) {
      p.request = e.target.value;
      game.saveState();
      activePlayerRequestSnippet.textContent = p.request ? `«${p.request}»` : '«Запрос не указан»';
    }
  });

  textareaPlayerInsights.addEventListener('input', (e) => {
    const p = game.getActivePlayer();
    if (p) {
      p.notes.insights = e.target.value;
      game.saveState();
    }
  });

  document.getElementById('btnCopyCardForChat').addEventListener('click', () => {
    const player = game.getActivePlayer();
    const cell = game.getCell(game.state.selectedCellId);
    const lvl = LEVEL_INFO.find(l => l.level === cell.level);

    let text = `🎯 **ХОД В ИГРЕ «ИНСАЙТ»**\n`;
    text += `👤 **Игрок:** ${player ? player.name : ''}\n`;
    text += `📍 **Клетка ${cell.id}:** «${cell.boardName}» (${lvl ? lvl.name : ''})\n`;
    text += `📜 **Смысл:** ${cell.desc}\n\n`;

    if (cell.questions && cell.questions.length > 0) {
      text += `❓ **Вопросы ведущего:**\n`;
      cell.questions.forEach((q, i) => {
        text += `${i + 1}. ${q}\n`;
      });
      text += `\n`;
    }
    if (cell.action) {
      text += `⚡ **Действие:** ${cell.action}\n`;
    }

    navigator.clipboard.writeText(text).then(() => {
      showToast('Карточка скопирована для Telegram!', '📋');
    });
  });

  document.getElementById('btnCopyFullTelegramReport').addEventListener('click', () => {
    const text = game.generateTelegramReport();
    navigator.clipboard.writeText(text).then(() => {
      showToast('Полный отчет игрока скопирован!', '📋');
    });
  });

  // Modal Triggers
  document.getElementById('btnManagePlayers').addEventListener('click', openPlayersModal);
  document.getElementById('btnPlayerDossier').addEventListener('click', openDossierModal);
  document.getElementById('btnDecksModal').addEventListener('click', () => openDeckModal('Вторичные выгоды'));
  document.getElementById('btnRulesModal').addEventListener('click', () => modalRules.classList.remove('hidden'));
  document.getElementById('btnSyncModal').addEventListener('click', openSyncModal);

  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.fixed.inset-0').forEach(m => m.classList.add('hidden'));
    });
  });

  document.getElementById('btnResetGame').addEventListener('click', () => {
    if (confirm('Начать новую игру? Позиции игроков будут сброшены на 98, ресурсы возвращены к базовым.')) {
      game.resetGame();
      updateUI();
      showToast('Игра сброшена к началу!', '🔄');
    }
  });

  // Deck Tabs & Draw
  document.querySelectorAll('.btn-deck-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.btn-deck-tab').forEach(t => {
        t.className = 'btn-deck-tab px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700';
      });
      tab.className = 'btn-deck-tab px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-bold';
      currentActiveDeck = tab.dataset.deck;
      const titleEl = document.getElementById('deckSelectedCardTitle');
      const textEl = document.getElementById('deckSelectedCardText');
      titleEl.textContent = `Колода: «${currentActiveDeck}»`;
      textEl.textContent = 'Нажмите «Тянуть случайную карту», чтобы вытянуть карту вслепую.';
    });
  });

  document.getElementById('btnDrawRandomFromDeck').addEventListener('click', () => {
    const card = game.drawCardFromDeck(currentActiveDeck);
    if (card) {
      document.getElementById('deckSelectedCardTitle').textContent = card.title;
      document.getElementById('deckSelectedCardText').textContent = card.text;
      showToast(`Вытянута карта: «${card.title}»`, '✨');
    }
  });

  document.getElementById('btnSaveCardToInsights').addEventListener('click', () => {
    const player = game.getActivePlayer();
    const title = document.getElementById('deckSelectedCardTitle').textContent;
    const text = document.getElementById('deckSelectedCardText').textContent;
    if (player && title && !title.includes('Нажмите')) {
      const entry = `[Карта из колоды ${currentActiveDeck}]: «${title}» — ${text}`;
      player.notes.insights = player.notes.insights ? `${player.notes.insights}\n\n${entry}` : entry;
      game.saveState();
      updateUI();
      showToast('Карта добавлена в инсайты игрока!', '💡');
    }
  });

  document.getElementById('btnPrintDossier').addEventListener('click', () => {
    window.print();
  });

  document.getElementById('btnAddPlayerSubmit').addEventListener('click', () => {
    const input = document.getElementById('inputNewPlayerName');
    const name = input.value.trim();
    if (name) {
      game.addPlayer(name);
      input.value = '';
      renderPlayersListModal();
      updateUI();
      showToast(`Игрок ${name} добавлен!`, '👤');
    }
  });

  // Sync Modal Handlers
  document.getElementById('btnConnectCloudRoom').addEventListener('click', async () => {
    const input = document.getElementById('inputCloudRoomName');
    const room = input.value.trim();
    if (room) {
      await game.connectToCloudRoom(room);
      updateUI();
      showToast(`Облачная комната «${room}» подключена!`, '☁️');
    }
  });

  document.getElementById('btnCopyCloudShareUrl').addEventListener('click', () => {
    const url = game.getCloudShareUrl();
    navigator.clipboard.writeText(url).then(() => {
      showToast('Постоянная ссылка на облачную комнату скопирована!', '🔗');
    });
  });

  document.getElementById('btnDisconnectCloud').addEventListener('click', () => {
    game.disconnectCloudRoom();
    updateUI();
    showToast('Переключено в локальный режим', '⚪');
  });

  document.getElementById('btnCopySessionUrl').addEventListener('click', () => {
    const url = game.generateSessionUrl();
    navigator.clipboard.writeText(url).then(() => {
      showToast('Ссылка с текущим состоянием скопирована!', '🔗');
    });
  });

  document.getElementById('btnDownloadSessionJson').addEventListener('click', () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(game.state, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute('href', dataStr);
    dlAnchor.setAttribute('download', `insight_session_${new Date().toISOString().slice(0, 10)}.json`);
    dlAnchor.click();
    showToast('Файл сессии сохранен!', '💾');
  });

  document.getElementById('btnLoadSessionFile').addEventListener('click', () => {
    const input = document.getElementById('inputSessionFile');
    input.click();
  });

  document.getElementById('inputSessionFile').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target.result);
          if (parsed.players && Array.isArray(parsed.players)) {
            game.state = parsed;
            game.saveState();
            updateUI();
            modalSync.classList.add('hidden');
            showToast('Сессия успешно загружена из файла!', '📂');
          }
        } catch (err) {
          alert('Ошибка чтения файла: ' + err.message);
        }
      };
      reader.readAsText(file);
    }
  });

  document.getElementById('btnApplySessionCode').addEventListener('click', () => {
    const code = document.getElementById('inputSessionCode').value.trim();
    if (code) {
      const ok = game.importSessionCode(code);
      if (ok) {
        updateUI();
        modalSync.classList.add('hidden');
        showToast('Сессия успешно восстановлена из кода!', '✨');
      } else {
        alert('Некорректный код сессии! Проверьте скопированный текст.');
      }
    }
  });
}

let currentActiveDeck = 'Вторичные выгоды';

function executeRoll(roll) {
  const result = game.handleDiceRoll(roll);
  if (!result) return;

  updateUI();

  if (result.isBlockTriggered) {
    showToast(`⚠️ БЛОК 3 ВИЗИТА! Клетка ${result.toCell}`, '🛑');
  } else if (result.player.isBorn && result.fromCell === 98 && result.toCell === 1) {
    showToast(`🎉 ${result.player.name} РОДИЛСЯ! (Клетка 1)`, '🌱');
  } else {
    showToast(`Выпало [${roll}] ➔ Клетка ${result.toCell}`, '🎲');
  }
}

function openDeckModal(deckName) {
  currentActiveDeck = deckName || 'Вторичные выгоды';
  modalDecks.classList.remove('hidden');

  document.querySelectorAll('.btn-deck-tab').forEach(t => {
    if (t.dataset.deck === currentActiveDeck) {
      t.className = 'btn-deck-tab px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-bold';
    } else {
      t.className = 'btn-deck-tab px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700';
    }
  });

  document.getElementById('deckSelectedCardTitle').textContent = `Колода: «${currentActiveDeck}»`;
  document.getElementById('deckSelectedCardText').textContent = 'Нажмите «Тянуть случайную карту», чтобы достать карту вслепую.';
}

function openPlayersModal() {
  modalPlayers.classList.remove('hidden');
  renderPlayersListModal();
}

function renderPlayersListModal() {
  const container = document.getElementById('playersListContainer');
  container.innerHTML = '';

  game.state.players.forEach((p, idx) => {
    const item = document.createElement('div');
    item.className = 'p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-3';
    item.innerHTML = `
      <div class="flex items-center gap-3">
        <span class="w-4 h-4 rounded-full" style="background-color: ${p.color.hex}"></span>
        <div>
          <div class="font-bold text-xs text-slate-100 flex items-center gap-2">
            ${p.name}
            ${idx === game.state.activePlayerIndex ? '<span class="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">Активный</span>' : ''}
          </div>
          <div class="text-[11px] text-slate-400">Позиция: Клетка ${p.currentCell} • Ходов: ${p.history.length - 1}</div>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <button class="btn-make-active px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs text-slate-300" data-idx="${idx}">Выбрать</button>
        ${game.state.players.length > 1 ? `<button class="btn-del-player text-rose-400 hover:text-rose-300 px-2 py-1 text-xs" data-id="${p.id}">Удалить</button>` : ''}
      </div>
    `;

    item.querySelector('.btn-make-active').addEventListener('click', () => {
      game.state.activePlayerIndex = idx;
      game.state.selectedCellId = p.currentCell;
      updateUI();
      renderPlayersListModal();
    });

    const delBtn = item.querySelector('.btn-del-player');
    if (delBtn) {
      delBtn.addEventListener('click', () => {
        if (confirm(`Удалить игрока ${p.name}?`)) {
          game.removePlayer(p.id);
          updateUI();
          renderPlayersListModal();
        }
      });
    }

    container.appendChild(item);
  });
}

function openDossierModal() {
  const p = game.getActivePlayer();
  if (!p) return;

  document.getElementById('modalDossierPlayerName').textContent = p.name;
  document.getElementById('printPlayerName').textContent = p.name;
  document.getElementById('printDate').textContent = new Date().toLocaleDateString('ru-RU');
  document.getElementById('printPlayerRequest').textContent = p.request || 'Запрос не указан';
  document.getElementById('printPlayerInsights').textContent = p.notes.insights || 'Инсайты пока не зафиксированы';
  document.getElementById('printPlayerTrajectory').textContent = p.history.join(' ➔ ');

  const tbody = document.getElementById('printTableBody');
  tbody.innerHTML = '';

  LEVEL_INFO.forEach(lvl => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="border border-slate-300 p-1.5 font-semibold">${lvl.level}. ${lvl.name} (${lvl.colorName})</td>
      <td class="border border-slate-300 p-1.5 font-bold text-center">${p.resources[lvl.level] || 0}</td>
      <td class="border border-slate-300 p-1.5 text-[10px] text-slate-700">${p.notes.blocks || '—'}</td>
      <td class="border border-slate-300 p-1.5 text-[10px] text-slate-700">${lvl.description}</td>
    `;
    tbody.appendChild(tr);
  });

  modalDossier.classList.remove('hidden');
}

function openSyncModal() {
  const inputRoom = document.getElementById('inputCloudRoomName');
  if (inputRoom && game.state.cloudRoomId) {
    inputRoom.value = game.state.cloudRoomId;
  }
  modalSync.classList.remove('hidden');
}

function showToast(msg, icon = '✨') {
  toastMessage.textContent = msg;
  toastIcon.textContent = icon;
  toastNotification.classList.remove('translate-y-20', 'opacity-0');
  toastNotification.classList.add('translate-y-0', 'opacity-100');

  setTimeout(() => {
    toastNotification.classList.remove('translate-y-0', 'opacity-100');
    toastNotification.classList.add('translate-y-20', 'opacity-0');
  }, 2500);
}

window.addEventListener('DOMContentLoaded', initUI);
