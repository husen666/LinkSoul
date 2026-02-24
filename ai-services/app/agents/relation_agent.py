"""
Relation Agent — LangGraph 多步工作流

流程: 阶段判断(DeepSeek R1) → 进展评估 → 建议生成(DeepSeek V3)

使用 DeepSeek R1 做关系阶段的逻辑推理判断，
使用 DeepSeek V3 生成用户友好的进展报告和建议。
"""

from __future__ import annotations

import json
from typing import TypedDict

from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.graph import StateGraph, END

from app.core.llm import get_chat_llm, get_reasoner_llm


# ── State ──────────────────────────────────────────────

class RelationAgentState(TypedDict):
    # 输入
    user_profile: dict
    partner_profile: dict
    current_stage: str
    interaction_history: str
    # 中间结果
    stage_assessment: dict
    progress_evaluation: str
    # 输出
    recommended_stage: str
    progress_score: float
    advice: list[str]
    stage_report: str
    error: str


# ── Nodes ──────────────────────────────────────────────

async def assess_stage(state: RelationAgentState) -> dict:
    """节点1: 用 DeepSeek R1 推理判断当前真实的关系阶段"""
    llm = get_reasoner_llm()

    resp = await llm.ainvoke([
        HumanMessage(content=(
            "你是关系心理学专家。根据以下信息，推理判断两人当前真实的关系阶段。\n\n"
            f"当前标记阶段: {state['current_stage']}\n"
            f"用户画像: {json.dumps(state['user_profile'], ensure_ascii=False)}\n"
            f"对方画像: {json.dumps(state['partner_profile'], ensure_ascii=False)}\n"
            f"互动历史摘要:\n{state['interaction_history']}\n\n"
            "关系阶段定义:\n"
            "- INITIAL: 初识阶段，刚匹配，互相了解基本信息\n"
            "- GETTING_TO_KNOW: 了解阶段，有持续对话，开始分享个人话题\n"
            "- DATING: 约会阶段，有线下接触或深入的情感交流\n"
            "- COMMITTED: 确定关系，双方明确恋爱关系\n"
            "- ENDED: 关系结束\n\n"
            "返回纯 JSON:\n"
            "{\n"
            '  "recommended_stage": "阶段枚举值",\n'
            '  "confidence": 0.0-1.0,\n'
            '  "reasoning": "推理过程",\n'
            '  "signals": ["支持判断的关键信号"]\n'
            "}"
        )),
    ])

    content = (resp.content or "").strip()
    if content.startswith("```"):
        content = content.split("\n", 1)[1].rsplit("```", 1)[0].strip()

    try:
        assessment = json.loads(content)
        return {
            "stage_assessment": assessment,
            "recommended_stage": assessment.get("recommended_stage", state["current_stage"]),
        }
    except (json.JSONDecodeError, ValueError):
        return {
            "stage_assessment": {"raw": content},
            "recommended_stage": state["current_stage"],
        }


async def evaluate_progress(state: RelationAgentState) -> dict:
    """节点2: 用 DeepSeek R1 评估关系进展健康度"""
    llm = get_reasoner_llm()

    resp = await llm.ainvoke([
        HumanMessage(content=(
            "你是关系健康评估专家。根据以下信息，评估这段关系的进展健康度。\n\n"
            f"关系阶段: {state['recommended_stage']}\n"
            f"阶段判断详情: {json.dumps(state['stage_assessment'], ensure_ascii=False)}\n"
            f"互动历史:\n{state['interaction_history']}\n\n"
            "评估维度:\n"
            "1. 沟通质量（对话频率、深度、互动性）\n"
            "2. 情感投入（关心程度、情绪共鸣）\n"
            "3. 边界尊重（是否尊重彼此节奏）\n"
            "4. 发展趋势（是在积极发展还是停滞/倒退）\n\n"
            "返回纯 JSON:\n"
            "{\n"
            '  "progress_score": 0-100,\n'
            '  "dimensions": {\n'
            '    "communication": {"score": 分数, "note": "说明"},\n'
            '    "emotional_investment": {"score": 分数, "note": "说明"},\n'
            '    "boundary_respect": {"score": 分数, "note": "说明"},\n'
            '    "trend": {"score": 分数, "note": "说明"}\n'
            "  },\n"
            '  "summary": "一句话总结"\n'
            "}"
        )),
    ])

    content = (resp.content or "").strip()
    if content.startswith("```"):
        content = content.split("\n", 1)[1].rsplit("```", 1)[0].strip()

    try:
        evaluation = json.loads(content)
        return {
            "progress_evaluation": json.dumps(evaluation, ensure_ascii=False),
            "progress_score": float(evaluation.get("progress_score", 50)),
        }
    except (json.JSONDecodeError, ValueError):
        return {
            "progress_evaluation": content,
            "progress_score": 50.0,
        }


