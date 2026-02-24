from playwright.sync_api import sync_playwright
from pathlib import Path
import json
import time


OUT_DIR = Path("upload/im-e2e")
OUT_DIR.mkdir(parents=True, exist_ok=True)


def shot(page, name: str):
    page.screenshot(path=str(OUT_DIR / f"{name}.png"), full_page=True)


def visible_texts(page):
    texts = page.locator("body *").all_inner_texts()
    cleaned = []
    for t in texts:
        if t is None:
            continue
        s = " ".join(t.split())
        if s and s not in cleaned and len(s) <= 200:
            cleaned.append(s)
    return cleaned[:120]


def dump_state(page, name: str):
    data = {
        "url": page.url,
        "title": page.title(),
        "texts": visible_texts(page),
        "buttons": page.locator("button").all_inner_texts(),
        "inputs": page.locator("input, textarea, [contenteditable=true]").count(),
    }
    (OUT_DIR / f"{name}.json").write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def try_click_by_text(page, labels):
    for label in labels:
        loc = page.get_by_text(label, exact=False)
        if loc.count() > 0:
            try:
                loc.first.click(timeout=1500)
                return label
            except Exception:
                pass
    return None


def main():
    report = {"steps": [], "errors": []}
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 900})
        page.goto("http://localhost:8081", wait_until="networkidle", timeout=30000)
        time.sleep(1)
        shot(page, "01-home")
        dump_state(page, "01-home")
        report["steps"].append({"name": "home", "url": page.url})

        click = try_click_by_text(page, ["登录", "Login", "Sign in", "注册", "Register", "开始", "Start"])
        if click:
            time.sleep(1)
            shot(page, "02-after-first-nav")
            dump_state(page, "02-after-first-nav")
            report["steps"].append({"name": "first-nav", "clicked": click, "url": page.url})

        # Try generic auth form fill
        inputs = page.locator("input")
        if inputs.count() >= 2:
            try:
                inputs.nth(0).fill(f"u{int(time.time())}@test.local")
                inputs.nth(1).fill("Test123456!")
                if inputs.count() >= 3:
                    inputs.nth(2).fill("Test123456!")
                clicked = try_click_by_text(page, ["注册", "Register", "Sign up", "登录", "Login", "Sign in"])
                report["steps"].append({"name": "auth-attempt", "clicked": clicked})
                time.sleep(2)
                shot(page, "03-after-auth")
                dump_state(page, "03-after-auth")
            except Exception as e:
                report["errors"].append(f"auth_fill_error: {e}")

        # Try entering chat/conversation UI
        clicked_tab = try_click_by_text(page, ["聊天", "Chat", "消息", "Message", "IM", "会话", "Conversations"])
        if clicked_tab:
            time.sleep(1)
            shot(page, "04-chat-tab")
            dump_state(page, "04-chat-tab")
            report["steps"].append({"name": "open-chat-tab", "clicked": clicked_tab, "url": page.url})

        # Open first potential conversation item
        candidates = [
            page.locator("[role=listitem]").first,
            page.locator("[data-testid*=conversation]").first,
            page.locator("li").first,
            page.locator("a").filter(has_text="chat").first,
            page.locator("a").first,
        ]
        opened = False
        for c in candidates:
            try:
                if c.count() > 0:
                    c.click(timeout=1200)
                    opened = True
                    break
            except Exception:
                pass
        if opened:
            time.sleep(1)
            shot(page, "05-conversation-open")
            dump_state(page, "05-conversation-open")
            report["steps"].append({"name": "open-conversation", "url": page.url})

        # Try send text
        text_inputs = page.locator("textarea, input[type=text], [contenteditable=true]")
        if text_inputs.count() > 0:
            try:
                msg = f"e2e text {int(time.time())}"
                text_inputs.first.fill(msg)
                before = page.locator(f"text={msg}").count()
                clicked_send = try_click_by_text(page, ["发送", "Send"])
                if not clicked_send:
                    page.keyboard.press("Enter")
                time.sleep(1)
                after = page.locator(f"text={msg}").count()
                report["steps"].append({"name": "send-text", "message": msg, "before": before, "after": after})
                shot(page, "06-after-send-text")
                dump_state(page, "06-after-send-text")
            except Exception as e:
                report["errors"].append(f"send_text_error: {e}")

        # Try emoji toggle and send
        emoji_btn = try_click_by_text(page, ["😀", "😊", "表情", "Emoji"])
        if emoji_btn:
            time.sleep(1)
            shot(page, "07-emoji-panel-open")
            dump_state(page, "07-emoji-panel-open")
            try_click_by_text(page, ["😀", "😂", "❤️", "👍"])
            time.sleep(1)
            shot(page, "08-after-emoji-pick")
            dump_state(page, "08-after-emoji-pick")
            report["steps"].append({"name": "emoji", "clicked": emoji_btn})

        (OUT_DIR / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
        browser.close()


if __name__ == "__main__":
    main()
