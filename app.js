import { GAME_CELLS, GAME_DECKS, RESOURCE_DECKS, LEVEL_INFO } from './gameData.js';

const LEVELS = [1, 2, 3, 4, 5, 6];
const DEFAULT_REQUEST = 'Что мне мешает проявиться и выйти на новый доход?';
const SAVE_KEY = 'insight_game_save_v1';
const PENDING_KEY = SAVE_KEY + '_pending_room';

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function bytesToBase64(bytes) {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function base64ToBytes(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function compressToBase64(text) {
  if (typeof CompressionStream === 'undefined') return null;
  try {
    const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('deflate-raw'));
    const buffer = await new Response(stream).arrayBuffer();
    return bytesToBase64(new Uint8Array(buffer));
  } catch (e) {
    return null;
  }
}

async function decompressFromBase64(payload) {
  if (typeof DecompressionStream === 'undefined') throw new Error('Decompression is not supported');
  const bytes = base64ToBytes(payload);
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return await new Response(stream).text();
}


function emptyLevelNotes() {
  const notes = {};
  LEVELS.forEach(level => { notes[level] = { blocks: '', fears: '' }; });
  return notes;
}

function normalizePlayer(player, index, colors) {
  const p = player && typeof player === 'object' ? player : {};
  const resources = {};
  const baseResources = {};
  const extraResources = {};

  LEVELS.forEach(level => {
    const total = Number.isFinite(Number(p.resources?.[level])) ? Math.max(0, Math.floor(Number(p.resources[level]))) : 1;
    let base = Number.isFinite(Number(p.baseResources?.[level])) ? Math.max(0, Math.floor(Number(p.baseResources[level]))) : null;
    let extra = Number.isFinite(Number(p.extraResources?.[level])) ? Math.max(0, Math.floor(Number(p.extraResources[level]))) : null;

    if (base === null || extra === null) {
      base = Math.min(total, 1);
      extra = Math.max(0, total - base);
    }

    baseResources[level] = base;
    extraResources[level] = extra;
    resources[level] = base + extra;
  });

  const levelNotes = emptyLevelNotes();
  if (p.levelNotes && typeof p.levelNotes === 'object') {
    LEVELS.forEach(level => {
      levelNotes[level].blocks = String(p.levelNotes?.[level]?.blocks || '');
      levelNotes[level].fears = String(p.levelNotes?.[level]?.fears || '');
    });
  }

  const legacyBlocks = String(p.notes?.blocks || '');
  if (legacyBlocks) {
    legacyBlocks.split('\n').forEach(line => {
      const match = line.match(/Клетка\s+(\d+)/i);
      if (!match) return;
      const cell = GAME_CELLS.find(c => c.id === Number(match[1]));
      if (!cell) return;
      if (!levelNotes[cell.level].blocks.includes(line.trim())) {
        levelNotes[cell.level].blocks = levelNotes[cell.level].blocks
          ? `${levelNotes[cell.level].blocks}\n${line.trim()}`
          : line.trim();
      }
    });
  }

  const color = p.color && /^#[0-9a-f]{6}$/i.test(p.color.hex || '')
    ? p.color
    : colors[index % colors.length];
  const currentCell = clamp(Number(p.currentCell) || 98, 1, 104);
  const history = Array.isArray(p.history) && p.history.length ? p.history.map(Number).filter(n => n >= 1 && n <= 104) : [currentCell];
  const cellVisits = p.cellVisits && typeof p.cellVisits === 'object' ? { ...p.cellVisits } : {};

  if (!cellVisits[currentCell]) cellVisits[currentCell] = 1;

  return {
    id: p.id || `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
    name: String(p.name || `Игрок ${index + 1}`),
    request: String(p.request || ''),
    problem: String(p.problem || ''),
    desired: String(p.desired || ''),
    birthDate: String(p.birthDate || ''),
    color,
    currentCell,
    isBorn: Boolean(p.isBorn),
    finished: Boolean(p.finished),
    exited: Boolean(p.exited),
    birthOrder: p.birthOrder != null && Number.isFinite(Number(p.birthOrder)) ? Number(p.birthOrder) : null,
    history,
    cellVisits,
    resources,
    baseResources,
    extraResources,
    notes: {
      resources: String(p.notes?.resources || ''),
      blocks: legacyBlocks,
      fears: String(p.notes?.fears || ''),
      insights: String(p.notes?.insights || '')
    },
    levelNotes,
    pendingArrow: null
  };
}

export class InsightGame {
  constructor() {
    this.cells = GAME_CELLS;
    this.decks = GAME_DECKS;
    this.resourceDecks = RESOURCE_DECKS;
    this.levelInfo = LEVEL_INFO;

    this.defaultPlayerColors = [
      { name: 'Фиолетовый', hex: '#8B5CF6' },
      { name: 'Изумрудный', hex: '#10B981' },
      { name: 'Янтарный', hex: '#F59E0B' },
      { name: 'Рубиновый', hex: '#EF4444' },
      { name: 'Лазурный', hex: '#06B6D4' },
      { name: 'Индиго', hex: '#3B82F6' },
      ...['#7C2D12', '#0F766E', '#BE185D', '#4338CA', '#4D7C0F', '#B45309',
        '#0369A1', '#A21CAF', '#374151', '#15803D', '#9F1239', '#6D28D9',
        '#0E7490', '#854D0E'].map((hex, i) => ({ name: `Цвет ${i + 7}`, hex }))
    ];

    this.state = this.createDefaultState();
    this.undoStack = [];
    this.maxUndo = 40;
    this.isCloudSyncActive = false;
    this.cloudReachable = null;
    this.cloudError = '';
    this.pollingTimer = null;
    this.cloudSaveTimer = null;
    this.cloudDirty = false;
    this.cloudCanWrite = false;
    this.cloudSavePromise = null;
    this.cloudSavedAt = null;
    this.suppressCloudSave = false;
    this.onStateChangedCallbacks = [];

    this.readyPromise = this.init();
  }

  createDefaultState() {
    return {
      players: [],
      activePlayerIndex: 0,
      round: 1,
      selectedCellId: 98,
      drawnCard: null,
      filterLevel: 'all',
      log: [],
      cloudRoomId: null,
      sessionTitle: '',
      lastUpdated: Date.now(),
      gameStarted: false,
      deckRemaining: {},
      autoSymbols: true
    };
  }

  async init() {
    const urlParams = new URLSearchParams(window.location.search);
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch {}
    const hasSnapshot = /^#sessionz?=/.test(window.location.hash);
    const roomParam = hasSnapshot ? null : (urlParams.get('room') || saved?.cloudRoomId);
    let cloudFound = false;

    if (roomParam) {
      if (saved?.cloudRoomId === roomParam) this.state = this.normalizeState(saved);
      this.state.cloudRoomId = this.sanitizeRoomId(roomParam);
      this.isCloudSyncActive = true;
      try { this.cloudDirty = localStorage.getItem(PENDING_KEY) === this.state.cloudRoomId; } catch {}
      this.suppressCloudSave = true;
      const result = await this.fetchFromCloud({ force: true, apply: !this.cloudDirty });
      cloudFound = Boolean(result?.found);
      this.suppressCloudSave = false;
      this.startPolling();
    } else {
      const hashImported = await this.importSessionFromHash();
      if (!hashImported) this.loadState();
    }

    this.state = this.normalizeState(this.state);

    if (this.state.players.length === 0) {
      this.addPlayer('Игрок 1', DEFAULT_REQUEST, { save: false, notify: false, undo: false });
    }

    this.state.selectedCellId = this.getActivePlayer()?.currentCell ?? 98;
    this.saveState({ cloud: false, notify: false, touch: false });

    if (roomParam && ((!cloudFound && this.cloudReachable === true) || this.cloudDirty)) this.queueCloudSave(0);
    this.notifyStateChange();
  }

  whenReady() {
    return this.readyPromise;
  }

  normalizeState(raw) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const state = { ...this.createDefaultState(), ...source };
    state.players = (Array.isArray(source.players) ? source.players : []).map((p, idx) => normalizePlayer(p, idx, this.defaultPlayerColors));
    state.activePlayerIndex = state.players.length ? clamp(Number(source.activePlayerIndex) || 0, 0, state.players.length - 1) : 0;
    state.selectedCellId = clamp(Number(source.selectedCellId) || 98, 1, 104);
    state.round = Math.max(1, Number(source.round) || 1);
    state.log = Array.isArray(source.log) ? source.log.filter(Boolean).slice(0, 80) : [];
    state.deckRemaining = source.deckRemaining && typeof source.deckRemaining === 'object' ? { ...source.deckRemaining } : {};
    state.autoSymbols = source.autoSymbols !== false;
    state.gameStarted = Boolean(source.gameStarted) || (state.players.length > 0 && state.players.every(p => p.isBorn));
    state.cloudRoomId = source.cloudRoomId || null;
    state.lastUpdated = Number(source.lastUpdated) || Date.now();
    return state;
  }

  onStateChange(cb) {
    this.onStateChangedCallbacks.push(cb);
  }

  notifyStateChange() {
    this.onStateChangedCallbacks.forEach(cb => {
      try { cb(); } catch (e) { console.error(e); }
    });
  }

  saveState(options = {}) {
    const { cloud = true, notify = true, touch = true } = options;
    if (touch) this.state.lastUpdated = Math.max(Date.now(), Number(this.state.lastUpdated || 0) + 1);
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.state));
    } catch (e) {
      console.error('Ошибка сохранения:', e);
    }

    if (cloud && this.state.cloudRoomId && this.isCloudSyncActive && !this.suppressCloudSave) {
      this.queueCloudSave();
    }

    if (notify) this.notifyStateChange();
  }

  loadState() {
    try {
      const saved = localStorage.getItem(SAVE_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved);
      if (parsed && Array.isArray(parsed.players)) {
        this.state = this.normalizeState({ ...this.state, ...parsed, cloudRoomId: null });
      }
    } catch (e) {
      console.warn('Не удалось загрузить сохраненную игру:', e);
    }
  }

  // --- UNDO ---

  pushUndo() {
    const snapshot = deepClone({
      players: this.state.players,
      activePlayerIndex: this.state.activePlayerIndex,
      round: this.state.round,
      selectedCellId: this.state.selectedCellId,
      log: this.state.log,
      gameStarted: this.state.gameStarted,
      deckRemaining: this.state.deckRemaining,
      drawnCard: this.state.drawnCard,
      autoSymbols: this.state.autoSymbols
    });
    this.undoStack.push(snapshot);
    if (this.undoStack.length > this.maxUndo) this.undoStack.shift();
  }

  canUndo() {
    return this.undoStack.length > 0;
  }

  undo() {
    const snapshot = this.undoStack.pop();
    if (!snapshot) return false;
    Object.assign(this.state, snapshot);
    this.saveState();
    return true;
  }

  // --- PLAYERS ---

  addPlayer(name, request = '', options = {}) {
    if (this.state.players.length >= 20) return null;
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const usedColors = new Set(this.state.players.map(p => p.color?.hex).filter(Boolean));
    const color = this.defaultPlayerColors.find(c => !usedColors.has(c.hex))
      || this.defaultPlayerColors[this.state.players.length % this.defaultPlayerColors.length];

    const newPlayer = normalizePlayer({
      id,
      name: name || `Игрок ${this.state.players.length + 1}`,
      request: request || '',
      color,
      currentCell: 98,
      isBorn: false,
      history: [98],
      cellVisits: { 98: 1 },
      resources: { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1 }
    }, this.state.players.length, this.defaultPlayerColors);

    if (options.undo !== false) this.pushUndo();
    this.state.players.push(newPlayer);
    if (options.save !== false) this.saveState({ notify: options.notify !== false });
    return newPlayer;
  }

  removePlayer(playerId) {
    if (this.state.players.length <= 1) return false;
    const removedIndex = this.state.players.findIndex(p => p.id === playerId);
    if (removedIndex === -1) return false;

    this.pushUndo();
    this.state.players = this.state.players.filter(p => p.id !== playerId);
    if (removedIndex < this.state.activePlayerIndex) {
      this.state.activePlayerIndex--;
    }
    if (this.state.activePlayerIndex >= this.state.players.length) {
      this.state.activePlayerIndex = 0;
    }
    const active = this.getActivePlayer();
    if (active) this.state.selectedCellId = active.currentCell;
    this.saveState();
    return true;
  }

  getPlayer(playerId) {
    return this.state.players.find(p => p.id === playerId) || null;
  }

  getActivePlayer() {
    if (this.state.players.length === 0) return null;
    return this.state.players[this.state.activePlayerIndex] || this.state.players[0];
  }

  getStatus(player) {
    if (!player) return 'none';
    if (player.finished) return 'finished';
    if (player.exited) return 'exited';
    if (!player.isBorn) return 'unborn';
    return 'playing';
  }

  getStatusLabel(player) {
    switch (this.getStatus(player)) {
      case 'finished': return '🪷 Инсайт достигнут';
      case 'exited': return '🛑 Выход из игры';
      case 'unborn': return '🐣 Ожидает рождения';
      default: return '🎲 В игре';
    }
  }

  setPlayerField(playerId, field, value) {
    const player = this.getPlayer(playerId);
    if (!player) return false;
    if (!['name', 'request', 'problem', 'desired', 'birthDate'].includes(field)) return false;
    player[field] = String(value || '');
    this.saveState({ notify: false });
    return true;
  }

  setPlayerNote(playerId, key, value) {
    const player = this.getPlayer(playerId);
    if (!player || !['resources', 'blocks', 'fears', 'insights'].includes(key)) return false;
    player.notes[key] = String(value || '');
    this.saveState({ notify: false });
    return true;
  }

  setLevelNote(playerId, level, key, value) {
    const player = this.getPlayer(playerId);
    const lvl = Number(level);
    if (!player || !LEVELS.includes(lvl) || !['blocks', 'fears'].includes(key)) return false;
    player.levelNotes[lvl][key] = String(value || '');
    this.saveState({ notify: false });
    return true;
  }

  setAutoSymbols(enabled) {
    this.state.autoSymbols = Boolean(enabled);
    this.saveState();
  }

  revivePlayer(playerId) {
    const player = this.getPlayer(playerId);
    if (!player) return false;
    this.pushUndo();

    if (player.exited) {
      player.exited = false;
      player.isBorn = false;
      player.currentCell = 98;
      player.history.push(98);
      player.cellVisits[98] = (player.cellVisits[98] || 0) + 1;
      player.pendingArrow = null;
      this.state.selectedCellId = 98;
      this.addLog({
        playerName: player.name,
        fromCell: 101,
        toCell: 98,
        cellName: 'Инсайт',
        level: 6,
        message: '🔄 Игрок возвращён в игру после выхода на клетке 101. Новый запрос — новое рождение.',
        kind: 'revive'
      });
    } else if (player.finished) {
      player.finished = false;
      player.pendingArrow = null;
      this.state.selectedCellId = player.currentCell;
      this.addLog({
        playerName: player.name,
        fromCell: player.currentCell,
        toCell: player.currentCell,
        cellName: this.getCell(player.currentCell).boardName,
        level: this.getCell(player.currentCell).level,
        message: '🔄 Игрок продолжает исследование после Инсайта.',
        kind: 'revive'
      });
    } else {
      return false;
    }

    this.saveState();
    return true;
  }

  // --- TURNS ---

  nextTurn() {
    const onlyPlayer = this.getActivePlayer();
    if (this.state.players.length <= 1) {
      if (onlyPlayer && (onlyPlayer.finished || onlyPlayer.exited)) {
        return { gameOver: true };
      }
      this.pushUndo();
      this.state.round++;
      this.saveState();
      return { gameOver: false, round: this.state.round };
    }

    const total = this.state.players.length;
    const startIndex = this.state.activePlayerIndex;
    let nextIndex = -1;

    for (let step = 1; step <= total; step++) {
      const idx = (startIndex + step) % total;
      const candidate = this.state.players[idx];
      if (candidate && !candidate.finished && !candidate.exited) {
        nextIndex = idx;
        break;
      }
    }

    if (nextIndex === -1) {
      return { gameOver: true };
    }

    this.pushUndo();
    if (nextIndex <= startIndex) this.state.round++;
    this.state.activePlayerIndex = nextIndex;
    const current = this.getActivePlayer();
    if (current) this.state.selectedCellId = current.currentCell;
    this.saveState();
    return { gameOver: false, round: this.state.round };
  }

  advanceToNextUnborn(fromIndex = this.state.activePlayerIndex) {
    const total = this.state.players.length;
    for (let step = 1; step <= total; step++) {
      const idx = (fromIndex + step) % total;
      if (this.state.players[idx] && !this.state.players[idx].isBorn) {
        this.state.activePlayerIndex = idx;
        this.state.selectedCellId = this.state.players[idx].currentCell;
        return this.state.players[idx];
      }
    }
    return null;
  }

  firstBornPlayer() {
    const born = this.state.players.filter(p => p.isBorn);
    if (born.length === 0) return null;
    return [...born].sort((a, b) => {
      const ao = Number.isFinite(a.birthOrder) ? a.birthOrder : 999;
      const bo = Number.isFinite(b.birthOrder) ? b.birthOrder : 999;
      return ao - bo;
    })[0];
  }

  startPlayIfEveryoneBorn() {
    if (this.state.gameStarted) return false;
    if (this.state.players.length === 0) return false;
    if (!this.state.players.every(p => p.isBorn)) return false;

    this.state.gameStarted = true;
    this.state.round = 1;
    const first = this.firstBornPlayer();
    if (first) {
      this.state.activePlayerIndex = this.state.players.findIndex(p => p.id === first.id);
      this.state.selectedCellId = first.currentCell;
    }
    this.addLog({
      playerName: 'Игра',
      fromCell: 98,
      toCell: 1,
      cellName: 'Рождение',
      level: 1,
      message: `🎉 Все игроки родились. Первым ходит ${first ? first.name : 'первый игрок'}.`,
      kind: 'phase'
    });
    this.saveState();
    return true;
  }

  // --- DICE & MOVEMENT ---

  handleDiceRoll(roll) {
    const player = this.getActivePlayer();
    if (!player) return null;
    const value = clamp(Number(roll) || 0, 0, 6);
    if (!value) return null;

    if (player.finished) {
      return { blocked: true, player, message: `🪷 ${player.name} уже достиг Инсайта. Передайте ход или верните игрока в игру.` };
    }
    if (player.exited) {
      return { blocked: true, player, message: `🛑 ${player.name} вышел из игры на клетке 101. Сформулируйте новый запрос и верните игрока.` };
    }

    if (!player.isBorn) {
      this.pushUndo();

      if (value !== 1) {
        const next = this.advanceToNextUnborn(this.state.activePlayerIndex);
        this.addLog({
          playerName: player.name,
          fromCell: 98,
          toCell: 98,
          cellName: 'Инсайт',
          level: 6,
          message: `🎲 Выпало ${value}. ${player.name} ждёт единицу для Рождения.`,
          kind: 'birth'
        });
        this.saveState();
        return {
          player,
          roll: value,
          fromCell: 98,
          toCell: 98,
          visits: player.cellVisits[98] || 1,
          isBlockTriggered: false,
          birthWaiting: true,
          nextPlayer: next,
          message: `🎲 Выпало ${value}. ${player.name} ждёт единицу на кубике для Рождения.`
        };
      }

      player.isBorn = true;
      player.birthOrder = this.state.players.filter(p => p.isBorn).length;
      const result = this.moveToCell(player, 1, `🎉 УРА! Выпала единица! ${player.name} родился и перемещается на клетку 1 «Рождение»!`, { undo: false });
      const started = this.startPlayIfEveryoneBorn();

      if (!started) {
        const next = this.advanceToNextUnborn(this.state.players.findIndex(p => p.id === player.id));
        result.nextPlayer = next;
        this.saveState();
      }

      return { ...result, born: true, gameStarted: this.state.gameStarted, nextPlayer: result.nextPlayer || null };
    }

    if (player.currentCell === 104) {
      return {
        blocked: true,
        player,
        message: '↪️ Игрок на клетке 104. По правилам сначала нужно перейти по стрелке на клетку 43.'
      };
    }

    const targetCell = Math.min(104, player.currentCell + value);
    const arrowWarning = this.getCell(player.currentCell).vectorTarget
      ? `На клетке ${player.currentCell} есть стрелка. Не забудьте выполнить переход.`
      : '';

    const message = `🎲 ${player.name}: бросок [${value}] ➔ перемещение с клетки ${player.currentCell} на клетку ${targetCell}.`;
    const result = this.moveToCell(player, targetCell, message);
    result.arrowWarning = arrowWarning;
    return result;
  }

  moveToCell(player, targetCell, customMessage = '', options = {}) {
    if (!player) return null;
    if (player.finished || player.exited) {
      return { blocked: true, player, message: 'Игрок завершил игру.' };
    }

    const target = clamp(Number(targetCell) || 1, 1, 104);
    const fromCell = player.currentCell;
    const cell = this.getCell(target);

    if (options.undo !== false) this.pushUndo();

    player.currentCell = target;
    player.history.push(target);
    player.cellVisits[target] = (player.cellVisits[target] || 0) + 1;
    const visits = player.cellVisits[target];

    let blockWarning = '';
    let isBlockTriggered = false;
    if (visits >= 3) {
      isBlockTriggered = true;
      blockWarning = `⚠️ ВНИМАНИЕ! ${player.name} встал на клетку ${target} уже ${visits}-й раз! По правилам игры это БЛОК.`;
      this.addBlockNote(player, cell, visits);
    }

    let loss = null;
    if (this.isCellLoss(cell) && this.state.autoSymbols !== false) {
      loss = this.spendResource(player, cell.level);
    }

    let finishWarning = '';
    if (target === 98 && player.isBorn) {
      player.finished = true;
      finishWarning = `🪷 ${player.name} достиг клетки 98 «Инсайт»! Запрос пришёл к разрешению.`;
    }

    let exitWarning = '';
    if (target === 101) {
      player.exited = true;
      exitWarning = `🛑 ${player.name} попал на клетку 101 «Одержимость». Это выход из игры.`;
    }

    player.pendingArrow = (!player.finished && !player.exited && cell.vectorTarget) ? cell.vectorTarget : null;

    let message = customMessage || `Переход на клетку ${target} (${cell.boardName})`;
    if (loss) {
      message += loss.spent === 'base'
        ? ` ❌ −1 базовый ресурс ${cell.level} уровня.`
        : loss.spent === 'extra'
          ? ` ❌ −1 ресурс ${cell.level} уровня.`
          : ` ❌ Ресурсов ${cell.level} уровня нет — терять нечего.`;
    }
    if (finishWarning) message += ` ${finishWarning}`;
    if (exitWarning) message += ` ${exitWarning}`;

    const logEntry = {
      timestamp: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
      playerName: player.name,
      fromCell,
      toCell: target,
      cellName: cell.boardName,
      level: cell.level,
      message,
      blockWarning,
      kind: 'move'
    };
    this.addLog(logEntry);

    this.state.selectedCellId = target;
    this.saveState();

    return {
      player,
      fromCell,
      toCell: target,
      cell,
      visits,
      isBlockTriggered,
      blockWarning,
      message,
      loss,
      finished: Boolean(player.finished),
      exited: Boolean(player.exited),
      pendingArrow: player.pendingArrow,
      finishWarning,
      exitWarning
    };
  }

  resolveArrow(player = this.getActivePlayer(), target = null) {
    if (!player) return null;
    const cell = this.getCell(player.currentCell);
    const destination = Number(target) || cell.vectorTarget;
    if (!destination) return null;
    const result = this.moveToCell(player, destination, `🚀 Переход по стрелке с клетки ${cell.id} на клетку ${destination}`);
    this.saveState({ notify: false });
    return result;
  }

  skipPendingArrow(player = this.getActivePlayer()) {
    if (!player) return false;
    player.pendingArrow = null;
    this.addLog({
      playerName: player.name,
      fromCell: player.currentCell,
      toCell: player.currentCell,
      cellName: this.getCell(player.currentCell).boardName,
      level: this.getCell(player.currentCell).level,
      message: '⏭️ Переход по стрелке пропущен ведущим.',
      kind: 'skip'
    });
    this.saveState();
    return true;
  }

  // --- RESOURCES ---

  syncResources(player) {
    LEVELS.forEach(level => {
      player.baseResources[level] = Math.max(0, Number(player.baseResources[level]) || 0);
      player.extraResources[level] = Math.max(0, Number(player.extraResources[level]) || 0);
      player.resources[level] = player.baseResources[level] + player.extraResources[level];
    });
  }

  getResourceBreakdown(player, level) {
    if (!player) return { base: 0, extra: 0, total: 0 };
    const lvl = Number(level);
    return {
      base: Number(player.baseResources?.[lvl]) || 0,
      extra: Number(player.extraResources?.[lvl]) || 0,
      total: Number(player.resources?.[lvl]) || 0
    };
  }

  spendResource(player, level) {
    const lvl = Number(level);
    if (!player || !LEVELS.includes(lvl)) return { spent: null, level: lvl, total: 0 };

    let spent = null;
    if ((player.extraResources[lvl] || 0) > 0) {
      player.extraResources[lvl]--;
      spent = 'extra';
    } else if ((player.baseResources[lvl] || 0) > 0) {
      player.baseResources[lvl]--;
      spent = 'base';
    }
    this.syncResources(player);
    return { spent, level: lvl, total: player.resources[lvl] };
  }

  changeResource(level, delta) {
    const player = this.getActivePlayer();
    const lvl = Number(level);
    if (!player || !LEVELS.includes(lvl)) return null;

    if (delta < 0 && ((player.baseResources[lvl] || 0) + (player.extraResources[lvl] || 0)) === 0) {
      return { spent: null, level: lvl, total: 0, delta: 0 };
    }

    this.pushUndo();
    let result;
    if (delta > 0) {
      player.extraResources[lvl] = (player.extraResources[lvl] || 0) + Math.floor(delta);
      this.syncResources(player);
      result = { spent: null, level: lvl, total: player.resources[lvl], delta: Math.floor(delta) };
    } else {
      result = this.spendResource(player, lvl);
      result.delta = result.spent ? -1 : 0;
    }
    this.saveState();
    return result;
  }

  giveAllBaseResources(player) {
    if (!player) return;
    this.pushUndo();
    LEVELS.forEach(level => {
      if ((player.baseResources[level] || 0) < 1) player.baseResources[level] = 1;
      if ((player.extraResources[level] || 0) < 0) player.extraResources[level] = 0;
    });
    this.syncResources(player);
    this.saveState();
  }

  // --- CELLS & DECKS ---

  getCell(id) {
    return this.cells.find(c => c.id === Number(id)) || this.cells[0];
  }

  isCellLoss(cell) {
    if (!cell) return false;
    return cell.type === 'loss'
      || (cell.icon || '').includes('❌')
      || (cell.action || '').startsWith('Потеря ресурса');
  }

  isCellCard(cell) {
    return Boolean(cell && cell.deck);
  }

  isVectorCardCell(cell) {
    return Boolean(cell && cell.type === 'vector' && !cell.vectorTarget);
  }

  isResourceCell(cell) {
    return Boolean(cell && (cell.type === 'resource' || cell.type === 'lotus'));
  }

  addBlockNote(player, cell, visits) {
    const line = `Клетка ${cell.id} «${cell.boardName}» — ${visits}-й визит`;
    const levelNote = player.levelNotes[cell.level].blocks;
    if (!levelNote.includes(line)) {
      player.levelNotes[cell.level].blocks = levelNote ? `${levelNote}\n${line}` : line;
    }
    if (!player.notes.blocks.includes(line)) {
      player.notes.blocks = player.notes.blocks ? `${player.notes.blocks}\n${line}` : line;
    }
  }

  getDeckNames() {
    return Object.keys(this.decks);
  }

  hasDeck(deckName) {
    return Array.isArray(this.decks[deckName]) && this.decks[deckName].length > 0;
  }

  drawCardFromDeck(deckName) {
    const deck = this.decks[deckName];
    if (!Array.isArray(deck) || deck.length === 0) return null;
    if (!this.hasDeck(deckName)) return null;

    const key = `cards:${deckName}`;
    if (!Array.isArray(this.state.deckRemaining[key]) || this.state.deckRemaining[key].length === 0) {
      this.state.deckRemaining[key] = deck.map(c => c.number);
    }

    const remaining = this.state.deckRemaining[key];
    const position = Math.floor(Math.random() * remaining.length);
    const cardNumber = remaining.splice(position, 1)[0];
    const source = deck.find(c => c.number === cardNumber) || deck[0];
    const card = { ...source, deckName };

    this.pushUndo();
    this.state.drawnCard = card;
    this.addLog({
      playerName: this.getActivePlayer()?.name || 'Игра',
      fromCell: this.getActivePlayer()?.currentCell ?? 98,
      toCell: this.getActivePlayer()?.currentCell ?? 98,
      cellName: deckName,
      level: 0,
      message: `🃏 Вытянута карта из колоды «${deckName}»: №${card.number} «${card.title}».`,
      kind: 'card'
    });
    this.saveState();
    return card;
  }

  takeCardByNumber(deckName, number) {
    const deck = this.decks[deckName];
    if (!Array.isArray(deck) || deck.length === 0) return null;
    const wanted = Number(number);
    const source = deck.find(c => c.number === wanted);
    if (!source) return null;

    const key = `cards:${deckName}`;
    if (!Array.isArray(this.state.deckRemaining[key]) || this.state.deckRemaining[key].length === 0) {
      this.state.deckRemaining[key] = deck.map(c => c.number);
    }

    const remaining = this.state.deckRemaining[key];
    const position = remaining.indexOf(wanted);
    const alreadyTaken = position === -1;
    if (!alreadyTaken) remaining.splice(position, 1);

    const card = { ...source, deckName, alreadyTaken };

    this.pushUndo();
    this.state.drawnCard = card;
    this.addLog({
      playerName: this.getActivePlayer()?.name || 'Игра',
      fromCell: this.getActivePlayer()?.currentCell ?? 98,
      toCell: this.getActivePlayer()?.currentCell ?? 98,
      cellName: deckName,
      level: 0,
      message: `🃏 Карта №${card.number} из колоды «${deckName}»: «${card.title}».`,
      kind: 'card'
    });
    this.saveState();
    return card;
  }

  getResourceDeck(level) {
    const lvl = Number(level);
    const deck = this.resourceDecks[lvl];
    return Array.isArray(deck) ? deck : [];
  }

  getResourceList(level) {
    return this.getResourceDeck(level).map((title, index) => ({ number: index + 1, title }));
  }

  takeResourceByNumber(level, number) {
    const wanted = Number(number);
    return this.getResourceList(level).find(r => r.number === wanted) || null;
  }

  drawResourceCard(level) {
    const lvl = Number(level);
    const deck = this.getResourceDeck(lvl);
    if (!deck.length) return null;

    const key = `resource:${lvl}`;
    if (!Array.isArray(this.state.deckRemaining[key]) || this.state.deckRemaining[key].length === 0) {
      this.state.deckRemaining[key] = deck.map((_, idx) => idx + 1);
    }

    const remaining = this.state.deckRemaining[key];
    const position = Math.floor(Math.random() * remaining.length);
    const number = remaining.splice(position, 1)[0];
    const card = {
      number,
      title: deck[number - 1],
      text: `Карта ресурса ${lvl} уровня. Как этот ресурс связан с твоим запросом и что поможет его присвоить?`,
      deckName: `Ресурс ${lvl} уровня`,
      level: lvl
    };

    this.pushUndo();
    this.state.drawnCard = card;
    this.addLog({
      playerName: this.getActivePlayer()?.name || 'Игра',
      fromCell: this.getActivePlayer()?.currentCell ?? 98,
      toCell: this.getActivePlayer()?.currentCell ?? 98,
      cellName: card.deckName,
      level: lvl,
      message: `❤️ Карта ресурса ${lvl} уровня №${card.number}: «${card.title}».`,
      kind: 'card'
    });
    this.saveState();
    return card;
  }

  addLog(entry) {
    const timestamp = entry.timestamp || new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    this.state.log.unshift({ ...entry, timestamp });
    if (this.state.log.length > 80) this.state.log.pop();
  }

  // --- GAME RESET ---

  resetGame() {
    this.pushUndo();
    this.state.players.forEach(p => {
      p.currentCell = 98;
      p.isBorn = false;
      p.finished = false;
      p.exited = false;
      p.birthOrder = null;
      p.pendingArrow = null;
      p.history = [98];
      p.cellVisits = { 98: 1 };
      p.resources = { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1 };
      p.baseResources = { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1 };
      p.extraResources = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
      p.notes = { resources: '', blocks: '', fears: '', insights: '' };
      p.levelNotes = emptyLevelNotes();
    });
    this.state.round = 1;
    this.state.activePlayerIndex = 0;
    this.state.selectedCellId = 98;
    this.state.log = [];
    this.state.drawnCard = null;
    this.state.deckRemaining = {};
    this.state.gameStarted = false;
    this.addLog({
      playerName: 'Игра',
      fromCell: 98,
      toCell: 98,
      cellName: 'Инсайт',
      level: 6,
      message: '🔄 Начата новая игра. Все фишки на клетке 98.',
      kind: 'reset'
    });
    this.saveState();
  }

  // --- CLOUD SYNC ---

  sanitizeRoomId(roomId) {
    return String(roomId || '').trim().replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 64);
  }

  queueCloudSave(delay = 700) {
    if (!this.state.cloudRoomId || !this.isCloudSyncActive || this.suppressCloudSave) return;
    this.cloudDirty = true;
    this.onCloudStatusChange?.();
    try { localStorage.setItem(PENDING_KEY, this.state.cloudRoomId); } catch {}
    if (this.cloudSaveTimer) clearTimeout(this.cloudSaveTimer);
    this.cloudSaveTimer = setTimeout(() => {
      this.cloudSaveTimer = null;
      this.saveToCloud();
    }, delay);
  }

  async saveToCloud() {
    if (!this.state.cloudRoomId || !this.isCloudSyncActive || this.suppressCloudSave || !this.cloudCanWrite) return false;
    if (this.cloudSavePromise) return this.cloudSavePromise;
    const roomId = this.state.cloudRoomId;
    const body = JSON.stringify(this.state);
    this.cloudSavePromise = this.postCloudSnapshot(roomId, body).finally(() => {
      this.cloudSavePromise = null;
    });
    return this.cloudSavePromise;
  }

  async postCloudSnapshot(roomId, body) {
    try {
      const resp = await fetch(`/api/room/${encodeURIComponent(roomId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: AbortSignal.timeout(10000)
      });
      const result = resp.ok ? await resp.json() : null;
      if (this.state.cloudRoomId !== roomId || !this.isCloudSyncActive) return false;
      if (resp.ok && result?.success === true) {
        if (JSON.stringify(this.state) === body) {
          this.cloudDirty = false;
          try { localStorage.removeItem(PENDING_KEY); } catch {}
        }
        this.cloudSavedAt = Date.now();
        this.cloudReachable = true;
        this.cloudError = '';
        this.notifyStateChange();
        return true;
      } else {
        this.cloudReachable = false;
        this.cloudError = result?.error || `HTTP ${resp.status}`;
        this.notifyStateChange();
      }
    } catch (e) {
      if (this.state.cloudRoomId !== roomId) return false;
      this.cloudReachable = false;
      this.cloudError = 'сеть недоступна';
      this.notifyStateChange();
      console.warn('Облачный бекенд недоступен (локальный режим или оффлайн):', e);
    }
    return false;
  }

  async fetchFromCloud(options = {}) {
    const { force = false, apply = true } = options;
    if (!this.state.cloudRoomId) return { found: false, data: null };
    const requestedRoom = this.state.cloudRoomId;
    try {
      const resp = await fetch(`/api/room/${encodeURIComponent(requestedRoom)}`, { signal: AbortSignal.timeout(10000) });
      if (this.state.cloudRoomId !== requestedRoom || !this.isCloudSyncActive) return { found: false, data: null };
      const contentType = resp.headers.get('content-type') || '';
      if (!resp.ok) {
        if (resp.status === 404 && contentType.includes('application/json')) {
          const result = await resp.json();
          this.cloudReachable = result.notFound === true;
          this.cloudCanWrite = result.notFound === true;
          this.cloudError = '';
        } else {
          this.cloudReachable = false;
          this.cloudError = resp.status === 404 ? 'облачный API не найден' : `HTTP ${resp.status}`;
        }
        return { found: false, data: null };
      }

      const cloudState = await resp.json();
      if (!cloudState || !Array.isArray(cloudState.players)) {
        this.cloudReachable = false;
        this.cloudError = cloudState?.error || 'некорректный ответ API';
        return { found: false, data: null };
      }

      this.cloudReachable = true;
      this.cloudCanWrite = true;
      this.cloudError = '';
      const shouldApply = force || (!this.cloudDirty && Number(cloudState.lastUpdated) > Number(this.state.lastUpdated || 0));
      if (apply && shouldApply) {
        const roomId = this.state.cloudRoomId;
        this.state = this.normalizeState({ ...cloudState, cloudRoomId: roomId });
        this.cloudDirty = false;
        localStorage.setItem(SAVE_KEY, JSON.stringify(this.state));
        this.notifyStateChange();
      }
      return { found: true, data: cloudState, applied: Boolean(apply && shouldApply) };
    } catch (e) {
      if (this.state.cloudRoomId !== requestedRoom) return { found: false, data: null };
      this.cloudReachable = false;
      this.cloudError = 'сеть недоступна';
      return { found: false, data: null };
    }
  }

  async connectToCloudRoom(roomId, options = {}) {
    const { join = false } = options;
    const cleanRoom = this.sanitizeRoomId(roomId);
    if (!cleanRoom) return { ok: false, found: false };

    if (!(await this.flushCloudSave())) return { ok: false, found: false, unsaved: true };
    if (this.cloudSaveTimer) clearTimeout(this.cloudSaveTimer);
    const previous = {
      state: deepClone(this.state), active: this.isCloudSyncActive,
      canWrite: this.cloudCanWrite, reachable: this.cloudReachable
    };
    this.cloudCanWrite = false;
    this.cloudDirty = false;

    this.state.cloudRoomId = cleanRoom;
    this.isCloudSyncActive = true;
    this.suppressCloudSave = true;
    const result = await this.fetchFromCloud({ force: join, apply: join });
    this.suppressCloudSave = false;
    if (this.cloudReachable === false || (join && !result.found)) {
      this.state = previous.state;
      this.isCloudSyncActive = previous.active;
      this.cloudCanWrite = previous.canWrite;
      this.cloudReachable = previous.active ? previous.reachable : false;
      this.saveState({ cloud: false, touch: false });
      return { ok: false, found: false, reachable: false };
    }

    if (join) {
      if (!result.found && this.cloudReachable === true) this.queueCloudSave(0);
    } else if (result.found) {
      const loadRemote = window.confirm(
        `Комната «${cleanRoom}» уже существует.\n\nOK — загрузить состояние из облака.\nОтмена — сохранить текущую игру в эту комнату.`
      );
      if (loadRemote) {
        this.state = this.normalizeState({ ...result.data, cloudRoomId: cleanRoom });
        this.cloudDirty = false;
      } else {
        this.queueCloudSave(0);
      }
    } else if (this.cloudReachable === true) {
      this.queueCloudSave(0);
    }

    this.startPolling();
    this.saveState({ cloud: false, touch: false });
    return { ok: true, found: Boolean(result.found), reachable: this.cloudReachable !== false };
  }

  startPolling() {
    if (this.pollingTimer) clearInterval(this.pollingTimer);
    this.pollingTimer = setInterval(async () => {
      if (document.hidden || this.suppressCloudSave) return;
      // Retry pending local changes before accepting a remote snapshot.
      if (this.cloudDirty) {
        if (!this.cloudCanWrite) await this.fetchFromCloud({ apply: false });
        await this.saveToCloud();
      } else {
        await this.fetchFromCloud();
      }
      this.notifyStateChange();
    }, 4000);
  }

  disconnectCloudRoom() {
    this.isCloudSyncActive = false;
    this.state.cloudRoomId = null;
    this.cloudDirty = false;
    this.cloudCanWrite = false;
    this.cloudSavedAt = null;
    try { localStorage.removeItem(PENDING_KEY); } catch {}
    this.cloudReachable = null;
    this.cloudError = '';
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
    if (this.cloudSaveTimer) {
      clearTimeout(this.cloudSaveTimer);
      this.cloudSaveTimer = null;
    }
    this.saveState({ cloud: false });
    this.notifyStateChange();
  }

  getCloudShareUrl() {
    if (!this.state.cloudRoomId) return window.location.href;
    const base = window.location.origin + window.location.pathname;
    return `${base}?room=${encodeURIComponent(this.state.cloudRoomId)}`;
  }

  async flushCloudSave() {
    if (!this.isCloudSyncActive || !this.cloudDirty) return true;
    if (this.cloudSaveTimer) clearTimeout(this.cloudSaveTimer);
    this.cloudSaveTimer = null;
    if (this.cloudSavePromise) await this.cloudSavePromise;
    if (!this.cloudDirty) return true;
    return Boolean(await this.saveToCloud()) && !this.cloudDirty;
  }

  async createCloudSession(title) {
    if (!(await this.flushCloudSave())) return { ok: false, message: 'Текущая сессия ещё не сохранена. Дождитесь сети или скачайте JSON.' };
    const id = crypto.randomUUID();
    const snapshot = deepClone(this.state);
    snapshot.cloudRoomId = id;
    snapshot.sessionTitle = String(title || 'Игра ' + new Date().toLocaleDateString('ru-RU')).trim().slice(0, 120);
    snapshot.lastUpdated = Date.now();
    try {
      const response = await fetch(`/api/room/${id}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'If-None-Match': '*' },
        body: JSON.stringify(snapshot), signal: AbortSignal.timeout(10000)
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || result.error || 'Ошибка сохранения');
      this.disconnectCloudRoom();
      this.state = this.normalizeState(snapshot);
      this.undoStack = [];
      this.isCloudSyncActive = true;
      this.cloudCanWrite = true;
      this.cloudReachable = true;
      this.cloudSavedAt = Date.now();
      this.saveState({ cloud: false, touch: false });
      this.startPolling();
      return { ok: true, id };
    } catch (error) { return { ok: false, message: error.message }; }
  }

  async listCloudSessions() {
    const response = await fetch('/api/sessions', { signal: AbortSignal.timeout(10000) });
    const result = await response.json();
    if (!response.ok || !Array.isArray(result.sessions)) throw new Error(result.message || 'Список сессий недоступен. Проверьте подключение базы D1.');
    return result.sessions;
  }

  // --- SESSION LINKS / CODES ---

  snapshotForSharing() {
    const snapshot = deepClone(this.state);
    snapshot.cloudRoomId = null;
    snapshot.lastUpdated = Date.now();
    snapshot.log = [];
    snapshot.drawnCard = null;
    return snapshot;
  }

  async generateSessionUrl() {
    try {
      const jsonStr = JSON.stringify(this.snapshotForSharing());
      const compressed = await compressToBase64(jsonStr);
      const baseUrl = window.location.href.split('#')[0].split('?')[0];
      if (compressed) {
        return `${baseUrl}#sessionz=${compressed}`;
      }
      return `${baseUrl}#session=${btoa(encodeURIComponent(jsonStr))}`;
    } catch (e) {
      console.error('Ошибка создания ссылки сессии:', e);
      return window.location.href;
    }
  }

  parseImportedState(parsed) {
    if (!parsed || !Array.isArray(parsed.players)) return false;
    if (parsed.players.length > 50) return false;
    this.disconnectCloudRoom();
    this.undoStack = [];
    this.state = this.normalizeState({ ...parsed, cloudRoomId: null });
    this.saveState({ cloud: false, notify: false });
    return true;
  }

  async importSessionFromHash() {
    try {
      const hash = window.location.hash;
      if (!hash) return false;

      if (hash.includes('#sessionz=')) {
        const payload = hash.slice(hash.indexOf('#sessionz=') + '#sessionz='.length);
        if (payload.length > 200000) return false;
        const jsonStr = await decompressFromBase64(payload);
        if (jsonStr.length > 2000000) return false;
        return this.parseImportedState(JSON.parse(jsonStr));
      }

      if (hash.includes('#session=')) {
        const b64 = hash.slice(hash.indexOf('#session=') + '#session='.length);
        if (b64.length > 2000000) return false;
        const jsonStr = decodeURIComponent(atob(b64));
        return this.parseImportedState(JSON.parse(jsonStr));
      }

      return false;
    } catch (e) {
      console.warn('Не удалось прочитать состояние из URL hash:', e);
      return false;
    }
  }

  async exportSessionCode() {
    const jsonStr = JSON.stringify(this.snapshotForSharing());
    const compressed = await compressToBase64(jsonStr);
    return compressed || btoa(encodeURIComponent(jsonStr));
  }

  async importSessionCode(codeStr) {
    try {
      const cleanCode = String(codeStr || '').trim()
        .replace(/^#sessionz=/, '')
        .replace(/^#session=/, '');

      if (codeStr.trim().startsWith('#sessionz=')) {
        const jsonStr = await decompressFromBase64(cleanCode);
        if (jsonStr.length > 2000000) return false;
        return this.parseImportedState(JSON.parse(jsonStr));
      }

      const jsonStr = decodeURIComponent(atob(cleanCode));
      return this.parseImportedState(JSON.parse(jsonStr));
    } catch (e) {
      console.error('Неверный код сессии:', e);
      return false;
    }
  }

  // --- REPORTS ---

  generateTelegramReport(player) {
    const p = player || this.getActivePlayer();
    if (!p) return '';

    const curCell = this.getCell(p.currentCell);
    const lvl = this.levelInfo.find(l => l.level === curCell.level);

    let text = `✨ **ОТЧЕТ ИГРЫ «ИНСАЙТ»** ✨\n`;
    text += `👤 **Игрок:** ${p.name}\n`;
    if (p.birthDate) text += `🎂 **Дата рождения:** ${p.birthDate}\n`;
    if (p.problem) text += `🩹 **Где сейчас проблема:** ${p.problem}\n`;
    if (p.desired) text += `🌟 **Что хочу вместо этого:** ${p.desired}\n`;
    if (p.request) text += `🎯 **Запрос:** ${p.request}\n`;
    if (p.finished) text += `\n🪷 **Инсайт достигнут!** Запрос пришёл к разрешению.\n`;
    if (p.exited) text += `\n🛑 **Выход из игры** на клетке 101 «Одержимость».\n`;
    text += `\n📍 **Текущая позиция:** Клетка ${curCell.id} — «${curCell.boardName}»\n`;
    text += `🌐 **Сфера:** Уровень ${curCell.level} (${lvl ? lvl.name : ''})\n`;
    text += `📜 **Суть:** ${curCell.desc}\n\n`;

    if (curCell.questions && curCell.questions.length > 0) {
      text += `❓ **Вопросы для осознания:**\n`;
      curCell.questions.forEach((q, idx) => {
        text += `${idx + 1}. ${q}\n`;
      });
      text += `\n`;
    }

    if (curCell.action) {
      text += `⚡ **Действие:** ${curCell.action}\n\n`;
    }

    text += `💎 **Ресурсы игрока:**\n`;
    text += `• 🔴 Тело: ${p.resources[1] || 0} (база ${p.baseResources[1] || 0} + ${p.extraResources[1] || 0})\n`;
    text += `• 🟠 Отношения и Деньги: ${p.resources[2] || 0} (база ${p.baseResources[2] || 0} + ${p.extraResources[2] || 0})\n`;
    text += `• 🟡 Части Я / ЭГО: ${p.resources[3] || 0} (база ${p.baseResources[3] || 0} + ${p.extraResources[3] || 0})\n`;
    text += `• 🟢 Чувства и Социум: ${p.resources[4] || 0} (база ${p.baseResources[4] || 0} + ${p.extraResources[4] || 0})\n`;
    text += `• 🔵 Самореализация: ${p.resources[5] || 0} (база ${p.baseResources[5] || 0} + ${p.extraResources[5] || 0})\n`;
    text += `• 🔷 Мышление: ${p.resources[6] || 0} (база ${p.baseResources[6] || 0} + ${p.extraResources[6] || 0})\n\n`;

    if (p.notes.insights) {
      text += `💡 **Инсайты:**\n${p.notes.insights}\n\n`;
    }
    if (p.notes.blocks) {
      text += `🧱 **Блоки:**\n${p.notes.blocks}\n\n`;
    }
    if (p.notes.fears) {
      text += `🌫️ **Страхи и убеждения:**\n${p.notes.fears}\n\n`;
    }

    text += `👣 **Траектория пути (${p.history.length} ходов):**\n${p.history.join(' ➔ ')}`;

    return text;
  }
}

export const game = new InsightGame();
