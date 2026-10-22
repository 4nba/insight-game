import assert from 'node:assert/strict';
import { GAME_CELLS, GAME_DECKS, RESOURCE_DECKS, LEVEL_INFO } from '../gameData.js';

const byId = new Map(GAME_CELLS.map(c => [c.id, c]));
const failures = [];

function check(condition, message) {
  if (!condition) failures.push(message);
}

check(GAME_CELLS.length === 104, `Ожидалось 104 клетки, найдено ${GAME_CELLS.length}`);
check(byId.size === 104, 'ID клеток должны быть уникальными');

for (let id = 1; id <= 104; id++) {
  check(byId.has(id), `Нет клетки ${id}`);
}

const ranges = [
  [1, 13, 1, 'Тело'],
  [14, 39, 2, 'Отношения и Деньги'],
  [40, 52, 3, 'Части Я / ЭГО'],
  [53, 78, 4, 'Чувства и Социум'],
  [79, 91, 5, 'Самореализация / Работа'],
  [92, 104, 6, 'Интеллект и Мышление']
];

for (const [from, to, level, name] of ranges) {
  for (let id = from; id <= to; id++) {
    const cell = byId.get(id);
    check(cell?.level === level, `Клетка ${id} должна быть уровня ${level} (${name})`);
    check(Boolean(cell?.levelName), `Клетка ${id}: пустое имя уровня`);
  }
}

const required = {
  1: 'start',
  6: 'loss',
  8: 'card',
  9: 'loss',
  42: 'vector',
  49: 'resource',
  50: 'card',
  98: 'finish',
  101: 'exit'
};

for (const [id, type] of Object.entries(required)) {
  check(byId.get(Number(id))?.type === type, `Клетка ${id} должна иметь тип ${type}, сейчас ${byId.get(Number(id))?.type}`);
}

for (const cell of GAME_CELLS) {
  if (cell.vectorTarget !== undefined) {
    check(Number.isInteger(cell.vectorTarget) && cell.vectorTarget >= 1 && cell.vectorTarget <= 104, `Клетка ${cell.id}: неверная цель стрелки ${cell.vectorTarget}`);
    check(cell.vectorTarget !== cell.id, `Клетка ${cell.id}: стрелка ведёт на себя`);
  }
  if (cell.vectorChoices !== undefined) {
    check(Array.isArray(cell.vectorChoices) && cell.vectorChoices.every(t => Number.isInteger(t) && t >= 1 && t <= 104), `Клетка ${cell.id}: неверные варианты перехода`);
    check(cell.vectorChoices.includes(cell.vectorTarget), `Клетка ${cell.id}: вариант по умолчанию должен входить в vectorChoices`);
  }
  if (cell.deck) {
    check(typeof cell.deck === 'string' && cell.deck.trim().length > 0, `Клетка ${cell.id}: пустое имя колоды`);
    check(Boolean(GAME_DECKS[cell.deck]?.length), `Клетка ${cell.id}: колода «${cell.deck}» не найдена`);
  }
  check(Array.isArray(cell.questions) && cell.questions.length > 0, `Клетка ${cell.id}: нет вопросов`);
  check(Boolean(cell.desc && cell.desc.trim()), `Клетка ${cell.id}: нет описания`);
}

const levelIds = new Set(LEVEL_INFO.map(l => l.level));
check(levelIds.size === 6, 'LEVEL_INFO должен содержать 6 уровней');

const deckNames = Object.keys(GAME_DECKS);
check(deckNames.length >= 5, 'Должно быть минимум 5 цифровых колод');
for (const name of deckNames) {
  const deck = GAME_DECKS[name];
  check(Array.isArray(deck) && deck.length > 0, `Колода «${name}» пуста`);
  deck.forEach((card, i) => {
    check(Boolean(card.title && card.text), `Колода «${name}», карта ${i + 1}: нет title/text`);
  });
}

const expectedDeckSizes = {
  'Вторичные выгоды': 32,
  'Страх': 48,
  'Зависимости': 34,
  'Деньги': 36,
  'Убеждения': 33,
  'Одиночество': 49
};

for (const [name, size] of Object.entries(expectedDeckSizes)) {
  check(GAME_DECKS[name]?.length === size, `Колода «${name}»: ожидалось ${size} карт, сейчас ${GAME_DECKS[name]?.length || 0}`);
}

const expectedResourceSizes = { 1: 18, 2: 30, 3: 19, 4: 15, 5: 21, 6: 19 };
for (let level = 1; level <= 6; level++) {
  const deck = RESOURCE_DECKS[level];
  check(Array.isArray(deck) && deck.length === expectedResourceSizes[level], `Колода ресурсов ${level} уровня: ожидалось ${expectedResourceSizes[level]} слов`);
  check(Array.isArray(deck) && deck.every(word => typeof word === 'string' && word.trim()), `Колода ресурсов ${level} уровня содержит пустые слова`);
}

for (const [name, deck] of Object.entries(GAME_DECKS)) {
  deck.forEach((card, idx) => {
    check(card.number === idx + 1, `Колода «${name}»: у карты №${idx + 1} неверный number (${card.number})`);
  });
}

check(RESOURCE_DECKS[1][5] === 'Энергия', 'Красный ресурс №6 должен быть «Энергия»');
check(RESOURCE_DECKS[2][0] === 'Опора', 'Оранжевый ресурс №1 должен быть «Опора»');

check(byId.get(90)?.vectorChoices?.length === 4, 'Клетка 90 должна предлагать 4 варианта перехода');
check(byId.get(99)?.vectorTarget === 43 && byId.get(99)?.deck, 'Клетка 99 должна содержать карту и стрелку на 43');

if (failures.length) {
  console.error('ОШИБКИ ДАННЫХ:');
  failures.forEach(f => console.error(' - ' + f));
  process.exit(1);
}

console.log(`OK: ${GAME_CELLS.length} клеток, 6 уровней, ${deckNames.length} колод (${Object.values(GAME_DECKS).reduce((n, d) => n + d.length, 0)} карт), 6 колод ресурсов, ${GAME_CELLS.filter(c => c.vectorTarget).length} стрелок.`);
