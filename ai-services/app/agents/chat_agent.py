"""
Chat Agent — LangGraph 多步工作流

流程: 情绪识别 → 上下文构建 → 策略选择 → 回复生成 → 安全过滤

使用 DeepSeek V3 (deepseek-chat) 驱动每个节点。
"""

from __future__ import annotations

import json
import operator
from typing import Annotated, TypedDict

from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.graph import StateGraph, END

from app.core.llm import get_chat_llm


# ── State ──────────────────────────────────────────────

class ChatAgentState(TypedDict):
    # 输入
    context: str
    user_profile: dict
    relationship_stage: str
    # 中间结果
    emotion: str
    emotion_confidence: float
    enriched_context: str
    strategy: str
    raw_suggestions: list[str]
    # 最终输出
    suggestions: Annotated[list[str], operator.add]
    error: str


# ── Nodes ──────────────────────────────────────────────

async def recognize_emotion(state: ChatAgentState) -> dict:
    """节点1: 用 DeepSeek 识别聊天上下文中的情绪状态"""
    llm = get_chat_llm()
    try:
        resp = await llm.ainvoke([
            SystemMessage(content="你是情绪分析专家。分析文本情绪，返回纯 JSON。"),
            HumanMessage(content=(
                f"分析以下聊天上下文中对方最新消息的情绪：\n\n{state['context']}\n\n"
                '返回格式: {"emotion": "类型", "confidence": 0.0-1.0}\n'
                "情绪类型: happy, sad, angry, anxious, neutral, excited, loving, confused"
            )),
        ])
        content = (resp.content or "").strip()
        if content.startswith("```"):
            content = content.split("\n", 1)[1].rsplit("```", 1)[0].strip()
        result = json.loads(content)
        return {
            "emotion": result.get("emotion", "neutral"),
            "emotion_confidence": result.get("confidence", 0.5),
        }
    except Exception:
        return {"emotion": "neutral", "emotion_confidence": 0.5}


async def build_context(state: ChatAgentState) -> dict:
    """节点2: 将用户画像、情绪、关系阶段整合为富上下文"""
    profile = state.get("user_profile", {})
    profile_parts = []
    if profile.get("attachmentType"):
        attachment_map = {
            "SECURE": "安全型依恋",
            "ANXIOUS": "焦虑型依恋",
            "AVOIDANT": "回避型依恋",
            "FEARFUL": "恐惧型依恋",
        }
        profile_parts.append(f"依恋类型: {attachment_map.get(profile['attachmentType'], profile['attachmentType'])}")
    if profile.get("communicationStyle"):
        style_map = {
            "DIRECT": "直接型沟通",
            "INDIRECT": "委婉型沟通",
            "ANALYTICAL": "分析型沟通",
            "EMOTIONAL": "情感型沟通",
        }
        profile_parts.append(f"沟通风格: {style_map.get(profile['communicationStyle'], profile['communicationStyle'])}")
    if profile.get("personalityTags"):
        profile_parts.append(f"性格标签: {', '.join(profile['personalityTags'])}")

    stage_map = {
        "INITIAL": "初识阶段",
        "GETTING_TO_KNOW": "了解阶段",
        "DATING": "约会阶段",
        "COMMITTED": "确定关系",
    }
    stage_cn = stage_map.get(state["relationship_stage"], state["relationship_stage"])

    enriched = (
        f"【关系阶段】{stage_cn}\n"
        f"【对方情绪】{state['emotion']}（置信度 {state['emotion_confidence']:.0%}）\n"
        f"【用户画像】{'; '.join(profile_parts) if profile_parts else '未完善'}\n"
        f"【聊天记录】\n{state['context']}"
    )
    return {"enriched_context": enriched}


async def select_strategy(state: ChatAgentState) -> dict:
    """节点3: 根据关系阶段和情绪选择沟通策略"""
    llm = get_chat_llm()
    resp = await llm.ainvoke([
        SystemMessage(content=(
            "你是资深恋爱心理顾问。根据关系阶段和对方的情绪状态，"
            "选择最合适的沟通策略。只返回策略名称和一句话描述，不要多余内容。"
        )),
        HumanMessage(content=(
            f"关系阶段: {state['relationship_stage']}\n"
            f"对方情绪: {state['emotion']}\n"
            f"用户画像: {state.get('user_profile', {})}\n\n"
            "可选策略:\n"
            "- 轻松幽默: 用幽默化解紧张，拉近距离\n"
            "- 真诚关心: 表达真实的关心和好奇\n"
            "- 共情倾听: 先理解对方感受再回应\n"
            "- 分享互动: 分享自己的经历引发共鸣\n"
            "- 温暖鼓励: 给予正面支持和鼓励\n"
            "- 深度对话: 引导有深度的价值观交流\n\n"
            "选择最合适的策略并说明原因（一行即可）:"
        )),
    ])
    return {"strategy": (resp.content or "真诚关心").strip()}


