"""情绪分析服务 — 复用 Chat Agent 的情绪识别节点"""

import json
from langchain_core.messages import HumanMessage, SystemMessage
from app.core.llm import get_chat_llm


async def analyze_emotion(text: str) -> dict:
    """独立的情绪分析（不走完整 Agent 流程）"""
    llm = get_chat_llm()
    try:
        resp = await llm.ainvoke([
            SystemMessage(content="你是情绪分析专家。分析文本情绪，返回纯 JSON。"),
            HumanMessage(content=(
                f"分析以下文本的情绪：\n\n{text}\n\n"
                '返回格式: {"emotion": "类型", "confidence": 0.0-1.0}\n'
                "情绪类型: happy, sad, angry, anxious, neutral, excited, loving, confused"
            )),
        ])
        content = (resp.content or "").strip()
        if content.startswith("```"):
            content = content.split("\n", 1)[1].rsplit("```", 1)[0].strip()
        return json.loads(content)
    except Exception:
        return {"emotion": "neutral", "confidence": 0.5}
