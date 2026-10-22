import sys

sys.stdout.reconfigure(encoding="utf-8")
from playwright.sync_api import sync_playwright
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
URL = "file:///" + os.path.join(ROOT, "index.html").replace(os.sep, "/")
failures = []


def check(condition, message):
    if condition:
        print("  OK  " + message)
    else:
        failures.append(message)
        print(" FAIL " + message)


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1600, "height": 1000})
    page.add_init_script("localStorage.clear()")
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(URL)
    page.wait_for_timeout(1000)

    check(page.locator(".game-cell").count() == 104, "поле содержит 104 клетки")
    check(
        "Игра «Инсайт»" in page.title() or "Инсайт" in page.title(),
        "заголовок страницы",
    )

    # 3 players
    page.evaluate("""() => {
        game.state.players = [];
        game.state.activePlayerIndex = 0;
        game.state.gameStarted = false;
        game.addPlayer('Анна');
        game.addPlayer('Борис');
        game.addPlayer('Вера');
        game.saveState();
    }""")
    page.wait_for_timeout(150)
    check(page.evaluate("game.state.players.length") == 3, "добавлены 3 игрока")

    # Birth order: non-1 passes the turn; 1 births
    page.locator(".btn-dice[data-roll='2']").click()
    page.wait_for_timeout(120)
    check(
        page.evaluate("game.getActivePlayer().name") == "Борис",
        "после не-1 ход переходит следующему",
    )
    page.locator(".btn-dice[data-roll='1']").click()
    page.wait_for_timeout(120)
    page.locator(".btn-dice[data-roll='1']").click()
    page.wait_for_timeout(120)
    page.locator(".btn-dice[data-roll='1']").click()
    page.wait_for_timeout(250)
    check(
        page.evaluate("game.state.players.every(p => p.isBorn)"), "все игроки родились"
    )
    check(page.evaluate("game.state.gameStarted"), "игра перешла в фазу ходов")
    check(
        page.evaluate("game.getActivePlayer().name") == "Борис",
        "первым ходит родившийся раньше",
    )
    check(
        page.evaluate("game.state.players.map(p => p.birthOrder)") == [3, 1, 2],
        "порядок рождения сохранён",
    )

    # Resources: earned first, base last
    page.evaluate("game.changeResource(1, 1)")
    check(
        "2 (1+1)" in page.locator("#resVal1").text_content(),
        "ресурс показан как всего (база+заработано)",
    )
    page.locator("#inputManualCell").fill("6")
    page.locator("#btnManualJump").click()
    page.wait_for_timeout(200)
    check(
        page.evaluate("game.getActivePlayer().extraResources[1]") == 0,
        "крест списал заработанный ресурс",
    )
    check(
        page.evaluate("game.getActivePlayer().resources[1]") == 1,
        "базовый ресурс сохранён",
    )
    page.locator("#btnUndo").click()
    page.wait_for_timeout(150)
    check(
        page.evaluate("game.getActivePlayer().currentCell") == 1,
        "undo вернул позицию до перехода",
    )

    # Deck tabs and draw
    page.locator(".game-cell[data-id='3']").click()
    page.wait_for_timeout(120)
    page.locator("#cellActionButtons button:has-text('Вытянуть карту')").click()
    page.wait_for_timeout(200)
    check(page.locator("#modalDecks").is_visible(), "модальное окно колоды открылось")
    check(
        page.locator("#deckTabs .btn-deck-tab").count() == 7,
        "показаны 7 цифровых колод",
    )
    page.locator("#deckTabs .btn-deck-tab[data-deck='Страх']").click()
    page.wait_for_timeout(80)
    page.locator("#deckNumberPicker .num-btn[data-number='5']").click()
    page.locator("#btnShowCardByNumber").click()
    page.wait_for_timeout(120)
    check(
        "№5" in page.locator("#deckSelectedCardTitle").text_content(),
        "карта открывается по названному номеру",
    )
    check(
        "line-through" in (page.locator("#deckNumberPicker .num-btn[data-number='5']").get_attribute("class") or ""),
        "взятая карта помечена в номерной панели",
    )
    drawn_title = page.locator("#deckSelectedCardTitle").text_content()
    page.locator("#btnSaveCardToInsights").click()
    page.wait_for_timeout(120)
    check(
        "№5" in page.evaluate("game.getActivePlayer().notes.insights"),
        "вытянутая карта сохраняется в инсайты",
    )
    page.keyboard.press("Escape")
    page.wait_for_timeout(120)
    check(not page.locator("#modalDecks").is_visible(), "колода закрывается по Esc")

    # Resource by number + add resource
    page.locator(".game-cell[data-id='7']").click()
    page.wait_for_timeout(120)
    page.locator("#cellActionButtons button:has-text('Взять карту ресурса')").click()
    page.wait_for_timeout(200)
    check(page.locator("#modalNotice").is_visible(), "карта ресурса открылась")
    check(
        "ресурса" in page.locator("#noticeTitle").text_content(),
        "заголовок карты ресурса",
    )
    page.locator("#noticeBody .num-btn[data-number='6']").click()
    page.wait_for_timeout(80)
    check(
        "Энергия" in page.locator("#noticeBody").text_content(),
        "красный ресурс №6 — «Энергия»",
    )
    resource_before = page.evaluate("game.getActivePlayer().resources[1]")
    page.locator("#noticeActions button:has-text('Получить ресурс')").click()
    page.wait_for_timeout(150)
    check(
        page.evaluate("game.getActivePlayer().resources[1]") == resource_before + 1,
        "карта ресурса добавляет ресурс игроку",
    )

    # Vector card
    page.locator(".game-cell[data-id='23']").click()
    page.wait_for_timeout(120)
    page.locator("#cellActionButtons button:has-text('карту-вектор')").click()
    page.wait_for_timeout(200)
    check(page.locator("#modalNotice").is_visible(), "окно карты-вектора открылось")
    page.locator("#noticeBody input[type=number]").fill("53")
    page.locator("#noticeActions button:has-text('Перейти по карте')").click()
    page.wait_for_timeout(200)
    check(
        page.evaluate("game.getActivePlayer().currentCell") == 53,
        "переход по карте-вектору выполнен",
    )

    # Finish
    page.locator("#inputManualCell").fill("98")
    page.locator("#btnManualJump").click()
    page.wait_for_timeout(200)
    check(page.locator("#endAlertBox").is_visible(), "баннер финиша показан")
    check(
        page.locator(".btn-dice[data-roll='1']").is_disabled(),
        "кубик заблокирован после финиша",
    )
    check(
        "Финиш" in page.locator("#playerStatusBadge").text_content(),
        "статус игрока — финиш",
    )

    # Dossier and print
    page.locator("#btnPlayerDossier").click()
    page.wait_for_timeout(250)
    check(page.locator("#printTableBody tr").count() == 6, "в карте 6 уровней")
    check(
        page.locator("#levelNotesEditor textarea").count() == 12,
        "12 полей заметок по уровням",
    )
    page.locator("#levelNotesEditor textarea").first.fill("Тестовый блок")
    page.wait_for_timeout(120)
    check(
        "Тестовый блок" in page.locator("#dossierBlocks1").text_content(),
        "заметка попадает в печатную таблицу",
    )
    page.locator("#inputDossierBirthDate").fill("01.02.1990")
    page.wait_for_timeout(80)
    check(
        "01.02.1990" in page.locator("#printBirthDate").text_content(),
        "дата рождения печатается",
    )
    page.locator("#inputDossierProblem").fill("Проблема с деньгами")
    page.locator("#inputDossierDesired").fill("Стабильный доход")
    page.wait_for_timeout(80)
    check(
        "Проблема с деньгами" in page.locator("#printPlayerProblem").text_content(),
        "проблема печатается в карте",
    )
    check(
        "Стабильный доход" in page.locator("#printPlayerDesired").text_content(),
        "желание печатается в карте",
    )
    page.emulate_media(media="print")
    page.wait_for_timeout(80)
    check(
        page.locator("header").evaluate("el => getComputedStyle(el).display") == "none",
        "в печати скрыт интерфейс",
    )
    check(
        page.locator("#modalDossier").evaluate("el => getComputedStyle(el).display")
        == "block",
        "в печати видна карта игрока",
    )
    page.emulate_media(media="screen")
    page.locator("#modalDossier .modal-close").click()

    # Compressed session link
    url = page.evaluate("game.generateSessionUrl()")
    check("#sessionz=" in url, "ссылка сессии использует сжатый формат")
    check(len(url) < 4000, f"ссылка сессии короче 4000 символов (сейчас {len(url)})")
    page2 = browser.new_page()
    page2.goto(url)
    page2.wait_for_timeout(900)
    check(
        page2.evaluate("game.state.players.length") == 3,
        "состояние из ссылки восстановлено",
    )
    check(
        page2.evaluate("game.state.players[0].notes.insights") == "",
        "пустые поля восстановлены без ошибок",
    )
    page2.close()

    # XSS
    page.evaluate("game.state.players[0].name = '<img src=x onerror=window.__xss=1>'")
    page.locator("#btnManagePlayers").click()
    page.wait_for_timeout(200)
    check(
        page.evaluate("window.__xss || 0") == 0,
        "имя игрока экранируется (XSS не исполняется)",
    )
    page.keyboard.press("Escape")

    # Cloud without a backend must be shown as offline, not as working sync
    page.locator("#btnSyncModal").click()
    page.wait_for_timeout(120)
    page.locator("#inputCloudRoomName").fill("offline-test")
    page.locator("#btnConnectCloudRoom").click()
    page.wait_for_timeout(1200)
    check(
        page.evaluate("game.cloudReachable") is False,
        "без облачного API комната помечается как офлайн",
    )
    check(
        "офлайн" in page.locator("#cloudStatusBadge").text_content(),
        "бейдж облака показывает офлайн",
    )
    page.locator("#btnDisconnectCloud").click()
    page.wait_for_timeout(120)

    check(len(errors) == 0, f"нет JS-ошибок (найдено {len(errors)})")
    if errors:
        print(errors)

    browser.close()

if failures:
    print("\nПРОВАЛЕНО:")
    for f in failures:
        print(" - " + f)
    sys.exit(1)

print("\nUI SMOKE OK")
