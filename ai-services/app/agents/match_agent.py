"""
Match Agent — LangGraph 多步工作流

流程: 画像分析 → 兼容性评估(DeepSeek R1) → 匹配理由生成

使用 DeepSeek R1 (deepseek-reasoner) 做深度兼容性推理，
使用 DeepSeek V3 (deepseek-chat) 生成用户可读的匹配理由。
"""

from __future__ import annotations

import json
from typing import TypedDict

from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.graph import StateGraph, END

from app.core.llm import get_chat_llm, get_reasoner_llm


# ── State ──────────────────────────────────────────────

class MatchAgentState(TypedDict):
    # 输入
    user_a_profile: dict
    user_b_profile: dict
    # 中间结果
    profile_analysis: str
    compatibility_scores: dict
    overall_score: float
    # 输出
    match_reason: str
    detailed_report: str
    error: str


# ── Nodes ──────────────────────────────────────────────

async def analyze_profiles(state: MatchAgentState) -> dict:
    """节点1: 用 DeepSeek V3 提取并结构化两人的关键画像特征"""
    llm = get_chat_llm()

    def format_profile(p: dict) -> str:
        parts = []
        for key, label in [
            ("attachmentType", "依恋类型"),
            ("communicationStyle", "沟通风格"),
            ("personalityTags", "性格标签"),
            ("gender", "性别"),
            ("city", "城市"),
            ("bio", "自我介绍"),
        ]:
            val = p.get(key)
            if val:
                parts.append(f"{label}: {val if not isinstance(val, list) else ', '.join(val)}")
        return "\n".join(parts) if parts else "画像未完善"

    resp = await llm.ainvoke([
        SystemMessage(content=(
            "你是心理画像分析师。分析两个用户的性格画像，"
            "提取可以用于兼容性评估的关键维度。\n"
            "输出结构化的分析文本。"
        )),
        HumanMessage(content=(
            f"用户A画像:\n{format_profile(state['user_a_profile'])}\n\n"
            f"用户B画像:\n{format_profile(state['user_b_profile'])}\n\n"
            "请从以下维度分析两人的特征对比：\n"
            "1. 依恋模式兼容性\n"
            "2. 沟通风格匹配度\n"
            "3. 性格互补/相似度\n"
            "4. 生活方式契合度"
        )),
    ])
    return {"profile_analysis": (resp.content or "").strip()}


async def evaluate_compatibility(state: MatchAgentState) -> dict:
    """节点2: 用 DeepSeek R1 做深度兼容性推理评估"""
    llm = get_reasoner_llm()

    resp = await llm.ainvoke([
        HumanMessage(content=(
            "你是关系心理学专家。基于以下两人的画像分析结果，"
            "进行深度兼容性推理评估。\n\n"
            f"{state['profile_analysis']}\n\n"
            "请为以下每个维度评分（0-100）并说明理由，返回纯 JSON：\n"
            "{\n"
            '  "attachment_compatibility": {"score": 分数, "reason": "理由"},\n'
            '  "communication_compatibility": {"score": 分数, "reason": "理由"},\n'
            '  "personality_compatibility": {"score": 分数, "reason": "理由"},\n'
            '  "lifestyle_compatibility": {"score": 分数, "reason": "理由"},\n'
            '  "overall_score": 综合分数,\n'
            '  "key_insight": "一句话核心洞察"\n'
            "}"
        )),
    ])

    content = (resp.content or "").strip()
    if content.startswith("```"):
        content = content.split("\n", 1)[1].rsplit("```", 1)[0].strip()

    try:
        scores = json.loads(content)
        overall = scores.get("overall_score", 60)
        if isinstance(overall, dict):
            overall = overall.get("score", 60)
        return {
            "compatibility_scores": scores,
            "overall_score": float(overall),
        }
    except (json.JSONDecodeError, ValueError):
        return {
            "compatibility_scores": {"raw_analysis": content},
            "overall_score": 60.0,
        }


async def generate_match_reason(state: MatchAgentState) -> dict:
    """节点3: 用 DeepSeek V3 生成温暖的匹配理由（给用户看）"""
    llm = get_chat_llm()
    scores = state.get("compatibility_scores", {})
    overall = state.get("overall_score", 60)

    resp = await llm.ainvoke([
        SystemMessage(content=(
            "你是 LinkSoul 的匹配文案师。"
            "根据兼容性分析结果，生成一段温暖、具体的匹配理由。\n"
            "要求：\n"
            "- 语气积极温暖，不要列数据\n"
            "- 突出两人最大的亮点和契合点\n"
            "- 50-100字的简短摘要 + 150-300字的详细报告\n"
            "- 用 --- 分隔摘要和详细报告"
        )),
        HumanMessage(content=(
            f"匹配分数: {overall:.0f}/100\n\n"
            f"兼容性分析:\n{json.dumps(scores, ensure_ascii=False, indent=2)}"
        )),
    ])

    content = (resp.content or "").strip()
    parts = content.split("---", 1)
    reason = parts[0].strip()
    report = parts[1].strip() if len(parts) > 1 else content

    return {
        "match_reason": reason,
        "detailed_report": report,
    }


# ── Graph ──────────────────────────────────────────────

def build_match_agent_graph() -> StateGraph:
    graph = StateGraph(MatchAgentState)

    graph.add_node("analyze_profiles", analyze_profiles)
    graph.add_node("evaluate_compatibility", evaluate_compatibility)
    graph.add_node("generate_match_reason", generate_match_reason)

    graph.set_entry_point("analyze_profiles")
    graph.add_edge("analyze_profiles", "evaluate_compatibility")
    graph.add_edge("evaluate_compatibility", "generate_match_reason")
    graph.add_edge("generate_match_reason", END)

    return graph


_match_agent = build_match_agent_graph().compile()


async def run_match_agent(
    user_a_profile: dict,
    user_b_profile: dict,
) -> dict:
    """运行匹配分析 Agent"""
    result = await _match_agent.ainvoke({
        "user_a_profile": user_a_profile,
        "user_b_profile": user_b_profile,
        "profile_analysis": "",
        "compatibility_scores": {},
        "overall_score": 0.0,
        "match_reason": "",
        "detailed_report": "",
        "error": "",
    })
    return result
