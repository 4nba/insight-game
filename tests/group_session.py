"""Exercise the facilitator's full 20-person session in a real browser."""
from pathlib import Path
from playwright.sync_api import sync_playwright

URL = (Path(__file__).resolve().parents[1] / 'index.html').as_uri()

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1440, 'height': 1000})
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(URL)
    page.wait_for_function("typeof game !== 'undefined' && document.querySelector('.group-player')")
    page.locator('#btnManagePlayers').click()
    page.once('dialog', lambda dialog: dialog.accept('Facilitator test'))
    page.locator('.btn-rename-player').click()
    assert page.evaluate('game.state.players[0].name') == 'Facilitator test'
    page.locator('.group-bulk summary').click()
    page.locator('#inputGroupNames').fill('\n'.join(['Anna'] * 19))
    page.locator('#btnAddGroup').click()
    assert page.locator('.group-player').count() == 20
    assert page.evaluate('new Set(game.state.players.map(p => p.color.hex)).size') == 20
    assert page.locator('.player-token').all_text_contents() == [str(i) for i in range(1, 21)]
    assert page.evaluate("game.addPlayer('Overflow') === null")
    # Bulk addition is one undo operation, without partial additions.
    page.evaluate('game.undo()')
    assert page.evaluate('game.state.players.length') == 1
    page.locator('#inputGroupNames').fill('\n'.join(['Anna'] * 19))
    page.locator('#btnAddGroup').click()
    page.keyboard.press('Escape')
    # Everyone is born in order, then all 20 get a turn before round 2.
    page.evaluate('''() => {
      for (let i = 0; i < 20; i++) game.handleDiceRoll(1);
    }''')
    assert page.evaluate('game.state.players.every(p => p.isBorn) && game.state.gameStarted')
    assert page.evaluate('game.state.activePlayerIndex') == 0
    for index in range(1, 20):
        page.evaluate('game.nextTurn()')
        assert page.evaluate('game.state.activePlayerIndex') == index
    page.evaluate('game.nextTurn()')
    assert page.evaluate('game.state.round') == 2
    page.locator('.group-player').nth(19).click()
    assert page.evaluate('game.state.activePlayerIndex') == 19
    page.evaluate("game.setPlayerNote(game.getActivePlayer().id, 'insights', 'Only player 20')")
    page.reload()
    page.wait_for_function("document.querySelectorAll('.group-player').length === 20")
    assert page.evaluate('game.getActivePlayer().notes.insights') == 'Only player 20'
    assert page.evaluate('game.state.players[0].notes.insights') == ''
    # Completed players are skipped; the last remaining participant keeps playing.
    assert page.evaluate('''() => {
      game.state.players.slice(0, 19).forEach(p => p.finished = true);
      game.nextTurn(); return game.state.activePlayerIndex === 19;
    }''')
    # A compressed snapshot restores the whole group in a separate browser context.
    link = page.evaluate('game.generateSessionUrl()')
    other = browser.new_page()
    other.goto(link)
    other.wait_for_function("document.querySelectorAll('.group-player').length === 20")
    assert other.evaluate('game.state.players[19].notes.insights') == 'Only player 20'
    other.close()
    # Mobile layout keeps the page width within the viewport.
    page.set_viewport_size({'width': 390, 'height': 844})
    assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth')
    # Import detaches an old cloud connection and cannot undo back into a different session.
    assert page.evaluate('''() => {
      game.isCloudSyncActive = true;
      game.state.cloudRoomId = 'old-room';
      game.cloudSaveTimer = setTimeout(() => {}, 10000);
      const state = JSON.parse(JSON.stringify(game.state));
      return game.parseImportedState(state) && !game.isCloudSyncActive
        && game.cloudSaveTimer === null && !game.canUndo();
    }''')
    assert not errors, errors
    browser.close()

print('GROUP OK: 20 participants, bulk add/undo, birth, turns, notes, reload, share, mobile, import isolation')
