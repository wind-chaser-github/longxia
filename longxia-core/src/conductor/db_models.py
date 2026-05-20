"""
龙虾特战队 — 数据库驱动的多模型动态路由与密钥管理模块
(Database-driven Multi-Model Dynamic Routing & Secret Management)

核心设计理念 (KISS & First Principles):
1. 不建议用静态 env 文件存放明文 API Key 和静态模型配置。
2. env 文件仅保留主密钥 (LLM_ENCRYPTION_KEY)，用于加密数据库中存放的多模型 API Key。
3. 支持基于场景 (scenario) 的多模型动态分发与自动故障转移 (FallbackProvider)。
"""
import base64
import hashlib
import os
import sqlite3
from pathlib import Path
from typing import Optional, Tuple, List

from loguru import logger
from nanobot.config.schema import ModelPresetConfig
from nanobot.providers.base import LLMProvider, GenerationSettings
from nanobot.providers.fallback_provider import FallbackProvider
from nanobot.providers.registry import find_by_name

# ── 1. 标准无依赖加解密引擎 (Zero-Dependency PBKDF2 XOR Cipher) ──

def _derive_key(secret: str) -> bytes:
    return hashlib.sha256(secret.encode('utf-8')).digest()

def encrypt_api_key(plain_text: str, secret_key: str) -> str:
    if not plain_text:
        return ""
    key = _derive_key(secret_key)
    plain_bytes = plain_text.encode('utf-8')
    nonce = os.urandom(16)
    stream_key = hashlib.pbkdf2_hmac('sha256', key, nonce, 1000, len(plain_bytes))
    encrypted = bytes(p ^ s for p, s in zip(plain_bytes, stream_key))
    return base64.b64encode(nonce + encrypted).decode('utf-8')

def decrypt_api_key(cipher_text: str, secret_key: str) -> str:
    if not cipher_text:
        return ""
    try:
        data = base64.b64decode(cipher_text.encode('utf-8'))
        nonce, encrypted = data[:16], data[16:]
        key = _derive_key(secret_key)
        stream_key = hashlib.pbkdf2_hmac('sha256', key, nonce, 1000, len(encrypted))
        decrypted = bytes(c ^ s for c, s in zip(encrypted, stream_key))
        return decrypted.decode('utf-8')
    except Exception:
        return cipher_text  # fallback to plain if not encrypted or error


# ── 2. 数据库初始化与默认种子注入 (Database Seeding) ──

def get_default_db_path() -> str:
    return os.path.expanduser("~/Library/Application Support/LobsterAI/lobsterai.sqlite")

def get_encryption_key() -> str:
    # 优先从环境变量获取，若无则使用默认种子密钥
    return os.environ.get("LLM_ENCRYPTION_KEY", "lobster-super-secret-master-key-2026")

