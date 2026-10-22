import { GAME_CELLS, GAME_DECKS, LEVEL_INFO } from './gameData.js';

// Game State Management
class InsightGame {
  constructor() {
    this.cells = GAME_CELLS;
    this.decks = GAME_DECKS;
    this.levelInfo = LEVEL_INFO;

    this.defaultPlayerColors = [
      { name: 'Фиолетовый', hex: '#8B5CF6', bg: 'bg-purple-600', ring: 'ring-purple-400' },
      { name: 'Изумрудный', hex: '#10B981', bg: 'bg-emerald-600', ring: 'ring-emerald-400' },
      { name: 'Янтарный', hex: '#F59E0B', bg: 'bg-amber-600', ring: 'ring-amber-400' },
      { name: 'Рубиновый', hex: '#EF4444', bg: 'bg-rose-600', ring: 'ring-rose-400' },
      { name: 'Лазурный', hex: '#06B6D4', bg: 'bg-cyan-600', ring: 'ring-cyan-400' },
      { name: 'Индиго', hex: '#3B82F6', bg: 'bg-blue-600', ring: 'ring-blue-400' }
    ];

    this.state = {
      players: [],
      activePlayerIndex: 0,
      round: 1,
      selectedCellId: 1,
      drawnCard: null,
      filterLevel: 'all',
      log: [],
      cloudRoomId: null,
      lastUpdated: Date.now()
    };

    this.isCloudSyncActive = false;
    this.pollingTimer = null;
    this.onStateChangedCallbacks = [];

    this.init();
  }

  init() {
    // 1. Проверяем URL параметры на наличие ?room=...
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room');

    // 2. Проверяем URL Hash на #session=...
    const hashImported = this.importSessionFromHash();

    if (roomParam) {
      this.state.cloudRoomId = roomParam;
      this.connectToCloudRoom(roomParam);
    } else if (!hashImported) {
      this.loadState();
    }

    if (this.state.players.length === 0) {
      this.addPlayer('Игрок 1', 'Что мне мешает проявиться и выйти на новый доход?');
    }
  }

  onStateChange(cb) {
    this.onStateChangedCallbacks.push(cb);
  }

  notifyStateChange() {
    this.onStateChangedCallbacks.forEach(cb => {
      try { cb(); } catch (e) { console.error(e); }
    });
  }

  saveState() {
    this.state.lastUpdated = Date.now();
    try {
      localStorage.setItem('insight_game_save_v1', jsonStringifySafe(this.state));
    } catch (e) {
      console.error('Ошибка сохранения:', e);
    }

    // Если подключена облачная комната, сохраняем в облако
    if (this.state.cloudRoomId && this.isCloudSyncActive) {
      this.saveToCloud();
    }

    this.notifyStateChange();
  }

