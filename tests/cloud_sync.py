import sys

sys.stdout.reconfigure(encoding="utf-8")
from playwright.sync_api import sync_playwright
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
import threading, json, os, time

ROOT = os.path.abspath(".")
PORT = 8765


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def log_message(self, *args):
        pass


server = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
threading.Thread(target=server.serve_forever, daemon=True).start()

remote_state = {
    "players": [
        {
            "id": "p1",
            "name": "Облачная Анна",
            "request": "Облачный запрос",
            "birthDate": "",
            "currentCell": 33,
            "isBorn": True,
            "finished": False,
            "exited": False,
            "history": [98, 1, 33],
            "cellVisits": {"98": 1, "1": 1, "33": 1},
            "resources": {"1": 1, "2": 1, "3": 1, "4": 1, "5": 1, "6": 1},
            "notes": {
                "resources": "",
                "blocks": "",
                "fears": "",
                "insights": "Из облака",
            },
            "levelNotes": {},
        }
    ],
    "activePlayerIndex": 0,
    "round": 2,
    "selectedCellId": 33,
    "log": [],
    "cloudRoomId": "room1",
    "lastUpdated": int(time.time() * 1000) - 5000,
    "gameStarted": True,
    "deckRemaining": {},
    "autoSymbols": True,
}

posted = []

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1400, "height": 900})
    page.add_init_script("localStorage.clear()")

    def handle(route):
        if route.request.method == "GET":
            route.fulfill(
                status=200,
                content_type="application/json",
                body=json.dumps(remote_state),
            )
        else:
            posted.append(route.request.post_data)
            route.fulfill(
                status=200,
                content_type="application/json",
                body=json.dumps({"success": True}),
            )

    page.route("**/api/room/**", handle)
    page.goto(f"http://127.0.0.1:{PORT}/index.html?room=room1")
    page.wait_for_timeout(1800)
    print("loaded player:", page.locator("#activePlayerName").text_content())
    print("loaded cell:", page.locator("#activePlayerCellBadge").text_content())
    print("posted during join:", len(posted))
    assert page.evaluate("game.cloudReachable") is True
    assert "Облачная Анна" in page.locator("#activePlayerName").text_content()
    assert len(posted) == 0

    # Make a change and wait for debounced cloud save
    page.locator("#btnGiveBase6").click()
    page.wait_for_timeout(1200)
    print("posted after change:", len(posted))
    assert len(posted) == 1
    if posted:
        body = json.loads(posted[-1])
        print("posted player:", body["players"][0]["name"])
        assert body['players'][0]['resources']['6'] == page.evaluate('game.state.players[0].resources[6]')

    # Reload with remote newer: GET returns the newest remote state; polling should apply it
    remote_state["players"][0]["currentCell"] = 46
    remote_state["selectedCellId"] = 46
    remote_state["lastUpdated"] = int(time.time() * 1000) + 10000
    page.evaluate("game.cloudDirty = false")
    page.wait_for_timeout(4500)
    print("polled cell:", page.locator("#activePlayerCellBadge").text_content())
    assert page.evaluate('game.getActivePlayer().currentCell') == 46

    # A JSON error delivered with HTTP 200 is not a successful save.
    page.unroute('**/api/room/**')
    page.route('**/api/room/**', lambda route: route.fulfill(
        status=200, content_type='application/json', body='{"error":"KV_NOT_BOUND"}'))
    page.evaluate('game.cloudDirty = true; game.saveToCloud()')
    assert page.evaluate('game.cloudReachable') is False
    assert page.evaluate('game.cloudDirty') is True

    # An unsuccessful join must never POST a default state into an unread room.
    page.unroute('**/api/room/**')
    failed_posts = []
    def unavailable(route):
        if route.request.method == 'POST':
            failed_posts.append(True)
        route.fulfill(status=503, content_type='application/json', body='{"error":"UNAVAILABLE"}')
    page.route('**/api/room/**', unavailable)
    page.goto(f'http://127.0.0.1:{PORT}/index.html?room=unavailable')
    page.wait_for_timeout(1000)
    assert not failed_posts

    browser.close()

server.shutdown()
print("CLOUD OK")
