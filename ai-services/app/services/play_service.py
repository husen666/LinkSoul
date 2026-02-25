"""玩法规划服务：生成结构化约会/共创方案"""

import json
from langchain_core.messages import HumanMessage, SystemMessage
from app.core.llm import get_chat_llm


def _safe_parse_plans(text: str) -> list[str]:
    raw = (text or "").strip()
    if not raw:
        return []
    cleaned = raw
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[1].rsplit("```", 1)[0].strip()
    try:
        parsed = json.loads(cleaned)
        if isinstance(parsed, dict) and isinstance(parsed.get("plans"), list):
            return [str(v).strip() for v in parsed["plans"] if str(v).strip()][:3]
    except Exception:
        pass

    lines = [ln.strip() for ln in raw.split("\n") if ln.strip()]
    plans: list[str] = []
    for line in lines:
        item = line
        for prefix in ["1.", "2.", "3.", "1、", "2、", "3、", "-", "•", "*"]:
            if item.startswith(prefix):
                item = item[len(prefix):].strip()
                break
        if item:
            plans.append(item)
    return plans[:3]


async def generate_play_plans(
    mode: str,
    instruction: str,
    relationship_stage: str = "INITIAL",
    user_profile: dict | None = None,
) -> dict:
    llm = get_chat_llm()
    profile = user_profile or {}
    try:
        resp = await llm.ainvoke([
            SystemMessage(content=(
                "你是 LinkSoul 互动玩法策划助手。"
                "根据用户给出的玩法类型、关系阶段和上下文，"
                "生成 3 条可直接执行的方案。"
                "输出必须是 JSON：{\"plans\": [\"...\", \"...\", \"...\"]}。"
                "每条方案 50-160 字，具体、自然、可落地，不油腻。"
            )),
            HumanMessage(content=(
                f"玩法类型: {mode}\n"
                f"关系阶段: {relationship_stage}\n"
                f"用户画像补充: {profile}\n\n"
                f"{instruction}"
            )),
        ])
        plans = _safe_parse_plans(str(resp.content or ""))
        if plans:
            return {"plans": plans}
    except Exception:
        pass

    # Fallback guarantees deterministic UX when LLM is unstable.
    if mode == "date-planner":
        return {
            "plans": [
                "方案A｜轻量破冰：咖啡店30分钟互问3个小问题，再散步15分钟，总预算50-120；开场：今天不赶进度，我们先交换一件最近的小开心。",
                "方案B｜升温互动：一起逛展+晚餐，分三步（选展→拍三张主题照→晚餐复盘），预算150-350；开场：我们边看边选一件“最像对方”的作品。",
                "方案C｜通用备选：雨天室内桌游/手作，先热身再小协作，预算80-220；开场：我们做个小任务，看看谁更会临场发挥。",
            ],
        }
    return {
        "plans": [
            "共创A｜微任务：各写2个本周可完成的小目标，合并成1份双人计划；开场：我先抛两个点子，你帮我选和改。",
            "共创B｜故事接龙：围绕“今天最想分享的瞬间”各写2句，合成一段短文；开场：我先写第一句，你来接第二句。",
            "共创C｜关系升级卡：各提1个期待+1个边界+1个行动，下周复盘；开场：我们试试把想法写成可执行清单。",
        ],
    }

