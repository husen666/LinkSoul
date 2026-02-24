"""
Personality Agent — LangGraph 多步工作流

流程: 答案解析 → 维度评分 → 性格画像 → AI 深度分析(R1) → 标签生成

使用 DeepSeek V3 + R1 驱动。
"""

from __future__ import annotations

import json
from typing import TypedDict

from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.graph import StateGraph, END

from app.core.llm import get_chat_llm, get_reasoner_llm


class PersonalityState(TypedDict):
    answers: dict
    attachment_scores: dict
    communication_scores: dict
    attachment_type: str
    communication_style: str
    personality_tags: list[str]
    ai_summary: str
    dimension_details: dict


ATTACHMENT_QUESTIONS = {
    "q1", "q2", "q3", "q4", "q5", "q6", "q7", "q8",
}
COMMUNICATION_QUESTIONS = {
    "q9", "q10", "q11", "q12", "q13", "q14",
}
TRAIT_QUESTIONS = {
    "q15", "q16", "q17", "q18", "q19", "q20",
}


def score_attachment(state: PersonalityState) -> dict:
    """基于 ECR-R 简化量表计算依恋维度分数"""
    answers = state["answers"]

    anxiety_keys = ["q1", "q2", "q3", "q4"]
    avoidance_keys = ["q5", "q6", "q7", "q8"]

    anxiety = sum(answers.get(k, 3) for k in anxiety_keys) / len(anxiety_keys)
    avoidance = sum(answers.get(k, 3) for k in avoidance_keys) / len(avoidance_keys)

    if anxiety <= 3 and avoidance <= 3:
        attachment_type = "SECURE"
    elif anxiety > 3 and avoidance <= 3:
        attachment_type = "ANXIOUS"
    elif anxiety <= 3 and avoidance > 3:
        attachment_type = "AVOIDANT"
    else:
        attachment_type = "FEARFUL"

    return {
        "attachment_scores": {
            "anxiety": round(anxiety, 2),
            "avoidance": round(avoidance, 2),
        },
        "attachment_type": attachment_type,
    }


def score_communication(state: PersonalityState) -> dict:
    """计算沟通风格维度"""
    answers = state["answers"]

    directness = (answers.get("q9", 3) + answers.get("q10", 3)) / 2
    emotionality = (answers.get("q11", 3) + answers.get("q12", 3)) / 2
    analyticity = (answers.get("q13", 3) + answers.get("q14", 3)) / 2

    scores = {
        "DIRECT": directness,
        "EMOTIONAL": emotionality,
        "ANALYTICAL": analyticity,
        "INDIRECT": 6 - directness,
    }
    style = max(scores, key=scores.get)

    return {
        "communication_scores": {
            "directness": round(directness, 2),
            "emotionality": round(emotionality, 2),
            "analyticity": round(analyticity, 2),
        },
        "communication_style": style,
    }


async def generate_profile(state: PersonalityState) -> dict:
    """使用 DeepSeek V3 生成性格标签"""
    llm = get_chat_llm()
    answers = state["answers"]

    trait_answers = {k: answers.get(k, 3) for k in ["q15", "q16", "q17", "q18", "q19", "q20"]}

    prompt = f"""你是一位专业的心理分析师。根据以下用户的性格测试数据，生成 5-8 个中文性格标签。

依恋类型: {state["attachment_type"]}
依恋维度分数: {json.dumps(state["attachment_scores"])}
沟通风格: {state["communication_style"]}
沟通维度分数: {json.dumps(state["communication_scores"])}
特质问卷答案 (1-5分): {json.dumps(trait_answers)}

问卷含义:
- q15: 我喜欢尝试新事物 (高分=开放性高)
- q16: 我享受独处的时光 (高分=内倾)
- q17: 我容易感受到他人的情绪 (高分=共情力强)
- q18: 我喜欢有计划地做事 (高分=条理性强)
- q19: 我在社交场合感到自在 (高分=外向)
- q20: 我重视深度关系而非广泛社交 (高分=深度社交偏好)

请严格以 JSON 数组格式返回标签，例如: ["开放探索", "高共情力", "深度社交"]
只返回 JSON 数组，不要其他内容。"""

    resp = await llm.ainvoke([
        SystemMessage(content="你是 LinkSoul 的 AI 心理分析师，专注于生成精准的中文性格标签。"),
        HumanMessage(content=prompt),
    ])

    try:
        text = resp.content.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()
        tags = json.loads(text)
        if not isinstance(tags, list):
            tags = ["待分析"]
    except (json.JSONDecodeError, IndexError):
        tags = ["开放型", "高共情", "深度社交"]

    return {"personality_tags": tags}


async def deep_analysis(state: PersonalityState) -> dict:
    """使用 DeepSeek R1 进行深度性格分析"""
    llm = get_reasoner_llm()

    prompt = f"""作为一位资深心理咨询师，请根据以下心理测评数据，为用户撰写一段 200-300 字的深度性格分析报告。

## 测评结果
- 依恋类型: {state["attachment_type"]}
- 依恋维度: 焦虑={state["attachment_scores"].get("anxiety", 0)}, 回避={state["attachment_scores"].get("avoidance", 0)}
- 沟通风格: {state["communication_style"]}
- 沟通维度: 直接性={state["communication_scores"].get("directness", 0)}, 情感性={state["communication_scores"].get("emotionality", 0)}, 分析性={state["communication_scores"].get("analyticity", 0)}
- 性格标签: {", ".join(state["personality_tags"])}

## 要求
1. 用温暖但专业的语气
2. 分析优势和潜在的成长空间
3. 给出在社交和亲密关系中的具体建议
4. 不要使用标题或序号，用连贯的段落表达
5. 必须是中文
6. 直接输出分析内容，不要有前缀说明"""

    resp = await llm.ainvoke([
        SystemMessage(content="你是 LinkSoul 平台的首席心理顾问，擅长基于数据进行深度性格分析。请直接输出分析报告。"),
        HumanMessage(content=prompt),
    ])

    summary = resp.content.strip()
    if summary.startswith("<think>"):
        parts = summary.split("</think>")
        summary = parts[-1].strip() if len(parts) > 1 else summary

    return {
        "ai_summary": summary,
        "dimension_details": {
            "attachment": state["attachment_scores"],
            "communication": state["communication_scores"],
        },
    }


def build_personality_graph():
    graph = StateGraph(PersonalityState)

    graph.add_node("score_attachment", score_attachment)
    graph.add_node("score_communication", score_communication)
    graph.add_node("generate_profile", generate_profile)
    graph.add_node("deep_analysis", deep_analysis)

    graph.set_entry_point("score_attachment")
    graph.add_edge("score_attachment", "score_communication")
    graph.add_edge("score_communication", "generate_profile")
    graph.add_edge("generate_profile", "deep_analysis")
    graph.add_edge("deep_analysis", END)

    return graph.compile()


personality_graph = build_personality_graph()


async def run_personality_agent(answers: dict) -> dict:
    """运行性格分析 Agent"""
    initial_state: PersonalityState = {
        "answers": answers,
        "attachment_scores": {},
        "communication_scores": {},
        "attachment_type": "",
        "communication_style": "",
        "personality_tags": [],
        "ai_summary": "",
        "dimension_details": {},
    }

    result = await personality_graph.ainvoke(initial_state)

    return {
        "attachment_type": result["attachment_type"],
        "communication_style": result["communication_style"],
        "personality_tags": result["personality_tags"],
        "ai_summary": result["ai_summary"],
        "dimension_details": result["dimension_details"],
    }
