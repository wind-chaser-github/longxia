"""
LLM 路由层 v2 — 基于 eigent 的多平台 ModelFactory 模式重写

来源框架：eigent/backend/app/agent/agent_model.py
核心改进（对比 v1 的纯手写 httpx 客户端）：
  - 复用 eigent 的 ModelPlatformType 枚举做平台路由（支持 OpenAI/Anthropic/Ollama/本地）
  - 本地 RTX 5090 优先（Ollama）→ 云端 API 降级的 fallback 链路
  - Tool Call 流式碎片累加逻辑保留（这个是我们自己写的核心）
  - 不依赖 camel-ai 包（eigent 才依赖它），只借鉴其路由决策模式
"""
import os
import json
import httpx
import logging
from typing import List, Dict, Any, AsyncGenerator, Optional
from enum import Enum

logger = logging.getLogger(__name__)


# ══════════════════════════════════════════════════════════════
# 直接移植 eigent 的 ModelPlatformType 枚举概念
# (eigent/backend/app/agent/agent_model.py 第 130 行的 ModelPlatformType)
# 我们用 Python 枚举重新表达，不依赖 camel-ai 包
# ══════════════════════════════════════════════════════════════

class ModelPlatform(str, Enum):
    """
    模型平台枚举（对齐 eigent 的 ModelPlatformType，但不依赖 camel-ai）
    路由优先级：LOCAL_OLLAMA > OPENAI_COMPATIBLE > OPENAI > ANTHROPIC
    """
    LOCAL_OLLAMA       = "ollama"           # 本地 RTX 5090 优先
    OPENAI_COMPATIBLE  = "openai_compatible" # 本地 vLLM / LM Studio
    OPENAI             = "openai"
    ANTHROPIC          = "anthropic"
    OPENROUTER         = "openrouter"

    @classmethod
    def from_env(cls) -> "ModelPlatform":
        """从环境变量自动感知当前平台（参考 eigent 的 effective_config 选取逻辑）"""
        val = os.getenv("LLM_PLATFORM", "openai").lower()
        try:
            return cls(val)
        except ValueError:
            logger.warning(f"Unknown LLM_PLATFORM='{val}', falling back to openai")
            return cls.OPENAI


# ══════════════════════════════════════════════════════════════
# 平台 → 端点配置（对应 eigent 的 effective_config 字典）
# ══════════════════════════════════════════════════════════════

_PLATFORM_DEFAULTS: Dict[ModelPlatform, Dict[str, str]] = {
    ModelPlatform.LOCAL_OLLAMA: {
        "base_url": "http://localhost:11434/v1",
        "model":    os.getenv("OLLAMA_MODEL", "qwen2.5:72b"),
        "api_key":  "ollama",   # Ollama 不需要真实 key
    },
    ModelPlatform.OPENAI_COMPATIBLE: {
        "base_url": os.getenv("OPENAI_COMPATIBLE_URL", "http://localhost:8000/v1"),
        "model":    os.getenv("OPENAI_COMPATIBLE_MODEL", "qwen2.5-72b"),
        "api_key":  os.getenv("OPENAI_COMPATIBLE_KEY", ""),
    },
    ModelPlatform.OPENAI: {
        "base_url": "https://api.openai.com/v1",
        "model":    os.getenv("OPENAI_MODEL", "gpt-4o"),
        "api_key":  os.getenv("OPENAI_API_KEY", ""),
    },
    ModelPlatform.ANTHROPIC: {
        "base_url": "https://api.anthropic.com/v1",
        "model":    os.getenv("ANTHROPIC_MODEL", "claude-opus-4-6"),
        "api_key":  os.getenv("ANTHROPIC_API_KEY", ""),
    },
    ModelPlatform.OPENROUTER: {
        "base_url": "https://openrouter.ai/api/v1",
        "model":    os.getenv("OPENROUTER_MODEL", "anthropic/claude-opus-4-6"),
        "api_key":  os.getenv("OPENROUTER_API_KEY", ""),
    },
}

# Fallback 链：本地挂掉时自动降级（参考 eigent 的云/本地双模式切换思路）
_FALLBACK_CHAIN: List[ModelPlatform] = [
    ModelPlatform.LOCAL_OLLAMA,
    ModelPlatform.OPENAI_COMPATIBLE,
    ModelPlatform.OPENAI,
    ModelPlatform.OPENROUTER,
]


