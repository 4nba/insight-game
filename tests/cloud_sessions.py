"""End-to-end saved sessions against the actual Worker handler and SQLite."""
from pathlib import Path
import subprocess
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
server = subprocess.Popen(['node', 'tests/worker_fixture.mjs', '--serve'], cwd=ROOT,
                          stdout=subprocess.PIPE, text=True)
try:
    url = server.stdout.readline().strip()
    assert url.startswith('http://127.0.0.1:'), url
    with sync_playwright() as p:
        browser = p.chromium.launch()
        context = browser.new_context()
        page = context.new_page()
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto(url)
        page.locator('#btnSyncModal').click()
        page.locator('#inputSessionTitle').fill('First session')
        page.locator('#btnSaveNewSession').click()
        page.wait_for_function("game.state.sessionTitle === 'First session' && game.isCloudSyncActive")
        first = page.evaluate('game.state.cloudRoomId')
        assert '?room=' in page.url
        page.keyboard.press('Escape')
        page.locator('#textareaPlayerInsights').fill('Only first session')
        page.wait_for_function('!game.cloudDirty')
        page.reload()
        page.wait_for_function("game.getActivePlayer()?.notes.insights === 'Only first session'")
        # Reopening the bare website on the same device resumes the connected session.
        page.goto(url)
        page.wait_for_function("game.getActivePlayer()?.notes.insights === 'Only first session'")
        # Copy to another named session, then change the copy.
        page.locator('#btnSyncModal').click()
        page.locator('#inputSessionTitle').fill('Second session')
        page.locator('#btnSaveNewSession').click()
        page.wait_for_function("game.state.sessionTitle === 'Second session'")
        second = page.evaluate('game.state.cloudRoomId')
        assert first != second
        page.keyboard.press('Escape')
        page.locator('#textareaPlayerInsights').fill('Only second session')
        page.wait_for_function('!game.cloudDirty')
        assert page.request.get(url + '/api/room/' + first).json()['players'][0]['notes']['insights'] == 'Only first session'
        # A new device lists and loads the saved game without local state.
        other_context = browser.new_context()
        other = other_context.new_page()
        other.goto(url)
        other.locator('#btnSyncModal').click()
        other.wait_for_function("document.querySelectorAll('.cloud-session').length === 2")
        other.once('dialog', lambda d: d.accept())
        other.locator('.cloud-session').filter(has_text='First session').get_by_role('button').click()
        other.wait_for_function("game.getActivePlayer()?.notes.insights === 'Only first session'")
        other_context.close()
        # Network loss + reload must retain pending notes locally, then retry to the database.
        context.route('**/api/**', lambda route: route.fulfill(status=503, body='unavailable'))
        page.locator('#textareaPlayerInsights').fill('Pending offline note')
        page.wait_for_timeout(900)
        assert page.evaluate('game.cloudDirty')
        page.reload()
        page.wait_for_function("game.getActivePlayer()?.notes.insights === 'Pending offline note'")
        assert page.evaluate('game.cloudDirty')
        context.unroute('**/api/**')
        page.wait_for_function('!game.cloudDirty && game.cloudReachable', timeout=12000)
        assert page.request.get(url + '/api/room/' + second).json()['players'][0]['notes']['insights'] == 'Pending offline note'
        assert not errors, errors
        browser.close()
    print('CLOUD SESSIONS OK: save/list/load, new device, auto-resume, isolated copies, offline reload and retry')
finally:
    server.terminate()
    server.wait(timeout=10)
