"""聊天截图分析服务"""

from langchain_core.messages import HumanMessage, SystemMessage
from app.core.llm import get_chat_llm


async def analyze_screenshot(image_url: str) -> dict:
    """用 DeepSeek V3 分析聊天截图内容"""
    llm = get_chat_llm()
    try:
        resp = await llm.ainvoke([
            SystemMessage(content=(
                "你是 LinkSoul AI 关系分析师。"
                "用户会提供聊天截图的文本描述，请从专业角度分析。"
            )),
            HumanMessage(content=(
                "请分析以下聊天内容：\n\n"
                f"{image_url}\n\n"
                "请从以下角度分析：\n"
                "1. 双方的沟通模式和情绪状态\n"
                "2. 当前对话氛围\n"
                "3. 值得注意的积极/消极信号\n"
                "4. 具体的沟通改善建议"
            )),
        ])
        return {"analysis": (resp.content or "").strip()}
    except Exception:
        return {"analysis": "暂时无法分析，请稍后重试。"}
