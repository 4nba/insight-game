import os

game_dir = os.path.dirname(os.path.abspath(__file__))
source_html = os.path.join(game_dir, "index.src.html")
output_html = os.path.join(game_dir, "index.html")
dist_dir = os.path.join(game_dir, "dist")
dist_html = os.path.join(dist_dir, "index.html")


def read(path):
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


game_data_code = read(os.path.join(game_dir, "gameData.js")).replace(
    "export const ", "const "
)

app_code = read(os.path.join(game_dir, "app.js"))
app_code = app_code.replace(
    "import { GAME_CELLS, GAME_DECKS, RESOURCE_DECKS, LEVEL_INFO } from './gameData.js';",
    "",
)
app_code = app_code.replace("export class InsightGame", "class InsightGame")
app_code = app_code.replace("export const game =", "const game =")

ui_code = read(os.path.join(game_dir, "ui.js"))
ui_code = ui_code.replace("import { game } from './app.js';", "")
ui_code = ui_code.replace("import { GAME_CELLS, LEVEL_INFO } from './gameData.js';", "")

css_code = read(os.path.join(game_dir, "style.css"))
tailwind_code = read(os.path.join(game_dir, "tailwind.css"))
html_code = read(source_html)

html_standalone = html_code.replace(
    '<link rel="stylesheet" href="tailwind.css">',
    f"<style>\n{tailwind_code}\n</style>",
)
html_standalone = html_standalone.replace(
    '<link rel="stylesheet" href="style.css">', f"<style>\n{css_code}\n</style>"
)

bundle_script = f"""
<script>
{game_data_code}

{app_code}

{ui_code}
</script>
"""
html_standalone = html_standalone.replace(
    '<script type="module" src="ui.js"></script>', bundle_script
)

with open(output_html, "w", encoding="utf-8", newline="\n") as f:
    f.write(html_standalone)

os.makedirs(dist_dir, exist_ok=True)
with open(dist_html, "w", encoding="utf-8", newline="\n") as f:
    f.write(html_standalone)

print(f"Built {output_html} ({len(html_standalone)} bytes)")
print(f"Built {dist_html} ({len(html_standalone)} bytes)")