async def generate_replies(state: ChatAgentState) -> dict:
    """节点4: 用 DeepSeek 生成候选回复"""
    llm = get_chat_llm()
    resp = await llm.ainvoke([
        SystemMessage(content=(
            "你是 LinkSoul AI 恋爱助手。根据沟通策略和上下文，"
            "生成3条自然、真诚的回复建议。\n\n"
            "要求:\n"
            "- 符合策略风格，语气自然不做作\n"
            "- 每条回复独立成句，适合直接发送\n"
            "- 长度适中（15-60字），不要太短也不要太长\n"
            "- 直接输出3条回复，每条一行，不要编号和前缀"
        )),
        HumanMessage(content=(
            f"沟通策略: {state['strategy']}\n\n"
            f"{state['enriched_context']}"
        )),
    ])

    content = resp.content or ""
    lines = [ln.strip() for ln in content.strip().split("\n") if ln.strip()]
    cleaned = []
    for line in lines:
        for prefix in ["1.", "2.", "3.", "1、", "2、", "3、", "-", "•", "*"]:
            if line.startswith(prefix):
                line = line[len(prefix):].strip()
                break
        if line:
            cleaned.append(line)
    return {"raw_suggestions": cleaned[:5]}


async def safety_filter(state: ChatAgentState) -> dict:
    """节点5: 安全过滤 — 排除不当内容"""
    llm = get_chat_llm()
    candidates = state.get("raw_suggestions", [])
    if not candidates:
        return {"suggestions": ["你好呀，最近怎么样？", "今天过得开心吗？", "有什么想聊的吗？"]}

    numbered = "\n".join(f"{i+1}. {s}" for i, s in enumerate(candidates))
    resp = await llm.ainvoke([
        SystemMessage(content=(
            "你是内容审核员。检查以下回复建议是否存在：\n"
            "- 骚扰、冒犯或不尊重的内容\n"
            "- 过度亲密（不符合关系阶段）\n"
            "- 虚假承诺或操纵性语言\n"
            "- PUA 话术\n\n"
            "返回通过审核的回复编号（逗号分隔），如果全部通过返回 'ALL'。"
            "如果某条有问题，只返回通过的编号。"
        )),
        HumanMessage(content=f"关系阶段: {state['relationship_stage']}\n\n候选回复:\n{numbered}"),
    ])

    result_text = (resp.content or "ALL").strip().upper()

    if "ALL" in result_text:
        return {"suggestions": candidates[:3]}

    safe = []
    for i, s in enumerate(candidates):
        if str(i + 1) in result_text:
            safe.append(s)
    return {"suggestions": safe[:3] if safe else candidates[:3]}


# ── Graph ──────────────────────────────────────────────

def build_chat_agent_graph() -> StateGraph:
    graph = StateGraph(ChatAgentState)

    graph.add_node("recognize_emotion", recognize_emotion)
    graph.add_node("build_context", build_context)
    graph.add_node("select_strategy", select_strategy)
    graph.add_node("generate_replies", generate_replies)
    graph.add_node("safety_filter", safety_filter)

    graph.set_entry_point("recognize_emotion")
    graph.add_edge("recognize_emotion", "build_context")
    graph.add_edge("build_context", "select_strategy")
    graph.add_edge("select_strategy", "generate_replies")
    graph.add_edge("generate_replies", "safety_filter")
    graph.add_edge("safety_filter", END)

    return graph


_chat_agent = build_chat_agent_graph().compile()


async def run_chat_agent(
    context: str,
    user_profile: dict | None = None,
    relationship_stage: str = "INITIAL",
) -> dict:
    """运行聊天建议 Agent，返回完整状态（含中间推理过程）"""
    result = await _chat_agent.ainvoke({
        "context": context,
        "user_profile": user_profile or {},
        "relationship_stage": relationship_stage,
        "emotion": "",
        "emotion_confidence": 0.0,
        "enriched_context": "",
        "strategy": "",
        "raw_suggestions": [],
        "suggestions": [],
        "error": "",
    })
    return result
