import { game } from './app.js';
import { GAME_CELLS, LEVEL_INFO } from './gameData.js';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}

function resourceBreakdown(player, level) {
  const info = game.getResourceBreakdown(player, level);
  return `${info.total} <span class="text-[8px] text-slate-500">(${info.base}+${info.extra})</span>`;
}

const LEVEL_BADGE_CLASS = {
  1: 'bg-red-500/30 text-red-300 border-red-500/50',
  2: 'bg-orange-500/30 text-orange-300 border-orange-500/50',
  3: 'bg-amber-400/30 text-amber-700 border-amber-400/50',
  4: 'bg-emerald-500/30 text-emerald-700 border-emerald-500/50',
  5: 'bg-cyan-500/30 text-cyan-700 border-cyan-500/50',
  6: 'bg-blue-600/30 text-blue-700 border-blue-600/50'
};

function renderStatusChip(player) {
  const status = game.getStatus(player);
  const map = {
    finished: ['bg-amber-100 text-amber-800 border-amber-300', '🪷 Финиш'],
    exited: ['bg-rose-100 text-rose-800 border-rose-500/40', '🛑 Выход'],
    unborn: ['bg-sky-100 text-sky-800 border-sky-300', '🐣 Рождение'],
    playing: ['bg-emerald-100 text-emerald-800 border-emerald-300', '🎲 В игре']
  };
  const [classes, label] = map[status] || map.playing;
  return `<span class="text-[10px] px-2 py-0.5 rounded-full border font-semibold ${classes}">${label}</span>`;
}


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
const playerStatusBadge = document.getElementById('playerStatusBadge');
const endAlertBox = document.getElementById('endAlertBox');
const endAlertText = document.getElementById('endAlertText');
const endAlertActions = document.getElementById('endAlertActions');
const arrowAlertBox = document.getElementById('arrowAlertBox');
const arrowAlertText = document.getElementById('arrowAlertText');
const arrowAlertActions = document.getElementById('arrowAlertActions');
const autoSymbolsToggle = document.getElementById('autoSymbolsToggle');
const turnDiceButtons = document.querySelectorAll('.btn-dice');
const btnRollRandom = document.getElementById('btnRollRandom');

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
const modalNotice = document.getElementById('modalNotice');
const noticeTitle = document.getElementById('noticeTitle');
const noticeBody = document.getElementById('noticeBody');
const noticeActions = document.getElementById('noticeActions');

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