class LLMRouter:
    """
    大模型路由网关 v2

    路由决策顺序（复用 eigent 的 effective_config 多优先级思路）：
    1. 先按 LLM_PLATFORM 环境变量确定主平台
    2. 请求失败时，沿 _FALLBACK_CHAIN 自动降级
    3. 所有平台均走 OpenAI-compatible 流式接口（Anthropic 侧通过 openrouter 代理）
    """

    def __init__(self, platform: Optional[ModelPlatform] = None):
        self.primary_platform = platform or ModelPlatform.from_env()
        logger.info(f"[LLMRouter] Primary platform: {self.primary_platform.value}")

    def _get_config(self, platform: ModelPlatform) -> Dict[str, str]:
        """获取平台配置（类比 eigent 的 effective_config 字典组装）"""
        cfg = dict(_PLATFORM_DEFAULTS[platform])
        return cfg

    async def chat_completion_stream(
        self,
        messages: List[Dict[str, Any]],
        tools: List[Dict[str, Any]] = None,
        model: Optional[str] = None,
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        流式对话接口，自动 Fallback。
        保留 v1 的 Tool Call 碎片累加逻辑（这是我们自己写的，不来自任何框架）。
        """
        # 按 fallback 链尝试，从主平台开始
        chain = [self.primary_platform] + [
            p for p in _FALLBACK_CHAIN if p != self.primary_platform
        ]

        for platform in chain:
            cfg = self._get_config(platform)
            effective_model = model or cfg["model"]
            
            # 修复：AsyncGenerator 不应该被 await
            async for chunk in self._try_stream(
                base_url=cfg["base_url"],
                api_key=cfg["api_key"],
                model=effective_model,
                messages=messages,
                tools=tools,
            ):
                if chunk.get("type") == "_error_fatal":
                    # 此平台彻底失败，尝试下一个
                    logger.warning(f"[LLMRouter] {platform.value} failed, trying next...")
                    break
                yield chunk
            else:
                return  # 正常完成，不继续尝试

    async def _try_stream(
        self,
        base_url: str,
        api_key: str,
        model: str,
        messages: List[Dict[str, Any]],
        tools: Optional[List[Dict[str, Any]]],
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        对单个端点发起流式请求。
        Tool Call 碎片累加算法直接保留自 v1（这是核心解析逻辑）。
        """
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        payload: Dict[str, Any] = {
            "model": model,
            "messages": messages,
            "stream": True,
            "temperature": 0.7,
        }
        if tools:
            payload["tools"] = tools
            payload["tool_choice"] = "auto"

        tool_call_buffer: Dict[int, Dict] = {}

        async with httpx.AsyncClient(timeout=90.0) as client:
            try:
                async with client.stream(
                    "POST", f"{base_url}/chat/completions",
                    headers=headers, json=payload
                ) as response:
                    response.raise_for_status()

                    async for line in response.aiter_lines():
                        if not line.startswith("data: "):
                            continue
                        data_str = line[6:]
                        if data_str.strip() == "[DONE]":
                            break
                        try:
                            data = json.loads(data_str)
                            choices = data.get("choices", [])
                            if not choices:
                                continue
                            delta = choices[0].get("delta", {})

                            # ── 文本流 ─────────────────────────────────────
                            if delta.get("content"):
                                yield {"type": "content", "data": delta["content"]}

                            # ── Tool Call 碎片累加（保留自 v1，核心解析）──
                            if "tool_calls" in delta:
                                for tc in delta["tool_calls"]:
                                    idx = tc["index"]
                                    if idx not in tool_call_buffer:
                                        tool_call_buffer[idx] = {
                                            "id": tc.get("id", ""),
                                            "type": "function",
                                            "function": {"name": "", "arguments": ""},
                                        }
                                    fn = tc.get("function", {})
                                    if fn.get("name"):
                                        tool_call_buffer[idx]["function"]["name"] += fn["name"]
                                    if fn.get("arguments"):
                                        tool_call_buffer[idx]["function"]["arguments"] += fn["arguments"]

                            # ── 工具调用结束，发出完整 payload ────────────
                            if choices[0].get("finish_reason") == "tool_calls":
                                yield {"type": "tool_calls", "data": list(tool_call_buffer.values())}

                        except json.JSONDecodeError:
                            continue

            except httpx.ConnectError:
                yield {"type": "_error_fatal", "reason": f"connect_error: {base_url}"}
            except httpx.HTTPStatusError as e:
                yield {"type": "_error_fatal", "reason": f"http_{e.response.status_code}"}
            except Exception as e:
                yield {"type": "_error_fatal", "reason": str(e)}