def init_models_db(db_path: Optional[str] = None, encryption_key: Optional[str] = None) -> None:
    db_path = db_path or get_default_db_path()
    encryption_key = encryption_key or get_encryption_key()
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    
    with sqlite3.connect(db_path) as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS llm_models_config (
                id TEXT PRIMARY KEY,
                scenario TEXT NOT NULL,
                model_name TEXT NOT NULL,
                provider_name TEXT NOT NULL,
                api_base TEXT,
                api_key_encrypted TEXT,
                max_tokens INTEGER DEFAULT 8192,
                temperature REAL DEFAULT 0.1,
                is_fallback BOOLEAN DEFAULT 0,
                priority INTEGER DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # 自动清理旧版本令人困惑的冗余多场景种子数据，仅保留或创建唯一的全局默认配置 (KISS 原则)
        cursor = conn.cursor()
        cursor.execute("DELETE FROM llm_models_config WHERE id IN ('cfg_cre_1', 'cfg_pr_1', 'cfg_tac_1', 'cfg_ver_1', 'cfg_def_2', 'cfg_def_3', 'cfg_def_1')")
        cursor.execute("SELECT COUNT(*) FROM llm_models_config WHERE scenario = 'default'")
        if cursor.fetchone()[0] == 0:
            logger.info("Initializing llm_models_config table with single clean global default configuration...")
            enc_key = encrypt_api_key(os.environ.get("ANTHROPIC_API_KEY", ""), encryption_key)
            conn.execute("""
                INSERT INTO llm_models_config (id, scenario, model_name, provider_name, api_base, api_key_encrypted, max_tokens, temperature, is_fallback, priority)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, ("cfg_global_default", "default", "anthropic/claude-3-5-sonnet", "anthropic", "https://api.anthropic.com", enc_key, 8192, 0.1, 0, 1))
        conn.commit()


# ── 3. 动态加载器与回退构造逻辑 (Dynamic Provider Loader) ──

def _create_single_provider(
    provider_name: str,
    model_name: str,
    api_key: Optional[str],
    api_base: Optional[str],
    max_tokens: int,
    temperature: float
) -> LLMProvider:
    spec = find_by_name(provider_name)
    backend = spec.backend if spec else "openai_compat"

    provider = None
    if backend == "anthropic":
        try:
            from nanobot.providers.anthropic_provider import AnthropicProvider
            provider = AnthropicProvider(
                api_key=api_key,
                api_base=api_base,
                default_model=model_name,
            )
        except ImportError:
            logger.warning("anthropic SDK 未安装，自动降级为 OpenAICompatProvider 驱动 Claude 模型")
            backend = "openai_compat"

    if backend == "bedrock":
        try:
            from nanobot.providers.bedrock_provider import BedrockProvider
            provider = BedrockProvider(
                api_key=api_key,
                api_base=api_base,
                default_model=model_name,
            )
        except ImportError:
            logger.warning("bedrock SDK 未安装，自动降级为 OpenAICompatProvider")
            backend = "openai_compat"

    if backend == "azure_openai":
        try:
            from nanobot.providers.azure_openai_provider import AzureOpenAIProvider
            provider = AzureOpenAIProvider(
                api_key=api_key,
                api_base=api_base,
                default_model=model_name,
            )
        except ImportError:
            logger.warning("azure SDK 未安装，自动降级为 OpenAICompatProvider")
            backend = "openai_compat"

    if provider is None:
        from nanobot.providers.openai_compat_provider import OpenAICompatProvider
        provider = OpenAICompatProvider(
            api_key=api_key,
            api_base=api_base,
            default_model=model_name,
            spec=spec,
        )

    provider.generation = GenerationSettings(
        temperature=temperature,
        max_tokens=max_tokens,
    )
    return provider

def load_provider_from_db(
    db_path: Optional[str] = None,
    encryption_key: Optional[str] = None,
    scenario: str = "default"
) -> Tuple[LLMProvider, str]:
    """从数据库按场景加载 Provider，支持主备自动故障转移"""
    db_path = db_path or get_default_db_path()
    encryption_key = encryption_key or get_encryption_key()

    with sqlite3.connect(db_path) as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT model_name, provider_name, api_base, api_key_encrypted, max_tokens, temperature, is_fallback
            FROM llm_models_config
            WHERE scenario = ?
            ORDER BY priority ASC
        """, (scenario,))
        rows = cursor.fetchall()

        if not rows and scenario != "default":
            logger.warning(f"Scenario '{scenario}' not found in llm_models_config, falling back to 'default'.")
            cursor.execute("""
                SELECT model_name, provider_name, api_base, api_key_encrypted, max_tokens, temperature, is_fallback
                FROM llm_models_config
                WHERE scenario = 'default'
                ORDER BY priority ASC
            """)
            rows = cursor.fetchall()

        if not rows:
            raise RuntimeError(f"No LLM configurations found in database ({db_path}) for scenario '{scenario}' or 'default'.")

    # 分离主模型和回退模型
    primary_row = rows[0]  # priority 最高的作为主模型
    fallback_rows = rows[1:]

    p_model, p_provider, p_base, p_enc_key, p_mt, p_temp, _ = primary_row
    p_key = decrypt_api_key(p_enc_key, encryption_key)
    primary_provider = _create_single_provider(p_provider, p_model, p_key, p_base, p_mt, p_temp)

    if not fallback_rows:
        return primary_provider, p_model

    # 构建回退预设列表
    fallback_presets = []
    for f_model, f_provider, f_base, f_enc_key, f_mt, f_temp, _ in fallback_rows:
        fallback_presets.append(ModelPresetConfig(
            model=f_model,
            provider=f_provider,
            max_tokens=f_mt,
            temperature=f_temp,
        ))

    def _fallback_factory(preset: ModelPresetConfig) -> LLMProvider:
        # 查询对应的 api_base 和 api_key
        with sqlite3.connect(db_path) as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT api_base, api_key_encrypted, max_tokens, temperature
                FROM llm_models_config
                WHERE scenario = ? AND model_name = ?
            """, (scenario, preset.model))
            res = cursor.fetchone()
            if not res and scenario != "default":
                cursor.execute("""
                    SELECT api_base, api_key_encrypted, max_tokens, scenario
                    FROM llm_models_config
                    WHERE scenario = 'default' AND model_name = ?
                """, (preset.model,))
                res = cursor.fetchone()
            
            if res:
                fb_base, fb_enc_key, fb_mt, fb_temp = res
                fb_key = decrypt_api_key(fb_enc_key, encryption_key)
            else:
                fb_base, fb_key, fb_mt, fb_temp = None, None, preset.max_tokens, preset.temperature
                
        return _create_single_provider(preset.provider, preset.model, fb_key, fb_base, fb_mt, fb_temp)

    wrapped_provider = FallbackProvider(
        primary=primary_provider,
        fallback_presets=fallback_presets,
        provider_factory=_fallback_factory,
    )
    return wrapped_provider, p_model
