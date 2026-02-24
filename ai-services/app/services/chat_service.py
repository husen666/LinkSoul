"""聊天建议服务 — 委托给 LangGraph Chat Agent"""

from app.agents.chat_agent import run_chat_agent


async def generate_chat_suggestions(
    context: str,
    user_profile: dict,
    relationship_stage: str,
) -> dict:
    """运行 Chat Agent 完整工作流并返回结果"""
    result = await run_chat_agent(
        context=context,
        user_profile=user_profile,
        relationship_stage=relationship_stage,
    )
    return {
        "suggestions": result.get("suggestions", []),
        "emotion": result.get("emotion", "neutral"),
        "emotion_confidence": result.get("emotion_confidence", 0.5),
        "strategy": result.get("strategy", ""),
    }
