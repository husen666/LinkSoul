from langchain_openai import ChatOpenAI
from .config import get_settings


def get_chat_llm() -> ChatOpenAI:
    """DeepSeek V3 — 日常对话、聊天建议、情绪分析、内容生成"""
    settings = get_settings()
    return ChatOpenAI(
        model=settings.deepseek_chat_model,
        api_key=settings.deepseek_api_key,
        base_url=f"{settings.deepseek_base_url}/v1",
        temperature=0.8,
        max_tokens=1024,
    )


def get_reasoner_llm() -> ChatOpenAI:
    """DeepSeek R1 — 关系阶段推理、匹配算法决策、复杂分析"""
    settings = get_settings()
    return ChatOpenAI(
        model=settings.deepseek_reasoner_model,
        api_key=settings.deepseek_api_key,
        base_url=f"{settings.deepseek_base_url}/v1",
        temperature=0.0,
        max_tokens=2048,
    )