  loadState() {
    try {
      const saved = localStorage.getItem('insight_game_save_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.players && Array.isArray(parsed.players)) {
          this.state = { ...this.state, ...parsed };
        }
      }
    } catch (e) {
      console.warn('Не удалось загрузить сохраненную игру:', e);
    }
  }

  resetGame() {
    this.state.players.forEach(p => {
      p.currentCell = 98;
      p.isBorn = false;
      p.history = [98];
      p.cellVisits = { 98: 1 };
      p.resources = { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1 };
      p.notes = { resources: '', blocks: '', fears: '', insights: '' };
    });
    this.state.round = 1;
    this.state.activePlayerIndex = 0;
    this.state.selectedCellId = 98;
    this.state.log = [];
    this.saveState();
  }

  addPlayer(name, request = '') {
    const id = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    const colorIndex = this.state.players.length % this.defaultPlayerColors.length;
    const color = this.defaultPlayerColors[colorIndex];

    const newPlayer = {
      id,
      name: name || `Игрок ${this.state.players.length + 1}`,
      request: request || '',
      birthDate: '',
      color: color,
      currentCell: 98,
      isBorn: false,
      history: [98],
      cellVisits: { 98: 1 },
      resources: { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1 },
      notes: {
        resources: '',
        blocks: '',
        fears: '',
        insights: ''
      }
    };

    this.state.players.push(newPlayer);
    this.saveState();
    return newPlayer;
  }

  removePlayer(playerId) {
    if (this.state.players.length <= 1) return;
    this.state.players = this.state.players.filter(p => p.id !== playerId);
    if (this.state.activePlayerIndex >= this.state.players.length) {
      this.state.activePlayerIndex = 0;
    }
    this.saveState();
  }

  getActivePlayer() {
    if (this.state.players.length === 0) return null;
    return this.state.players[this.state.activePlayerIndex] || this.state.players[0];
  }

  nextTurn() {
    if (this.state.players.length <= 1) return;
    this.state.activePlayerIndex = (this.state.activePlayerIndex + 1) % this.state.players.length;
    if (this.state.activePlayerIndex === 0) {
      this.state.round++;
    }
    const current = this.getActivePlayer();
    if (current) {
      this.state.selectedCellId = current.currentCell;
    }
    this.saveState();
  }

  handleDiceRoll(roll) {
    const player = this.getActivePlayer();
    if (!player) return null;

    let targetCell = player.currentCell;
    let message = '';

    if (!player.isBorn) {
      if (roll === 1) {
        player.isBorn = true;
        targetCell = 1;
        message = `🎉 УРА! Выпала единица! Игрок ${player.name} родился и перемещается на клетку 1 «Рождение»!`;
      } else {
        message = `🎲 Выпало ${roll}. Игрок ${player.name} ждет единицу на кубике для Рождения (клетка 98).`;
        this.saveState();
        return {
          player,
          roll,
          fromCell: player.currentCell,
          toCell: player.currentCell,
          message,
          isBlockTriggered: false
        };
      }
    } else {
      targetCell = player.currentCell + roll;
      if (targetCell > 104) {
        targetCell = 104;
      }
      message = `🎲 Игрок ${player.name}: бросок [${roll}] ➔ перемещение с клетки ${player.currentCell} на клетку ${targetCell}.`;
    }

    return this.moveToCell(player, targetCell, message);
  }

  moveToCell(player, targetCell, customMessage = '') {
    if (targetCell < 1) targetCell = 1;
    if (targetCell > 104) targetCell = 104;

    const fromCell = player.currentCell;
    player.currentCell = targetCell;
    player.history.push(targetCell);

    player.cellVisits[targetCell] = (player.cellVisits[targetCell] || 0) + 1;
    const visits = player.cellVisits[targetCell];

    let isBlockTriggered = false;
    let blockWarning = '';
    if (visits >= 3) {
      isBlockTriggered = true;
      blockWarning = `⚠️ ВНИМАНИЕ! Игрок ${player.name} встал на клетку ${targetCell} уже ${visits}-й раз! По правилам игры это БЛОК! Требуется глубокая проработка темы.`;
      const cellData = this.getCell(targetCell);
      const blockNote = `[Блок 3 визита]: Клетка ${targetCell} (${cellData.boardName})`;
      if (!player.notes.blocks.includes(blockNote)) {
        player.notes.blocks = player.notes.blocks ? `${player.notes.blocks}\n${blockNote}` : blockNote;
      }
    }

    this.state.selectedCellId = targetCell;

    const cellData = this.getCell(targetCell);
    const logEntry = {
      timestamp: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
      playerName: player.name,
      fromCell,
      toCell: targetCell,
      cellName: cellData.boardName,
      level: cellData.level,
      message: customMessage || `Переход на клетку ${targetCell} (${cellData.boardName})`,
      blockWarning
    };
    this.state.log.unshift(logEntry);
    if (this.state.log.length > 50) this.state.log.pop();

    this.saveState();

    return {
      player,
      fromCell,
      toCell: targetCell,
      cell: cellData,
      visits,
      isBlockTriggered,
      blockWarning,
      message: customMessage
    };
  }

  changeResource(level, delta) {
    const player = this.getActivePlayer();
    if (!player) return;
    const cur = player.resources[level] || 0;
    const next = Math.max(0, cur + delta);
    player.resources[level] = next;
    this.saveState();
  }

  giveAllBaseResources(player) {
    player.resources = { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1 };
    this.saveState();
  }

  getCell(id) {
    return this.cells.find(c => c.id === id) || this.cells[0];
  }

  drawCardFromDeck(deckName) {
    const deck = this.decks[deckName];
    if (!deck || deck.length === 0) return null;
    const randomIndex = Math.floor(Math.random() * deck.length);
    const card = { ...deck[randomIndex], deckName };
    this.state.drawnCard = card;
    this.saveState();
    return card;
  }

  // --- ОБЛАЧНАЯ СИНХРОНИЗАЦИЯ (CLOUDFLARE KV REALTIME) ---

  async connectToCloudRoom(roomId) {
    if (!roomId) return;
    this.state.cloudRoomId = roomId.trim();
    this.isCloudSyncActive = true;

    // Сначала пробуем скачать актуальное состояние комнаты
    await this.fetchFromCloud();

    // Запускаем легкий опрос каждые 4 секунды
    if (this.pollingTimer) clearInterval(this.pollingTimer);
    this.pollingTimer = setInterval(() => {
      this.fetchFromCloud();
    }, 4000);

    this.notifyStateChange();
  }

  disconnectCloudRoom() {
    this.isCloudSyncActive = false;
    this.state.cloudRoomId = null;
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
    this.saveState();
    this.notifyStateChange();
  }

  async saveToCloud() {
    if (!this.state.cloudRoomId) return;
    try {
      const resp = await fetch(`/api/room/${encodeURIComponent(this.state.cloudRoomId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.state)
      });
      if (resp.ok) {
        console.log('Успешно синхронизировано с облаком:', this.state.cloudRoomId);
      }
    } catch (e) {
      console.warn('Облачный бекенд недоступен (локальный режим или оффлайн):', e);
    }
  }

  async fetchFromCloud() {
    if (!this.state.cloudRoomId || !this.isCloudSyncActive) return;
    try {
      const resp = await fetch(`/api/room/${encodeURIComponent(this.state.cloudRoomId)}`);
      if (resp.ok) {
        const cloudState = await resp.json();
        // Если в облаке версия новее нашей, обновляем локальное состояние
        if (cloudState && cloudState.players && cloudState.lastUpdated > (this.state.lastUpdated || 0)) {
          this.state = { ...this.state, ...cloudState };
          localStorage.setItem('insight_game_save_v1', jsonStringifySafe(this.state));
          this.notifyStateChange();
        }
      }
    } catch (e) {
      // Игнорируем сетевые ошибки поллинга
    }
  }

  getCloudShareUrl() {
    if (!this.state.cloudRoomId) return window.location.href;
    const base = window.location.origin + window.location.pathname;
    return `${base}?room=${encodeURIComponent(this.state.cloudRoomId)}`;
  }

  // --- СИНХРОНИЗАЦИЯ ЧЕРЕЗ URL ХЕШ И КОДЫ ---

  generateSessionUrl() {
    try {
      const jsonStr = JSON.stringify(this.state);
      const b64 = btoa(encodeURIComponent(jsonStr));
      const baseUrl = window.location.href.split('#')[0].split('?')[0];
      return `${baseUrl}#session=${b64}`;
    } catch (e) {
      console.error('Ошибка создания ссылки сессии:', e);
      return window.location.href;
    }
  }

  importSessionFromHash() {
    try {
      const hash = window.location.hash;
      if (hash && hash.includes('#session=')) {
        const b64 = hash.replace('#session=', '');
        const jsonStr = decodeURIComponent(atob(b64));
        const parsed = JSON.parse(jsonStr);
        if (parsed.players && Array.isArray(parsed.players)) {
          this.state = parsed;
          this.saveState();
          return true;
        }
      }
    } catch (e) {
      console.warn('Не удалось прочитать состояние из URL hash:', e);
    }
    return false;
  }

  exportSessionCode() {
    const jsonStr = JSON.stringify(this.state);
    return btoa(encodeURIComponent(jsonStr));
  }

  importSessionCode(codeStr) {
    try {
      const cleanCode = codeStr.trim().replace(/^#session=/, '');
      const jsonStr = decodeURIComponent(atob(cleanCode));
      const parsed = JSON.parse(jsonStr);
      if (parsed.players && Array.isArray(parsed.players)) {
        this.state = parsed;
        this.saveState();
        return true;
      }
    } catch (e) {
      console.error('Неверный код сессии:', e);
      return false;
    }
    return false;
  }

  generateTelegramReport(player) {
    const p = player || this.getActivePlayer();
    if (!p) return '';

    const curCell = this.getCell(p.currentCell);
    const lvl = this.levelInfo.find(l => l.level === curCell.level);

    let text = `✨ **ОТЧЕТ ИГРЫ «ИНСАЙТ»** ✨\n`;
    text += `👤 **Игрок:** ${p.name}\n`;
    if (p.request) text += `🎯 **Запрос:** ${p.request}\n`;
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
    text += `• 🔴 Тело: ${p.resources[1] || 0}\n`;
    text += `• 🟠 Отношения и Деньги: ${p.resources[2] || 0}\n`;
    text += `• 🟡 Части Я / ЭГО: ${p.resources[3] || 0}\n`;
    text += `• 🟢 Чувства и Социум: ${p.resources[4] || 0}\n`;
    text += `• 🔵 Самореализация: ${p.resources[5] || 0}\n`;
    text += `• 🔷 Мышление: ${p.resources[6] || 0}\n\n`;

    if (p.notes.insights) {
      text += `💡 **Инсайты:**\n${p.notes.insights}\n\n`;
    }
    if (p.notes.blocks) {
      text += `🧱 **Блоки:**\n${p.notes.blocks}\n\n`;
    }

    text += `👣 **Траектория пути (${p.history.length} ходов):**\n${p.history.join(' ➔ ')}`;

    return text;
  }
}

function jsonStringifySafe(obj) {
  return JSON.stringify(obj, null, 2);
}

export const game = new InsightGame();