async def generate_advice(state: RelationAgentState) -> dict:
    """节点3: 用 DeepSeek V3 生成温暖的建议和阶段报告"""
    llm = get_chat_llm()

    resp = await llm.ainvoke([
        SystemMessage(content=(
            "你是 LinkSoul 的关系顾问。根据关系评估结果，"
            "为用户生成温暖实用的关系建议。\n\n"
            "要求:\n"
            "- 语气温暖亲切，像朋友在聊天\n"
            "- 建议要具体可执行，不要空洞的鸡汤\n"
            "- 分两部分: 3条具体建议 + 阶段小报告\n"
            "- 建议和报告之间用 === 分隔"
        )),
        HumanMessage(content=(
            f"关系阶段: {state['recommended_stage']}\n"
            f"进展分数: {state['progress_score']:.0f}/100\n"
            f"阶段判断: {json.dumps(state['stage_assessment'], ensure_ascii=False)}\n"
            f"进展评估: {state['progress_evaluation']}\n\n"
            "请输出:\n"
            "1. 三条具体行动建议（每条一行）\n"
            "===\n"
            "2. 200-400字的阶段性小报告"
        )),
    ])

    content = (resp.content or "").strip()
    parts = content.split("===", 1)

    advice_text = parts[0].strip()
    advice_lines = []
    for line in advice_text.split("\n"):
        line = line.strip()
        if not line:
            continue
        for prefix in ["1.", "2.", "3.", "1、", "2、", "3、", "-", "•", "*"]:
            if line.startswith(prefix):
                line = line[len(prefix):].strip()
                break
        if line:
            advice_lines.append(line)

    report = parts[1].strip() if len(parts) > 1 else "暂时无法生成详细报告。"

    return {
        "advice": advice_lines[:3],
        "stage_report": report,
    }


# ── Graph ──────────────────────────────────────────────

def build_relation_agent_graph() -> StateGraph:
    graph = StateGraph(RelationAgentState)

    graph.add_node("assess_stage", assess_stage)
    graph.add_node("evaluate_progress", evaluate_progress)
    graph.add_node("generate_advice", generate_advice)

    graph.set_entry_point("assess_stage")
    graph.add_edge("assess_stage", "evaluate_progress")
    graph.add_edge("evaluate_progress", "generate_advice")
    graph.add_edge("generate_advice", END)

    return graph


_relation_agent = build_relation_agent_graph().compile()


async def run_relation_agent(
    user_profile: dict,
    partner_profile: dict,
    current_stage: str = "INITIAL",
    interaction_history: str = "",
) -> dict:
    """运行关系推进 Agent"""
    result = await _relation_agent.ainvoke({
        "user_profile": user_profile,
        "partner_profile": partner_profile,
        "current_stage": current_stage,
        "interaction_history": interaction_history,
        "stage_assessment": {},
        "progress_evaluation": "",
        "recommended_stage": "",
        "progress_score": 0.0,
        "advice": [],
        "stage_report": "",
        "error": "",
    })
    return result