async function initUI() {
  await game.whenReady();
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
      if (game.isCellLoss(cellData)) cellEl.classList.add('cell-loss');
      if (cellData.vectorTarget) cellEl.classList.add('cell-arrow');

      const badges = [];
      if (cellData.vectorTarget) badges.push(`<span class="badge-icon text-amber-700 font-mono font-bold" title="Переход на ${cellData.vectorTarget}">➔${cellData.vectorTarget}</span>`);
      if (cellData.type === 'exit') badges.push('<span class="badge-icon text-rose-700" title="Выход из игры">🛑</span>');
      if (cellData.type === 'finish') badges.push('<span class="badge-icon text-amber-800" title="Финиш">🪷</span>');
      if (game.isCellLoss(cellData)) badges.push('<span class="badge-icon text-rose-700" title="Потеря ресурса">❌</span>');
      if (game.isVectorCardCell(cellData)) badges.push('<span class="badge-icon text-amber-800" title="Карта-вектор">🧭</span>');
      if (game.isCellCard(cellData)) badges.push('<span class="badge-icon text-indigo-200" title="Взять карту">🃏</span>');
      if (cellData.type === 'resource' || cellData.type === 'lotus') badges.push('<span class="badge-icon text-emerald-700" title="Ресурс">❤️</span>');

      const badgeHtml = badges.slice(0, 2).join('');

      cellEl.innerHTML = `
        <div class="flex items-center justify-between pointer-events-none gap-0.5">
          <span class="text-[11px] font-black font-mono leading-none ${cellId === 98 ? 'text-amber-600' : 'text-slate-800/90'}">${cellId}</span>
          <span class="flex items-center gap-0.5">${badgeHtml}</span>
        </div>
        <div class="cell-name text-[9px] font-semibold text-slate-50 leading-[1.05] pointer-events-none" title="${escapeHtml(cellData.boardName)}">
          ${escapeHtml(cellData.boardName)}
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
  renderGroupRoster();
  const player = game.getActivePlayer();
  if (!player) {
    headerPlayerCount.textContent = game.state.players.length;
    return;
  }

  headerPlayerCount.textContent = game.state.players.length;
  lblRound.textContent = game.state.round;

  activePlayerDot.style.backgroundColor = player.color.hex;
  activePlayerName.textContent = player.name;
  activePlayerCellBadge.textContent = `Клетка ${player.currentCell}`;
  activePlayerRequestSnippet.textContent = player.request ? `«${player.request}»` : '«Запрос не указан»';
  if (playerStatusBadge) playerStatusBadge.innerHTML = renderStatusChip(player);

  turnPlayerName.textContent = player.name;
  dossierPlayerName.textContent = player.name;

  // Cloud status badge
  if (cloudStatusBadge) {
    if (game.state.cloudRoomId && game.isCloudSyncActive) {
      const reachable = game.cloudReachable !== false;
      cloudStatusBadge.className = reachable
        ? 'text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-300 flex items-center gap-1 font-mono'
        : 'text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1 font-mono';
      cloudStatusBadge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full ${reachable ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}"></span> ☁️ ${escapeHtml(game.state.cloudRoomId)}${reachable ? '' : ' · офлайн'}`;
      cloudStatusBadge.title = reachable
        ? 'Облачная синхронизация активна'
        : `Облако недоступно${game.cloudError ? `: ${game.cloudError}` : ''}. Данные сохраняются локально.`;
    } else {
      cloudStatusBadge.className = 'text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200 flex items-center gap-1 font-mono';
      cloudStatusBadge.innerHTML = `<span>⚪</span> Локально`;
      cloudStatusBadge.title = 'Данные сохраняются локально в браузере';
    }
  }

  const status = game.getStatus(player);
  const isDone = status === 'finished' || status === 'exited';

  if (!player.isBorn && player.currentCell === 98 && status === 'unborn') {
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

  // Finish / exit state
  if (endAlertBox) {
    if (status === 'finished' || status === 'exited') {
      endAlertBox.classList.remove('hidden');
      endAlertBox.className = status === 'finished'
        ? 'p-2.5 rounded-lg bg-amber-100 border border-amber-300/70 text-xs text-amber-100 flex flex-col gap-2'
        : 'p-2.5 rounded-lg bg-rose-100 border border-rose-300 text-xs text-rose-100 flex flex-col gap-2';
      endAlertText.textContent = status === 'finished'
        ? `🪷 ${player.name} достиг клетки 98 «Инсайт». Запрос пришёл к разрешению — зафиксируйте главный инсайт в карте игрока.`
        : `🛑 ${player.name} на клетке 101 «Одержимость». По правилам это выход из игры: запрос требует переформулировки или терапии.`;
      endAlertActions.innerHTML = '';
      const nextBtn = document.createElement('button');
      nextBtn.className = 'px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-semibold border border-slate-300';
      nextBtn.textContent = 'Передать ход';
      nextBtn.addEventListener('click', () => {
        game.nextTurn();
        updateUI();
      });
      const reviveBtn = document.createElement('button');
      reviveBtn.className = 'px-2.5 py-1 rounded-md bg-amber-500 hover:bg-amber-400 text-slate-950 text-[11px] font-bold';
      reviveBtn.textContent = status === 'finished' ? 'Продолжить исследование' : 'Вернуть в игру (новый запрос)';
      reviveBtn.addEventListener('click', () => {
        game.revivePlayer(player.id);
        updateUI();
        showToast(status === 'finished' ? 'Игрок продолжает исследование' : 'Игрок возвращён на 98 — нужно снова выкинуть 1', '🔄');
      });
      endAlertActions.appendChild(nextBtn);
      endAlertActions.appendChild(reviveBtn);
    } else {
      endAlertBox.classList.add('hidden');
    }
  }

  // Pending arrow
  if (arrowAlertBox) {
    const arrowTarget = player.pendingArrow;
    if (arrowTarget && !isDone) {
      arrowAlertBox.classList.remove('hidden');
      const currentCell = game.getCell(player.currentCell);
      const cardHint = currentCell.deck ? `Сначала возьмите карту из колоды «${currentCell.deck}», затем ` : 'Сначала ';
      arrowAlertText.textContent = `На клетке ${player.currentCell} есть обязательный переход по стрелке → ${arrowTarget}. ${cardHint}завершите переход, затем бросайте кубик.`;
      arrowAlertActions.innerHTML = '';
      const goBtn = document.createElement('button');
      goBtn.className = 'px-2.5 py-1 rounded-md bg-amber-500 hover:bg-amber-400 text-slate-950 text-[11px] font-bold';
      goBtn.textContent = `Перейти → ${arrowTarget}`;
      goBtn.addEventListener('click', () => {
        game.resolveArrow(player);
        updateUI();
        showToast(`Переход на клетку ${arrowTarget}`, '🚀');
      });
      const skipBtn = document.createElement('button');
      skipBtn.className = 'px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] border border-slate-300';
      skipBtn.textContent = 'Пропустить';
      skipBtn.addEventListener('click', () => {
        game.skipPendingArrow(player);
        updateUI();
      });
      arrowAlertActions.appendChild(goBtn);
      if (player.currentCell !== 104) arrowAlertActions.appendChild(skipBtn);
    } else {
      arrowAlertBox.classList.add('hidden');
    }
  }

  for (let lvl = 1; lvl <= 6; lvl++) {
    const el = document.getElementById(`resVal${lvl}`);
    if (el) el.innerHTML = resourceBreakdown(player, lvl);
    const card = document.getElementById(`resCard${lvl}`);
    if (card) {
      const info = game.getResourceBreakdown(player, lvl);
      card.title = `База: ${info.base}, заработано: ${info.extra}`;
      card.classList.toggle('opacity-60', info.total === 0);
    }
  }

  if (autoSymbolsToggle) autoSymbolsToggle.checked = game.state.autoSymbols !== false;

  turnDiceButtons.forEach(btn => { btn.disabled = isDone; btn.classList.toggle('opacity-40', isDone); btn.classList.toggle('cursor-not-allowed', isDone); });
  if (btnRollRandom) { btnRollRandom.disabled = isDone; btnRollRandom.classList.toggle('opacity-40', isDone); }
  const manualJumpBtn = document.getElementById('btnManualJump');
  if (manualJumpBtn) manualJumpBtn.disabled = isDone;

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

function renderGroupRoster() {
  const roster = document.getElementById('groupRoster');
  document.getElementById('groupCount').textContent = game.state.players.length;
  roster.innerHTML = '';
  game.state.players.forEach((player, index) => {
    const status = { unborn: 'Рождение', playing: 'В игре', finished: 'Финиш', exited: 'Выход' }[game.getStatus(player)];
    const button = document.createElement('button');
    button.className = 'group-player';
    button.setAttribute('aria-pressed', String(index === game.state.activePlayerIndex));
    button.innerHTML = `<span class="group-number" style="background:${escapeHtml(player.color.hex)}">${index + 1}</span><span class="group-player-info"><strong>${escapeHtml(player.name)}</strong><small>Клетка ${player.currentCell} · ${escapeHtml(status)}</small></span>`;
    button.addEventListener('click', () => {
      game.state.activePlayerIndex = index;
      game.state.selectedCellId = player.currentCell;
      game.saveState();
    });
    roster.appendChild(button);
  });
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
        token.title = `№${idx + 1} · ${p.name} (Клетка ${p.currentCell})`;
        token.textContent = idx + 1;
        token.setAttribute('role', 'button');
        token.setAttribute('tabindex', '0');
        token.setAttribute('aria-label', token.title);
        token.addEventListener('keydown', event => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            token.click();
          }
        });

        if (idx === game.state.activePlayerIndex) {
          token.classList.add('ring-2', 'ring-amber-300');
        }

        token.addEventListener('click', (e) => {
          e.stopPropagation();
          game.state.activePlayerIndex = idx;
          game.state.selectedCellId = p.currentCell;
          game.saveState();
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
  const lvl = LEVEL_INFO.find(l => l.level === cell.level);

  cardCellNumber.textContent = `№ ${cell.id}`;
  cardCellLevelBadge.textContent = `${cell.level} Уровень • ${lvl ? lvl.name : ''}`;
  cardCellLevelBadge.className = `text-xs px-2 py-0.5 rounded-full border font-semibold ${LEVEL_BADGE_CLASS[cell.level] || 'bg-slate-100 text-slate-600 border-slate-300'}`;

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

  const runArrow = (target) => {
    const current = game.getActivePlayer();
    if (!current) return;
    game.resolveArrow(current, target);
    updateUI();
    showToast(`Переход на клетку ${target}!`, '🚀');
  };

  if (cell.vectorTarget) {
    const choices = Array.isArray(cell.vectorChoices) && cell.vectorChoices.length > 1
      ? cell.vectorChoices
      : [cell.vectorTarget];

    if (choices.length > 1) {
      const choiceWrap = document.createElement('div');
      choiceWrap.className = 'grid grid-cols-2 gap-2';
      choices.forEach(target => {
        const targetCell = game.getCell(target);
        const btn = document.createElement('button');
        btn.className = target === cell.vectorTarget
          ? 'py-1.5 px-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[11px] transition'
          : 'py-1.5 px-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 font-semibold text-[11px] transition';
        btn.textContent = `${target} · ${targetCell.boardName}`;
        btn.title = `Перейти на клетку ${target} «${targetCell.boardName}»`;
        btn.addEventListener('click', () => runArrow(target));
        choiceWrap.appendChild(btn);
      });
      cellActionButtons.appendChild(choiceWrap);
    } else {
      const btnVector = document.createElement('button');
      btnVector.className = 'w-full py-2 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition flex items-center justify-center gap-1.5 shadow';
      btnVector.innerHTML = `<span>🚀</span> Перейти по стрелке на клетку ${cell.vectorTarget}`;
      btnVector.addEventListener('click', () => runArrow(cell.vectorTarget));
      cellActionButtons.appendChild(btnVector);
    }
  }

  if (game.isVectorCardCell(cell)) {
    const btnVectorCard = document.createElement('button');
    btnVectorCard.className = 'w-full py-2 px-3 rounded-lg bg-amber-500 hover:bg-amber-500 text-amber-50 border border-amber-500/50 font-bold text-xs transition flex items-center justify-center gap-1.5';
    btnVectorCard.innerHTML = '<span>🧭</span> Вытянуть карту-вектор 4 уровня';
    btnVectorCard.addEventListener('click', () => openVectorCardModal(cell));
    cellActionButtons.appendChild(btnVectorCard);
  }

  if (game.isResourceCell(cell)) {
    const btnTakeRes = document.createElement('button');
    btnTakeRes.className = 'w-full py-2 px-3 rounded-lg bg-emerald-500 hover:bg-emerald-500 text-emerald-50 border border-emerald-500/50 font-bold text-xs transition flex items-center justify-center gap-1.5';
    btnTakeRes.innerHTML = `<span>❤️</span> Взять карту ресурса ${cell.level} уровня`;
    btnTakeRes.addEventListener('click', () => openResourceCardModal(cell.level));
    cellActionButtons.appendChild(btnTakeRes);
  }

  if (cell.deck) {
    const hasDigitalDeck = game.hasDeck(cell.deck);
    const btnDeck = document.createElement('button');
    btnDeck.className = 'w-full py-1.5 px-3 rounded-lg bg-indigo-50 hover:bg-indigo-800 text-indigo-200 border border-indigo-300 text-xs font-semibold flex items-center justify-center gap-1.5';
    btnDeck.innerHTML = `<span>🃏</span> ${hasDigitalDeck ? 'Вытянуть карту' : 'Взять карту'}: «${escapeHtml(cell.deck)}»`;
    btnDeck.addEventListener('click', () => {
      if (hasDigitalDeck) openDeckModal(cell.deck);
      else openMissingDeckModal(cell);
    });
    cellActionButtons.appendChild(btnDeck);
  }

  const btnRow = document.createElement('div');
  btnRow.className = 'grid grid-cols-2 gap-2';

  const btnAddRes = document.createElement('button');
  btnAddRes.className = 'py-1.5 px-2 rounded-lg bg-emerald-100 hover:bg-emerald-500 text-emerald-800 border border-emerald-300 text-xs font-semibold flex items-center justify-center gap-1';
  btnAddRes.innerHTML = `<span>+</span> Ресурс (${lvl ? escapeHtml(lvl.name.split('/')[0]) : cell.level})`;
  btnAddRes.addEventListener('click', () => {
    game.changeResource(cell.level, 1);
    updateUI();
    showToast(`+1 ресурс (${lvl ? lvl.name : cell.level} уровень)`, '💎');
  });

  const btnSubRes = document.createElement('button');
  btnSubRes.className = 'py-1.5 px-2 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-800 border border-rose-800/60 text-xs font-semibold flex items-center justify-center gap-1';
  btnSubRes.innerHTML = '<span>−</span> Списать ресурс';
  btnSubRes.addEventListener('click', () => {
    const result = game.changeResource(cell.level, -1);
    updateUI();
    if (result && result.spent) showToast(`−1 ресурс (${lvl ? lvl.name : cell.level} уровень)`, '⚠️');
    else showToast(`Ресурсов ${cell.level} уровня нет`, '⚠️');
  });

  btnRow.appendChild(btnAddRes);
  btnRow.appendChild(btnSubRes);
  cellActionButtons.appendChild(btnRow);
}

function renderMovesLog() {
  const container = document.getElementById('movesLogList');
  if (!container) return;

  if (game.state.log.length === 0) {
    container.innerHTML = '<div class="text-slate-500 italic">Ждем первого броска!</div>';
    return;
  }

  container.innerHTML = '';
  game.state.log.slice(0, 10).forEach(entry => {
    const item = document.createElement('div');
    item.className = 'p-1.5 rounded bg-white border border-slate-200/80 flex items-start justify-between gap-2 text-[11px]';
    const icon = entry.kind === 'card' ? '🃏' : entry.kind === 'revive' ? '🔄' : entry.kind === 'phase' ? '🎉' : entry.kind === 'birth' ? '🐣' : '🎲';
    item.innerHTML = `
      <div class="flex items-start gap-1.5">
        <span class="text-slate-500 font-mono text-[10px] mt-0.5">${escapeHtml(entry.timestamp || '')}</span>
        <div>
          <b class="text-amber-700">${escapeHtml(entry.playerName || '')}:</b> ${escapeHtml(entry.message || '')}
          ${entry.blockWarning ? `<div class="text-rose-700 font-bold">${escapeHtml(entry.blockWarning)}</div>` : ''}
        </div>
      </div>
      <span class="px-1.5 py-0.2 rounded bg-slate-100 text-[10px] font-mono text-slate-600" title="Клетка">${icon}${entry.toCell ? ` №${entry.toCell}` : ''}</span>
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
    const result = game.nextTurn();
    updateUI();
    if (result && result.gameOver) {
      showToast('Все игроки завершили игру. Начните новую или верните игрока.', '🏁');
      return;
    }
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
      game.setPlayerField(p.id, 'request', e.target.value);
      activePlayerRequestSnippet.textContent = p.request ? `«${p.request}»` : '«Запрос не указан»';
    }
  });

  textareaPlayerInsights.addEventListener('input', (e) => {
    const p = game.getActivePlayer();
    if (p) game.setPlayerNote(p.id, 'insights', e.target.value);
  });

  const dossierBirthInput = document.getElementById('inputDossierBirthDate');
  if (dossierBirthInput) {
    dossierBirthInput.addEventListener('input', (e) => {
      const p = game.getActivePlayer();
      if (!p) return;
      game.setPlayerField(p.id, 'birthDate', e.target.value);
      document.getElementById('printBirthDate').textContent = e.target.value ? `Дата рождения: ${e.target.value}` : 'Дата рождения: —';
    });
  }

  const dossierRequestInput = document.getElementById('inputDossierRequest');
  if (dossierRequestInput) {
    dossierRequestInput.addEventListener('input', (e) => {
      const p = game.getActivePlayer();
      if (!p) return;
      game.setPlayerField(p.id, 'request', e.target.value);
      document.getElementById('printPlayerRequest').textContent = e.target.value || 'Запрос не указан';
    });
  }

  const dossierProblemInput = document.getElementById('inputDossierProblem');
  if (dossierProblemInput) {
    dossierProblemInput.addEventListener('input', (e) => {
      const p = game.getActivePlayer();
      if (!p) return;
      game.setPlayerField(p.id, 'problem', e.target.value);
      document.getElementById('printPlayerProblem').textContent = e.target.value || '—';
    });
  }

  const dossierDesiredInput = document.getElementById('inputDossierDesired');
  if (dossierDesiredInput) {
    dossierDesiredInput.addEventListener('input', (e) => {
      const p = game.getActivePlayer();
      if (!p) return;
      game.setPlayerField(p.id, 'desired', e.target.value);
      document.getElementById('printPlayerDesired').textContent = e.target.value || '—';
    });
  }

  const undoBtn = document.getElementById('btnUndo');
  if (undoBtn) {
    undoBtn.addEventListener('click', () => {
      if (game.undo()) {
        updateUI();
        showToast('Последнее действие отменено', '↶');
      } else {
        showToast('Отменять пока нечего', '↶');
      }
    });
  }

  if (autoSymbolsToggle) {
    autoSymbolsToggle.addEventListener('change', () => {
      game.setAutoSymbols(autoSymbolsToggle.checked);
      showToast(autoSymbolsToggle.checked ? 'Символы клеток применяются автоматически' : 'Символы клеток применяются вручную', '⚙️');
    });
  }

  const boardFocusBtn = document.getElementById('btnBoardFocus');
  const boardSection = document.getElementById('boardSection');
  const toggleBoardFocus = () => {
    if (!boardSection) return;
    const active = boardSection.classList.toggle('focus-mode');
    document.body.classList.toggle('focus-open', active);
    if (boardFocusBtn) boardFocusBtn.textContent = active ? '✕ Выйти из полного экрана' : '⛶ Во весь экран';
  };
  if (boardFocusBtn) {
    boardFocusBtn.addEventListener('click', toggleBoardFocus);
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const openModal = [...document.querySelectorAll('.fixed.inset-0')].find(m => !m.classList.contains('hidden'));
      if (openModal) {
        openModal.classList.add('hidden');
        if (openModal.id === 'modalDossier') document.body.classList.remove('dossier-open');
        return;
      }
      if (boardSection && boardSection.classList.contains('focus-mode')) {
        toggleBoardFocus();
        return;
      }
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.target.matches('input, textarea')) {
      e.preventDefault();
      if (game.undo()) {
        updateUI();
        showToast('Последнее действие отменено', '↶');
      }
    }
  });

  document.querySelectorAll('.fixed.inset-0').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.add('hidden');
        if (modal.id === 'modalDossier') document.body.classList.remove('dossier-open');
      }
    });
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

    copyText(text, 'Карточка скопирована для Telegram!');
  });

  document.getElementById('btnCopyFullTelegramReport').addEventListener('click', () => {
    const text = game.generateTelegramReport();
    copyText(text, 'Полный отчет игрока скопирован!');
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
      document.body.classList.remove('dossier-open');
    });
  });

  document.getElementById('btnResetGame').addEventListener('click', () => {
    if (confirm('Начать новую игру? Позиции игроков будут сброшены на 98, ресурсы возвращены к базовым.')) {
      game.resetGame();
      updateUI();
      showToast('Игра сброшена к началу!', '🔄');
    }
  });

  // Deck tabs are rendered dynamically in openDeckModal()

  document.getElementById('btnDrawRandomFromDeck').addEventListener('click', () => {
    const card = game.drawCardFromDeck(currentActiveDeck);
    if (card) {
      currentDrawnCard = card;
      renderDeckNumberPicker();
      selectDeckNumber(card.number);
      document.getElementById('deckSelectedCardTitle').textContent = `№${card.number} · ${card.title}`;
      document.getElementById('deckSelectedCardText').textContent = card.text;
      showToast(`Вытянута карта №${card.number}: «${card.title}»`, '🎲');
    } else {
      currentDrawnCard = null;
      showToast(`Цифровой колоды «${currentActiveDeck}» нет — используйте карты из комплекта игры.`, 'ℹ️');
    }
  });

  const showCardByNumberBtn = document.getElementById('btnShowCardByNumber');
  if (showCardByNumberBtn) {
    showCardByNumberBtn.addEventListener('click', () => {
      if (!deckSelectedNumber) {
        showToast('Сначала выберите номер карты', 'ℹ️');
        return;
      }
      showDeckCard(deckSelectedNumber);
    });
  }

  const toggleDeckListBtn = document.getElementById('btnToggleDeckList');
  if (toggleDeckListBtn) {
    toggleDeckListBtn.addEventListener('click', () => {
      const list = document.getElementById('deckFullList');
      if (!list) return;
      list.classList.toggle('hidden');
      toggleDeckListBtn.textContent = list.classList.contains('hidden') ? 'Показать весь список' : 'Скрыть список';
    });
  }

  document.getElementById('btnSaveCardToInsights').addEventListener('click', () => {
    const player = game.getActivePlayer();
    if (player && currentDrawnCard) {
      const entry = `[Карта из колоды ${currentDrawnCard.deckName}]: №${currentDrawnCard.number} «${currentDrawnCard.title}» — ${currentDrawnCard.text}`;
      player.notes.insights = player.notes.insights ? `${player.notes.insights}\n\n${entry}` : entry;
      game.saveState();
      updateUI();
      showToast('Карта добавлена в инсайты игрока!', '💡');
    } else {
      showToast('Сначала вытяните карту из колоды', 'ℹ️');
    }
  });

  document.getElementById('btnPrintDossier').addEventListener('click', () => {
    window.print();
  });

  document.getElementById('btnAddPlayerSubmit').addEventListener('click', () => {
    const input = document.getElementById('inputNewPlayerName');
    const name = input.value.trim();
    if (name) {
      if (!game.addPlayer(name)) {
        showToast('В группе уже 20 участников', 'ℹ️');
        return;
      }
      input.value = '';
      renderPlayersListModal();
      updateUI();
      showToast(`Игрок ${name} добавлен!`, '👤');
    }
  });

  document.getElementById('btnAddGroup').addEventListener('click', () => {
    const input = document.getElementById('inputGroupNames');
    const names = input.value.split(/\r?\n/).map(name => name.trim()).filter(Boolean);
    if (!names.length) return;
    if (game.state.players.length + names.length > 20) {
      showToast(`Свободных мест: ${Math.max(0, 20 - game.state.players.length)}. Укажите по одному имени на строку.`, 'ℹ️');
      return;
    }
    game.pushUndo();
    names.forEach(name => game.addPlayer(name, '', { save: false, undo: false }));
    game.saveState();
    input.value = '';
    renderPlayersListModal();
    showToast(`Добавлено участников: ${names.length}`, '👥');
  });

  // Sync Modal Handlers
  document.getElementById('btnConnectCloudRoom').addEventListener('click', async () => {
    const input = document.getElementById('inputCloudRoomName');
    const room = input.value.trim();
    if (room) {
      const result = await game.connectToCloudRoom(room);
      updateUI();
      if (result.ok) {
        if (result.reachable === false) {
          showToast(`Комната «${room}» сохранена локально: облачный API недоступен`, '⚠️');
        } else {
          showToast(result.found ? `Комната «${room}» подключена` : `Комната «${room}» создана`, '☁️');
        }
      } else {
        showToast('Укажите название комнаты (латиница, цифры, - и _)', '⚠️');
      }
    }
  });

  document.getElementById('btnCopyCloudShareUrl').addEventListener('click', () => {
    const url = game.getCloudShareUrl();
    copyText(url, 'Постоянная ссылка на облачную комнату скопирована!');
  });

  document.getElementById('btnDisconnectCloud').addEventListener('click', () => {
    game.disconnectCloudRoom();
    updateUI();
    showToast('Переключено в локальный режим', '⚪');
  });

  document.getElementById('btnCopySessionUrl').addEventListener('click', async () => {
    const url = await game.generateSessionUrl();
    await copyText(url, 'Ссылка с текущим состоянием скопирована!');
    if (url.length > 3500) {
      showToast(`Ссылка длинная (${url.length} символов). Для Telegram надёжнее файл .json или облачная комната.`, '⚠️');
    }
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
            game.state = game.normalizeState({ ...parsed, cloudRoomId: game.state.cloudRoomId });
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

  document.getElementById('btnApplySessionCode').addEventListener('click', async () => {
    const code = document.getElementById('inputSessionCode').value.trim();
    if (code) {
      const ok = await game.importSessionCode(code);
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
let currentDrawnCard = null;
let deckSelectedNumber = null;

function executeRoll(roll) {
  const result = game.handleDiceRoll(roll);
  if (!result) return;

  updateUI();

  if (result.blocked) {
    showToast(result.message, '⏸️');
  } else if (result.birthWaiting) {
    const nextName = result.nextPlayer ? ` Ход у ${result.nextPlayer.name}.` : '';
    showToast(`${result.message}${nextName}`, '🐣');
  } else if (result.isBlockTriggered) {
    showToast(`⚠️ БЛОК 3 ВИЗИТА! Клетка ${result.toCell}`, '🛑');
  } else if (result.finished) {
    showToast(`🪷 ${result.player.name}: Инсайт достигнут!`, '🪷');
  } else if (result.exited) {
    showToast(`🛑 ${result.player.name}: выход из игры (клетка 101)`, '🛑');
  } else if (result.born) {
    showToast(`🎉 ${result.player.name} РОДИЛСЯ! (Клетка 1)`, '🌱');
  } else if (result.loss && result.loss.spent) {
    showToast(`Клетка ${result.toCell}: −1 ресурс ${result.loss.level} уровня`, '❌');
  } else if (result.arrowWarning) {
    showToast(`Клетка ${result.toCell}. ${result.arrowWarning}`, '↪️');
  } else {
    showToast(`Выпало [${roll}] ➔ Клетка ${result.toCell}`, '🎲');
  }
}

function renderDeckTabs() {
  const wrap = document.getElementById('deckTabs');
  if (!wrap) return;
  wrap.innerHTML = '';

  game.getDeckNames().forEach(name => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.deck = name;
    btn.textContent = name === 'МАК (примеры)' ? 'МАК 🪷' : name;
    btn.className = 'btn-deck-tab px-3 py-1.5 rounded-lg bg-white text-slate-700 hover:bg-amber-100 border border-slate-200 font-semibold shadow-sm';
    btn.addEventListener('click', () => {
      currentActiveDeck = name;
      currentDrawnCard = null;
      deckSelectedNumber = null;
      updateDeckTabStyles();
      renderDeckNumberPicker();
      renderDeckFullList();
      document.getElementById('deckSelectedCardTitle').textContent = `Колода: «${currentActiveDeck}»`;
      document.getElementById('deckSelectedCardText').textContent = 'Игрок называет номер — выберите его ниже или возьмите случайную карту.';
    });
    wrap.appendChild(btn);
  });

  updateDeckTabStyles();
  renderDeckNumberPicker();
  renderDeckFullList();
}

function updateDeckTabStyles() {
  document.querySelectorAll('.btn-deck-tab').forEach(tab => {
    const active = tab.dataset.deck === currentActiveDeck;
    tab.className = active
      ? 'btn-deck-tab px-3 py-1.5 rounded-lg bg-amber-500 text-white font-bold border border-amber-400 shadow'
      : 'btn-deck-tab px-3 py-1.5 rounded-lg bg-white text-slate-700 hover:bg-amber-100 border border-slate-200 font-semibold shadow-sm';
  });
}

function renderDeckNumberPicker() {
  const wrap = document.getElementById('deckNumberPicker');
  if (!wrap) return;
  wrap.innerHTML = '';

  const deck = game.decks[currentActiveDeck] || [];
  if (!deck.length) {
    const hint = document.createElement('p');
    hint.className = 'text-[11px] text-slate-500';
    hint.textContent = 'Колода не найдена — используйте физические карты.';
    wrap.appendChild(hint);
    return;
  }

  deck.forEach(card => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.number = String(card.number);
    btn.textContent = String(card.number);
    btn.title = card.title;
    btn.className = 'num-btn py-1.5 rounded-lg bg-white text-slate-700 border border-slate-200 hover:bg-amber-100 hover:border-amber-400 font-bold text-xs shadow-sm transition';
    btn.addEventListener('click', () => selectDeckNumber(card.number));
    wrap.appendChild(btn);
  });

  selectDeckNumber(deckSelectedNumber);
}

function selectDeckNumber(number) {
  deckSelectedNumber = number;
  const key = `cards:${currentActiveDeck}`;
  const remaining = game.state.deckRemaining[key];

  document.querySelectorAll('#deckNumberPicker .num-btn').forEach(btn => {
    const btnNumber = Number(btn.dataset.number);
    const active = btnNumber === Number(number);
    const taken = Array.isArray(remaining) && remaining.length > 0 && !remaining.includes(btnNumber);
    const base = 'num-btn py-1.5 rounded-lg font-bold text-xs shadow-sm transition';
    btn.className = active
      ? `${base} bg-amber-500 text-white border border-amber-400 shadow ${taken ? 'line-through' : ''}`
      : `${base} bg-white text-slate-700 border border-slate-200 hover:bg-amber-100 hover:border-amber-400 ${taken ? 'opacity-40 line-through' : ''}`;
    btn.title = taken ? 'Эта карта уже взята' : btn.title;
  });

  const showBtn = document.getElementById('btnShowCardByNumber');
  if (showBtn) {
    showBtn.innerHTML = number
      ? `<span>🔢</span> Показать карту №${number}`
      : '<span>🔢</span> Показать карту по номеру';
  }
}

function renderDeckFullList() {
  const list = document.getElementById('deckFullList');
  if (!list) return;
  list.innerHTML = '';

  const deck = game.decks[currentActiveDeck] || [];
  deck.forEach(card => {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'w-full text-left flex gap-2 px-1.5 py-0.5 rounded hover:bg-amber-50 text-slate-700';
    row.innerHTML = `<b class="font-mono text-amber-700">${card.number}</b><span>${escapeHtml(card.title)}</span>`;
    row.addEventListener('click', () => {
      selectDeckNumber(card.number);
      showDeckCard(card.number);
    });
    list.appendChild(row);
  });
}

function showDeckCard(number) {
  const card = game.takeCardByNumber(currentActiveDeck, number);
  if (!card) {
    showToast('Карты с таким номером нет', '⚠️');
    return;
  }
  currentDrawnCard = card;
  document.getElementById('deckSelectedCardTitle').textContent = `№${card.number} · ${card.title}`;
  document.getElementById('deckSelectedCardText').textContent = card.text;
  renderDeckNumberPicker();
  selectDeckNumber(card.number);
  if (card.alreadyTaken) {
    showToast(`Карта №${card.number} уже была взята — показываем повторно`, 'ℹ️');
  }
}

function openDeckModal(deckName) {
  currentActiveDeck = deckName && game.hasDeck(deckName) ? deckName : 'Вторичные выгоды';
  currentDrawnCard = null;
  deckSelectedNumber = null;
  renderDeckTabs();
  modalDecks.classList.remove('hidden');

  document.getElementById('deckSelectedCardTitle').textContent = `Колода: «${currentActiveDeck}»`;
  document.getElementById('deckSelectedCardText').textContent = 'Игрок называет номер — выберите его ниже или возьмите случайную карту.';
}

function openNotice(title, bodyNodes, actions = []) {
  noticeTitle.textContent = title;
  noticeBody.innerHTML = '';
  bodyNodes.forEach(node => {
    if (typeof node === 'string') {
      const p = document.createElement('p');
      p.textContent = node;
      noticeBody.appendChild(p);
    } else if (node) {
      noticeBody.appendChild(node);
    }
  });

  noticeActions.innerHTML = '';
  actions.forEach(action => {
    const btn = document.createElement('button');
    btn.className = action.primary
      ? 'px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold'
      : 'px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 text-xs font-semibold';
    btn.textContent = action.label;
    btn.addEventListener('click', () => {
      if (action.close !== false) modalNotice.classList.add('hidden');
      if (action.onClick) action.onClick();
    });
    noticeActions.appendChild(btn);
  });

  modalNotice.classList.remove('hidden');
}

function openMissingDeckModal(cell) {
  const body = [];
  const info = document.createElement('div');
  info.className = 'p-3 rounded-lg bg-white border border-slate-200';
  info.innerHTML = `<p><b class="text-slate-800">Колода «${escapeHtml(cell.deck)}»</b> не входит в цифровую версию приложения.</p>
    <p class="mt-1 text-slate-500">Возьмите физическую карту из комплекта игры. Если колоды под рукой нет, используйте вопросы клетки как основной материал.</p>`;
  body.push(info);

  if (cell.questions?.length) {
    const list = document.createElement('ul');
    list.className = 'list-disc pl-5 flex flex-col gap-1';
    cell.questions.forEach(q => {
      const li = document.createElement('li');
      li.textContent = q;
      list.appendChild(li);
    });
    body.push(list);
  }

  openNotice(`Карта из колоды «${cell.deck}»`, body, [
    { label: 'Закрыть', primary: true }
  ]);
}

function buildNumberPad(count, onPick) {
  const wrap = document.createElement('div');
  wrap.className = 'grid grid-cols-8 sm:grid-cols-10 gap-1';
  const buttons = [];

  for (let i = 1; i <= count; i++) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.number = String(i);
    btn.textContent = String(i);
    btn.className = 'num-btn py-1.5 rounded-lg bg-white text-slate-700 border border-slate-200 hover:bg-amber-100 hover:border-amber-400 font-bold text-xs shadow-sm transition';
    btn.addEventListener('click', () => onPick(i));
    wrap.appendChild(btn);
    buttons.push(btn);
  }

  wrap.setActive = (number) => {
    buttons.forEach(btn => {
      const active = Number(btn.textContent) === Number(number);
      btn.className = active
        ? 'num-btn py-1.5 rounded-lg bg-amber-500 text-white border border-amber-400 font-bold text-xs shadow transition'
        : 'num-btn py-1.5 rounded-lg bg-white text-slate-700 border border-slate-200 hover:bg-amber-100 hover:border-amber-400 font-bold text-xs shadow-sm transition';
    });
  };

  return wrap;
}

function openResourceCardModal(level) {
  const lvl = Number(level);
  const list = game.getResourceList(lvl);
  if (!list.length) {
    showToast('Для этого уровня нет списка ресурсов', 'ℹ️');
    return;
  }

  const levelInfo = LEVEL_INFO.find(l => l.level === lvl);
  const body = [];
  let selected = null;

  const info = document.createElement('p');
  info.className = 'text-slate-600 leading-relaxed';
  info.textContent = `Игрок называет номер из списка ресурсов ${lvl} уровня (${levelInfo ? levelInfo.name : lvl}). Выберите номер — покажу ресурс.`;
  body.push(info);

  const preview = document.createElement('div');
  preview.className = 'py-4 text-2xl font-black text-emerald-700 text-center bg-emerald-50 border border-emerald-200 rounded-xl';
  preview.textContent = 'Ресурс ещё не выбран';
  body.push(preview);

  const pad = buildNumberPad(list.length, (number) => {
    selected = number;
    const item = game.takeResourceByNumber(lvl, number);
    pad.setActive(number);
    if (item) {
      preview.textContent = `№${item.number} · ${item.title}`;
      preview.classList.remove('text-slate-500');
    }
  });
  body.push(pad);

  const listWrap = document.createElement('div');
  listWrap.className = 'max-h-32 overflow-y-auto rounded-lg border bg-white/70 p-2 text-[11px] text-slate-600';
  list.forEach(item => {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'w-full text-left flex gap-2 px-1.5 py-0.5 rounded hover:bg-emerald-50';
    row.innerHTML = `<b class="font-mono text-emerald-700">${item.number}</b><span>${escapeHtml(item.title)}</span>`;
    row.addEventListener('click', () => {
      selected = item.number;
      pad.setActive(item.number);
      preview.textContent = `№${item.number} · ${item.title}`;
      preview.classList.remove('text-slate-500');
    });
    listWrap.appendChild(row);
  });
  body.push(listWrap);

  const randomBtn = document.createElement('button');
  randomBtn.type = 'button';
  randomBtn.className = 'self-start py-1.5 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 text-[11px] font-semibold text-slate-700 border border-slate-300';
  randomBtn.textContent = '🎲 Случайный ресурс';
  randomBtn.addEventListener('click', () => {
    const card = game.drawResourceCard(lvl);
    if (!card) return;
    selected = card.number;
    pad.setActive(card.number);
    preview.textContent = `№${card.number} · ${card.title}`;
    preview.classList.remove('text-slate-500');
  });
  body.push(randomBtn);

  openNotice(`Карта ресурса ${lvl} уровня`, body, [
    {
      label: 'Получить ресурс (+1)',
      primary: true,
      close: false,
      onClick: () => {
        if (!selected) {
          showToast('Сначала выберите номер ресурса', 'ℹ️');
          return;
        }
        const item = game.takeResourceByNumber(lvl, selected);
        game.changeResource(lvl, 1);
        modalNotice.classList.add('hidden');
        updateUI();
        showToast(`+1 ресурс (${levelInfo ? levelInfo.name : lvl} уровень): «${item ? item.title : ''}»`, '💎');
      }
    },
    { label: 'Закрыть без начисления' }
  ]);
}

function openVectorCardModal(cell) {
  const levelFourCells = GAME_CELLS.filter(c => c.level === 4);
  const body = [];

  const info = document.createElement('div');
  info.className = 'p-3 rounded-lg bg-white border border-slate-200';
  info.innerHTML = `<p><b class="text-slate-800">Карта-вектор 4 уровня</b> задаёт направление движения. Возьмите физическую карту из комплекта и следуйте инструкции на ней.</p>
    <p class="mt-1 text-slate-500">Если карты нет под рукой, выберите клетку назначения вручную — ведущий может сделать это осознанно, опираясь на запрос игрока.</p>`;
  body.push(info);

  const label = document.createElement('label');
  label.className = 'text-[11px] text-slate-500 font-semibold';
  label.textContent = 'Клетка назначения (1–104)';
  const input = document.createElement('input');
  input.type = 'number';
  input.min = '1';
  input.max = '104';
  input.value = String(cell.vectorTarget || 53);
  input.className = 'mt-1 w-full px-2.5 py-1.5 rounded bg-amber-50 border border-slate-200 text-xs text-slate-700 focus:outline-none focus:border-amber-500';
  label.appendChild(input);
  body.push(label);

  const quick = document.createElement('div');
  quick.className = 'grid grid-cols-2 gap-1.5 max-h-40 overflow-y-auto pr-1';
  levelFourCells.forEach(target => {
    const btn = document.createElement('button');
    btn.className = 'text-left px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 border border-slate-200 text-[10px] text-slate-600';
    btn.textContent = `${target.id} · ${target.boardName}`;
    btn.addEventListener('click', () => { input.value = String(target.id); });
    quick.appendChild(btn);
  });
  body.push(quick);

  openNotice('Карта-вектор: выберите направление', body, [
    { label: 'Отмена' },
    {
      label: 'Перейти по карте',
      primary: true,
      onClick: () => {
        const target = parseInt(input.value, 10);
        if (!Number.isFinite(target) || target < 1 || target > 104) {
          showToast('Укажите клетку от 1 до 104', '⚠️');
          return;
        }
        const player = game.getActivePlayer();
        if (!player) return;
        game.moveToCell(player, target, `🧭 Переход по карте-вектору с клетки ${cell.id} на клетку ${target}`);
        updateUI();
        showToast(`Переход на клетку ${target}`, '🧭');
      }
    }
  ]);
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
    item.className = 'p-3 rounded-xl bg-white border border-slate-200 flex items-center justify-between gap-3';
    item.innerHTML = `
      <div class="flex items-center gap-3 min-w-0">
        <span class="w-4 h-4 rounded-full shrink-0" style="background-color: ${escapeHtml(p.color.hex)}"></span>
        <div class="min-w-0">
          <div class="font-bold text-xs text-slate-800 flex items-center gap-2 flex-wrap">
            №${idx + 1} · ${escapeHtml(p.name)}
            ${idx === game.state.activePlayerIndex ? '<span class="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">Активный</span>' : ''}
            ${renderStatusChip(p)}
          </div>
          <div class="text-[11px] text-slate-500">Клетка ${p.currentCell} • Ходов: ${Math.max(0, p.history.length - 1)}${p.birthDate ? ` • 🎂 ${escapeHtml(p.birthDate)}` : ''}</div>
        </div>
      </div>
      <div class="flex items-center gap-2 shrink-0">
        <button class="btn-rename-player px-2.5 py-1 rounded bg-slate-100 text-xs text-slate-600" data-idx="${idx}">Имя</button>
        <button class="btn-make-active px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-xs text-slate-600" data-idx="${idx}">Выбрать</button>
        <button class="btn-open-dossier px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-xs text-slate-600" data-idx="${idx}">Карта</button>
        ${game.state.players.length > 1 ? `<button class="btn-del-player text-rose-700 hover:text-rose-700 px-2 py-1 text-xs" data-id="${escapeHtml(p.id)}">Удалить</button>` : ''}
      </div>
    `;

    item.querySelector('.btn-rename-player').addEventListener('click', () => {
      const name = window.prompt('Имя участника', p.name);
      if (!name?.trim()) return;
      game.pushUndo();
      game.setPlayerField(p.id, 'name', name.trim());
      updateUI();
      renderPlayersListModal();
    });

    item.querySelector('.btn-make-active').addEventListener('click', () => {
      game.state.activePlayerIndex = idx;
      game.state.selectedCellId = p.currentCell;
      game.saveState();
      renderPlayersListModal();
    });

    item.querySelector('.btn-open-dossier').addEventListener('click', () => {
      game.state.activePlayerIndex = idx;
      game.state.selectedCellId = p.currentCell;
      game.saveState();
      modalPlayers.classList.add('hidden');
      openDossierModal();
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

function formatNote(value) {
  const text = String(value || '').trim();
  if (!text) return '—';
  return escapeHtml(text).replace(/\n/g, '<br>');
}

function openDossierModal() {
  const p = game.getActivePlayer();
  if (!p) return;

  document.getElementById('modalDossierPlayerName').textContent = p.name;
  document.getElementById('printPlayerName').textContent = p.name;
  document.getElementById('printPlayerStatus').textContent = game.getStatusLabel(p);
  document.getElementById('printBirthDate').textContent = p.birthDate ? `Дата рождения: ${p.birthDate}` : 'Дата рождения: —';
  document.getElementById('printDate').textContent = new Date().toLocaleDateString('ru-RU');
  document.getElementById('printPlayerRequest').textContent = p.request || 'Запрос не указан';
  document.getElementById('printPlayerProblem').textContent = p.problem || '—';
  document.getElementById('printPlayerDesired').textContent = p.desired || '—';
  document.getElementById('printPlayerInsights').textContent = p.notes.insights || 'Инсайты пока не зафиксированы';
  document.getElementById('printPlayerTrajectory').textContent = p.history.join(' ➔ ');
  document.getElementById('inputDossierBirthDate').value = p.birthDate || '';
  document.getElementById('inputDossierRequest').value = p.request || '';
  document.getElementById('inputDossierProblem').value = p.problem || '';
  document.getElementById('inputDossierDesired').value = p.desired || '';

  renderDossierTable(p);
  renderLevelNotesEditor(p);

  document.body.classList.add('dossier-open');
  modalDossier.classList.remove('hidden');
}

function renderDossierTable(player) {
  const tbody = document.getElementById('printTableBody');
  tbody.innerHTML = '';

  LEVEL_INFO.forEach(lvl => {
    const notes = player.levelNotes[lvl.level] || { blocks: '', fears: '' };
    const res = game.getResourceBreakdown(player, lvl.level);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="border border-slate-300 p-1.5 font-semibold">${lvl.level}. ${escapeHtml(lvl.name)} <span class="text-[9px] text-slate-500">(${escapeHtml(lvl.colorName)})</span></td>
      <td class="border border-slate-300 p-1.5 text-center align-top">
        <b>${res.total}</b>
        <div class="text-[9px] text-slate-500">${res.base}+${res.extra}</div>
      </td>
      <td id="dossierBlocks${lvl.level}" class="border border-slate-300 p-1.5 text-[10px] text-slate-700 align-top">${formatNote(notes.blocks)}</td>
      <td id="dossierFears${lvl.level}" class="border border-slate-300 p-1.5 text-[10px] text-slate-700 align-top">${formatNote(notes.fears)}</td>
    `;
    tbody.appendChild(tr);
  });
}

function renderLevelNotesEditor(player) {
  const wrap = document.getElementById('levelNotesEditor');
  wrap.innerHTML = '';

  LEVEL_INFO.forEach(lvl => {
    const notes = player.levelNotes[lvl.level] || { blocks: '', fears: '' };
    const res = game.getResourceBreakdown(player, lvl.level);
    const card = document.createElement('div');
    card.className = 'p-2 rounded-lg bg-white border border-slate-200';

    const head = document.createElement('div');
    head.className = 'flex items-center justify-between gap-2 mb-1';
    head.innerHTML = `<span class="text-[11px] font-bold ${escapeHtml(lvl.textClass)}">${lvl.level}. ${escapeHtml(lvl.name)}</span><span class="text-[10px] text-slate-500">ресурсы: ${res.base}+${res.extra}</span>`;
    card.appendChild(head);

    const grid = document.createElement('div');
    grid.className = 'grid grid-cols-1 sm:grid-cols-2 gap-1.5';

    const makeArea = (key, placeholder) => {
      const area = document.createElement('textarea');
      area.rows = 2;
      area.placeholder = placeholder;
      area.className = 'w-full px-2 py-1 rounded bg-amber-50 border border-slate-200 text-[11px] text-slate-700 focus:outline-none focus:border-amber-500 resize-y';
      area.value = notes[key] || '';
      area.addEventListener('input', () => {
        game.setLevelNote(player.id, lvl.level, key, area.value);
        const cell = document.getElementById(`dossier${key === 'blocks' ? 'Blocks' : 'Fears'}${lvl.level}`);
        if (cell) cell.innerHTML = formatNote(area.value);
      });
      return area;
    };

    grid.appendChild(makeArea('blocks', 'Блоки: что повторяется?'));
    grid.appendChild(makeArea('fears', 'Страхи, убеждения, вторичные выгоды...'));
    card.appendChild(grid);
    wrap.appendChild(card);
  });
}

function openSyncModal() {
  const inputRoom = document.getElementById('inputCloudRoomName');
  if (inputRoom && game.state.cloudRoomId) {
    inputRoom.value = game.state.cloudRoomId;
  }
  modalSync.classList.remove('hidden');
}

async function copyText(text, successMessage = 'Скопировано!') {
  try {
    await navigator.clipboard.writeText(text);
    showToast(successMessage, '📋');
  } catch (e) {
    try {
      const area = document.createElement('textarea');
      area.value = text;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      document.body.removeChild(area);
      showToast(successMessage, '📋');
    } catch (fallbackError) {
      window.prompt('Скопируйте текст вручную:', text);
    }
  }
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
window.game = game;
