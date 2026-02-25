from fastapi import APIRouter
from pydantic import BaseModel

from app.services.chat_service import generate_chat_suggestions
from app.services.emotion_service import analyze_emotion
from app.services.screenshot_service import analyze_screenshot
from app.services.play_service import generate_play_plans
from app.agents.match_agent import run_match_agent
from app.agents.relation_agent import run_relation_agent
from app.agents.personality_agent import run_personality_agent

router = APIRouter(prefix="/api/v1")


# ── Chat Agent ─────────────────────────────────────────

class ChatSuggestionRequest(BaseModel):
    context: str
    user_profile: dict = {}
    relationship_stage: str = "INITIAL"


class ChatSuggestionResponse(BaseModel):
    suggestions: list[str]
    emotion: str = "neutral"
    emotion_confidence: float = 0.5
    strategy: str = ""


@router.post("/chat/suggestions", response_model=ChatSuggestionResponse)
async def get_chat_suggestions(req: ChatSuggestionRequest):
    """Chat Agent: 情绪识别→上下文构建→策略选择→回复生成→安全过滤"""
    result = await generate_chat_suggestions(
        context=req.context,
        user_profile=req.user_profile,
        relationship_stage=req.relationship_stage,
    )
    return ChatSuggestionResponse(**result)


class PlayPlanRequest(BaseModel):
    mode: str
    instruction: str
    relationship_stage: str = "INITIAL"
    user_profile: dict = {}


class PlayPlanResponse(BaseModel):
    plans: list[str]


@router.post("/play/plans", response_model=PlayPlanResponse)
async def get_play_plans(req: PlayPlanRequest):
    """玩法规划：输出 3 条可执行方案"""
    result = await generate_play_plans(
        mode=req.mode,
        instruction=req.instruction,
        relationship_stage=req.relationship_stage,
        user_profile=req.user_profile,
    )
    return PlayPlanResponse(**result)


# ── Emotion Analysis ───────────────────────────────────

class EmotionRequest(BaseModel):
    text: str


class EmotionResponse(BaseModel):
    emotion: str
    confidence: float


@router.post("/analysis/emotion", response_model=EmotionResponse)
async def get_emotion_analysis(req: EmotionRequest):
    """DeepSeek V3 情绪识别"""
    result = await analyze_emotion(req.text)
    return EmotionResponse(**result)


# ── Screenshot Analysis ────────────────────────────────

class ScreenshotRequest(BaseModel):
    image_url: str


class ScreenshotResponse(BaseModel):
    analysis: str


@router.post("/analysis/screenshot", response_model=ScreenshotResponse)
async def get_screenshot_analysis(req: ScreenshotRequest):
    """DeepSeek V3 聊天截图分析"""
    result = await analyze_screenshot(req.image_url)
    return ScreenshotResponse(**result)


# ── Match Agent ────────────────────────────────────────

class MatchAnalysisRequest(BaseModel):
    user_a_profile: dict
    user_b_profile: dict


class MatchAnalysisResponse(BaseModel):
    overall_score: float
    match_reason: str
    detailed_report: str
    compatibility_scores: dict = {}


@router.post("/match/analyze", response_model=MatchAnalysisResponse)
async def analyze_match(req: MatchAnalysisRequest):
    """Match Agent: 画像分析→兼容性评估(R1)→匹配理由生成"""
    result = await run_match_agent(
        user_a_profile=req.user_a_profile,
        user_b_profile=req.user_b_profile,
    )
    return MatchAnalysisResponse(
        overall_score=result.get("overall_score", 0),
        match_reason=result.get("match_reason", ""),
        detailed_report=result.get("detailed_report", ""),
        compatibility_scores=result.get("compatibility_scores", {}),
    )


# ── Relation Agent ─────────────────────────────────────

class RelationAnalysisRequest(BaseModel):
    user_profile: dict
    partner_profile: dict
    current_stage: str = "INITIAL"
    interaction_history: str = ""


class RelationAnalysisResponse(BaseModel):
    recommended_stage: str
    progress_score: float
    advice: list[str]
    stage_report: str
    stage_assessment: dict = {}


@router.post("/relation/analyze", response_model=RelationAnalysisResponse)
async def analyze_relation(req: RelationAnalysisRequest):
    """Relation Agent: 阶段判断(R1)→进展评估(R1)→建议生成"""
    result = await run_relation_agent(
        user_profile=req.user_profile,
        partner_profile=req.partner_profile,
        current_stage=req.current_stage,
        interaction_history=req.interaction_history,
    )
    return RelationAnalysisResponse(
        recommended_stage=result.get("recommended_stage", req.current_stage),
        progress_score=result.get("progress_score", 0),
        advice=result.get("advice", []),
        stage_report=result.get("stage_report", ""),
        stage_assessment=result.get("stage_assessment", {}),
    )


# ── Personality Agent ──────────────────────────────────

class PersonalityAnalysisRequest(BaseModel):
    answers: dict


class PersonalityAnalysisResponse(BaseModel):
    attachment_type: str
    communication_style: str
    personality_tags: list[str]
    ai_summary: str
    dimension_details: dict = {}


@router.post("/personality/analyze", response_model=PersonalityAnalysisResponse)
async def analyze_personality(req: PersonalityAnalysisRequest):
    """Personality Agent: 维度评分→性格画像→AI深度分析(R1)→标签生成"""
    result = await run_personality_agent(answers=req.answers)
    return PersonalityAnalysisResponse(
        attachment_type=result.get("attachment_type", "SECURE"),
        communication_style=result.get("communication_style", "DIRECT"),
        personality_tags=result.get("personality_tags", []),
        ai_summary=result.get("ai_summary", ""),
        dimension_details=result.get("dimension_details", {}),
    )


# ── Health ─────────────────────────────────────────────

@router.get("/health")
async def health_check():
    return {
        "status": "ok",
        "service": "linksoul-ai",
        "agents": ["chat_agent", "match_agent", "relation_agent", "personality_agent"],
        "llm": "deepseek-chat (V3) + deepseek-reasoner (R1)",
    }
