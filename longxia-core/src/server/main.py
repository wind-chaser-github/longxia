"""
FastAPI 主服务 v2

核心修复（对比 v1 的 TODO 空洞）：
1. 全局单例 engine 实例 —— 解决 HITL Future 无法被外部引用的问题
2. /hitl/resume 路由真正调用 engine.resume()，不再是空占位
3. WebSocket 支持双向通信（前端可发送 hitl_approve 和 stop 指令）
4. 去掉 AgentRegistry/WorkflowRegistry（直接用 yaml.safe_load，无需注册机制）
"""
import asyncio
import json
import os
from contextlib import asynccontextmanager

# ── [V5 终极机甲：基因挂载] ──────────────────────────
try:
    from .. import bootstrap
except (ImportError, ValueError):
    import sys
    from pathlib import Path
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
    import bootstrap
# ──────────────────────────────────────────────────

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import sqlite3


from conductor.engine import LongxiaOrchestrator as OrchestrationEngine
from conductor.db_models import get_default_db_path, get_encryption_key, encrypt_api_key, decrypt_api_key



# ══════════════════════════════════════════════════════════════
# 全局单例 —— Engine 必须是单例才能被 HITL resume 路由引用
# ══════════════════════════════════════════════════════════════

_engine: OrchestrationEngine = None
_ws_manager = None
_outbound_task = None


async def outbound_dispatcher():
    """后台任务：持续从 engine.bus.consume_outbound() 获取底层 AgentLoop 消息并转译广播给前端"""
    while True:
        try:
            if _engine is None or _engine.bus is None:
                await asyncio.sleep(1)
                continue
            msg = await _engine.bus.consume_outbound()
            meta = msg.metadata or {}
            trace_id = msg.chat_id

            if meta.get("_stream_delta") and not meta.get("_stream_end"):
                await _ws_manager.broadcast({
                    "trace_id": trace_id,
                    "event_type": "STREAM_TEXT",
                    "payload": {"delta": msg.content}
                })
            elif meta.get("_turn_end"):
                await _ws_manager.broadcast({
                    "trace_id": trace_id,
                    "event_type": "WORKFLOW_END",
                    "payload": {}
                })
            elif meta.get("_progress"):
                agent_name = "龙虾专家网络"
                if meta.get("_tool_events"):
                    for ev in meta["_tool_events"]:
                        if ev.get("phase") == "start":
                            agent_name = ev.get("name", "专家智能体")
                            if agent_name == "spawn":
                                args = ev.get("arguments", {})
                                agent_name = args.get("label") or args.get("task", "")[:15] or "子领域专家"
                            await _ws_manager.broadcast({
                                "trace_id": trace_id,
                                "event_type": "AGENT_ACTIVATED",
                                "payload": {"agent": agent_name}
                            })
                            await _ws_manager.broadcast({
                                "trace_id": trace_id,
                                "event_type": "THINKING_START",
                                "payload": {"agent": agent_name}
                            })
                elif meta.get("_tool_hint") or meta.get("_tool_events"):
                    tool_list = meta.get("_tool_events") or []
                    tool_names = [t.get("tool") or t.get("name") or "通用工具" for t in tool_list]
                    if not tool_names and msg.content:
                        import re
                        m = re.search(r'\[(.*?)\]', msg.content)
                        tool_names = [m.group(1)] if m else ["底层系统工具"]
                    await _ws_manager.broadcast({
                        "trace_id": trace_id,
                        "event_type": "TOOL_CALL",
                        "payload": {
                            "tools": tool_names,
                            "details": msg.content or "正在执行底层工具链调用与深度计算验证..."
                        }
                    })
                elif meta.get("_reasoning_delta"):
                    await _ws_manager.broadcast({
                        "trace_id": trace_id,
                        "event_type": "THINKING_START",
                        "payload": {"agent": "龙虾特战队"}
                    })
            elif not meta.get("_stream_delta") and not meta.get("_stream_end") and msg.content:
                await _ws_manager.broadcast({
                    "trace_id": trace_id,
                    "event_type": "STREAM_TEXT",
                    "payload": {"delta": msg.content + "\n\n"}
                })
        except asyncio.CancelledError:
            break
        except Exception as e:
            print(f"⚠️ [Outbound Dispatcher] 异常: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """FastAPI lifespan 替代已废弃的 on_event('startup')"""
    global _engine, _ws_manager, _outbound_task

    _ws_manager = ConnectionManager()

    # 初始化 Eigent 生态工具
    try:
        from server.eigent_adapter import EigentAdapter
        EigentAdapter.load_all()
    except Exception as e:
        print(f"⚠️ [System] EigentAdapter 加载失败: {e}")

    # LongxiaOrchestrator 会自动从环境加载 provider，
    # 也可以手动传入。所有工具注册、技能加载、子代理管理
    # 都由父类 AgentLoop 自动处理。
    try:
        _engine = OrchestrationEngine(
            publish_event=_ws_manager.broadcast,
        )
        _outbound_task = asyncio.create_task(outbound_dispatcher())
    except RuntimeError as e:
        print(f"⚠️ [System] 引擎初始化失败: {e}")
        print("  请设置 ANTHROPIC_API_KEY 或 OPENAI_API_KEY 环境变量")
        _engine = None
        
    print("🦞 龙虾特战队核心引擎就绪")
    yield
    print("🦞 引擎关闭")
    if _outbound_task:
        _outbound_task.cancel()


app = FastAPI(title="Longxia Core API", version="2.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ══════════════════════════════════════════════════════════════
# WebSocket 连接池
# ══════════════════════════════════════════════════════════════

class ConnectionManager:
    def __init__(self):
        self.active: list[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.active.append(ws)

    def disconnect(self, ws: WebSocket):
        self.active.discard(ws) if hasattr(self.active, "discard") else (
            self.active.remove(ws) if ws in self.active else None
        )

    async def broadcast(self, message: dict):
        dead = []
        for ws in self.active:
            try:
                await ws.send_text(json.dumps(message, ensure_ascii=False))
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.active.remove(ws)


# ══════════════════════════════════════════════════════════════
# REST API
# ══════════════════════════════════════════════════════════════

class WorkflowStartRequest(BaseModel):
    workflow_id: str
    session_id: str
    initial_prompt: str
    custom_experts: list[str] | None = None


_engine_loop_task = None

@app.post("/api/v1/workflow/start")
async def start_workflow(req: WorkflowStartRequest):
    """触发工作流（异步后台执行，立刻返回）"""
    global _engine_loop_task
    
    if _engine is None:
        return {"status": "error", "message": "引擎未初始化，请检查 API Key 配置"}
    
    # 确保 AgentLoop 的消息消费循环已启动（仅首次）
    if _engine_loop_task is None or _engine_loop_task.done():
        _engine_loop_task = asyncio.create_task(_engine.run())
    
    # 将工作流指令推入总线，由 AgentLoop.run() 自动消费和调度
    asyncio.create_task(
        _engine.run_workflow(req.workflow_id, req.session_id, req.initial_prompt, custom_experts=req.custom_experts)
    )
    return {"status": "started", "session_id": req.session_id}


@app.post("/api/v1/workflow/{session_id}/hitl/resume")
async def resume_workflow(session_id: str):
    """
    导演在大屏点击"放行" —— 真正调用 engine.resume() 释放 asyncio.Future。
    （v1 这里是 TODO 占位，v2 彻底打通）
    """
    await _engine.resume(session_id)
    return {"status": "resumed", "session_id": session_id}


class ModelConfigItem(BaseModel):
    id: str
    scenario: str
    model_name: str
    provider_name: str
    api_base: str = ""
    api_key: str = ""
    max_tokens: int = 8192
    temperature: float = 0.1
    is_fallback: bool = False
    priority: int = 1


@app.get("/api/v1/models/config")
async def get_models_config():
    """获取所有模型配置列表（解密 API Key 以明文返回供前端查看/编辑）"""
    db_path = get_default_db_path()
    encryption_key = get_encryption_key()
    if not os.path.exists(db_path):
        from conductor.db_models import init_models_db
        init_models_db(db_path, encryption_key)

    configs = []
    with sqlite3.connect(db_path) as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, scenario, model_name, provider_name, api_base, api_key_encrypted, max_tokens, temperature, is_fallback, priority
            FROM llm_models_config
            ORDER BY scenario, priority
        """)
        for row in cursor.fetchall():
            id_, sc, mn, pn, base, enc_key, mt, temp, fb, pri = row
            dec_key = decrypt_api_key(enc_key, encryption_key) if enc_key else ""
            configs.append({
                "id": id_,
                "scenario": sc,
                "model_name": mn,
                "provider_name": pn,
                "api_base": base or "",
                "api_key": dec_key,
                "max_tokens": mt,
                "temperature": temp,
                "is_fallback": bool(fb),
                "priority": pri
            })
    return {"status": "ok", "configs": configs}


@app.post("/api/v1/models/config")
async def save_model_config(item: ModelConfigItem):
    """添加或更新模型配置"""
    db_path = get_default_db_path()
    encryption_key = get_encryption_key()
    enc_key = encrypt_api_key(item.api_key, encryption_key) if item.api_key else ""

    with sqlite3.connect(db_path) as conn:
        conn.execute("""
            INSERT INTO llm_models_config (id, scenario, model_name, provider_name, api_base, api_key_encrypted, max_tokens, temperature, is_fallback, priority)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                scenario=excluded.scenario,
                model_name=excluded.model_name,
                provider_name=excluded.provider_name,
                api_base=excluded.api_base,
                api_key_encrypted=excluded.api_key_encrypted,
                max_tokens=excluded.max_tokens,
                temperature=excluded.temperature,
                is_fallback=excluded.is_fallback,
                priority=excluded.priority
        """, (item.id, item.scenario, item.model_name, item.provider_name, item.api_base, enc_key, item.max_tokens, item.temperature, int(item.is_fallback), item.priority))
        conn.commit()
    return {"status": "ok", "id": item.id}


@app.delete("/api/v1/models/config/{config_id}")
async def delete_model_config(config_id: str):
    """删除指定模型配置"""
    db_path = get_default_db_path()
    with sqlite3.connect(db_path) as conn:
        conn.execute("DELETE FROM llm_models_config WHERE id = ?", (config_id,))
        conn.commit()
    return {"status": "ok", "id": config_id}


class ExpertCreateRequest(BaseModel):
    agent_id: str
    name: str
    role_description: str
    system_prompt: str
    llm_requirement: str = "default"
    skills_allowed: list[str] = []


@app.post("/api/v1/experts")
async def save_expert(req: ExpertCreateRequest):
    import yaml
    os.makedirs("configs/agents", exist_ok=True)
    filepath = os.path.join("configs/agents", f"{req.agent_id}.yaml")
    data = {
        "agent_id": req.agent_id,
        "name": req.name,
        "role_description": req.role_description,
        "system_prompt": req.system_prompt,
        "llm_requirement": req.llm_requirement,
        "skills_allowed": req.skills_allowed
    }
    with open(filepath, 'w', encoding='utf-8') as f:
        yaml.dump(data, f, allow_unicode=True, sort_keys=False)
    from loaders.agent_loader import AgentRegistry
    AgentRegistry.load_from_directory("configs/agents")
    return {"status": "ok", "agent_id": req.agent_id}


@app.delete("/api/v1/experts/{agent_id}")
async def delete_expert(agent_id: str):
    filepath = os.path.join("configs/agents", f"{agent_id}.yaml")
    if os.path.exists(filepath):
        os.remove(filepath)
    from loaders.agent_loader import AgentRegistry
    if agent_id in AgentRegistry._agents:
        del AgentRegistry._agents[agent_id]
    return {"status": "ok", "agent_id": agent_id}


@app.get("/api/v1/tasks/history")
async def get_task_history():
    """获取所有历史编排会话记录列表"""
    db_path = get_default_db_path()
    history = []
    if os.path.exists(db_path):
        try:
            with sqlite3.connect(db_path) as conn:
                cursor = conn.cursor()
                # 优先获取 user 提问作为标题预览，确保列表清晰展示调研主题
                cursor.execute("""
                    SELECT session_id, min(created_at), substr(content, 1, 80)
                    FROM cowork_messages
                    WHERE type = 'user' AND content IS NOT NULL AND content != ''
                    GROUP BY session_id
                    ORDER BY min(created_at) DESC
                    LIMIT 50
                """)
                for row in cursor.fetchall():
                    sess_id, created, preview = row
                    history.append({
                        "session_id": sess_id,
                        "created_at": created,
                        "preview": preview + "..."
                    })
        except Exception as e:
            print(f"⚠️ 拉取任务历史记录失败: {e}")
    return {"status": "ok", "history": history}


@app.get("/api/v1/tasks/history/{session_id}")
async def get_task_detail(session_id: str):
    """获取指定会话的完整推演与最终交付物内容"""
    import re
    db_path = get_default_db_path()
    messages = []
    if os.path.exists(db_path):
        try:
            with sqlite3.connect(db_path) as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    SELECT type, content, created_at
                    FROM cowork_messages
                    WHERE session_id = ?
                    ORDER BY created_at ASC
                """, (session_id,))
                for row in cursor.fetchall():
                    type_, content, created = row
                    if type_ == 'assistant' and ('保存到本地' in content or '存储路径' in content or '.md' in content):
                        match = re.search(r'(/Users/[^\s*`)]+?\.md|[^\s*`)]+?\.md)', content)
                        if match:
                            file_path = match.group(1)
                            if not os.path.isabs(file_path):
                                file_path = os.path.join(os.getcwd(), file_path)
                            if os.path.exists(file_path):
                                try:
                                    with open(file_path, 'r', encoding='utf-8') as f:
                                        file_content = f.read()
                                        content = f"{content}\n\n# 📦 终极调研产物 ( Deliverables & Attachments )\n\n{file_content}"
                                except Exception as fe:
                                    print(f"⚠️ 读取本地报告文件失败: {fe}")
                    
                    # 将所有绝对路径 /Users/.../.nanobot/media/ 替换为全功能绝对挂载路径 http://localhost:8080/media/ (完美兼容 file:/// 协议与同源访问)
                    content = re.sub(r'/Users/[^\s*`)]+?/\.nanobot/media/', 'http://localhost:8080/media/', content)
                    
                    messages.append({
                        "type": type_,
                        "content": content,
                        "created_at": created
                    })
        except Exception as e:
            print(f"⚠️ 拉取任务详情失败: {e}")
    return {"status": "ok", "session_id": session_id, "messages": messages}


@app.get("/api/v1/artifacts/download/{session_id}")
async def download_artifacts(session_id: str):
    """打包下载指定会话产生的调研产物文件与完整推演报告"""
    from fastapi import Response
    import io
    import zipfile
    import re
    
    db_path = get_default_db_path()
    messages = []
    if os.path.exists(db_path):
        try:
            with sqlite3.connect(db_path) as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    SELECT content
                    FROM cowork_messages
                    WHERE session_id = ? AND type = 'assistant'
                    ORDER BY created_at ASC
                """, (session_id,))
                for row in cursor.fetchall():
                    if row[0]:
                        messages.append(row[0])
        except Exception as e:
            print(f"⚠️ 拉取产物详情失败: {e}")

    full_trace = "\n\n".join(messages)
    
    report_content = ""
    report_filename = "ai-agent-research-report.md"
    
    for msg in messages:
        if ('保存到本地' in msg or '存储路径' in msg or '.md' in msg):
            match = re.search(r'(/Users/[^\s*`)]+?\.md|[^\s*`)]+?\.md)', msg)
            if match:
                file_path = match.group(1)
                if not os.path.isabs(file_path):
                    file_path = os.path.join(os.getcwd(), file_path)
                if os.path.exists(file_path):
                    try:
                        with open(file_path, 'r', encoding='utf-8') as f:
                            report_content = f.read()
                            report_filename = os.path.basename(file_path)
                            break
                    except Exception as fe:
                        print(f"⚠️ 读取本地报告文件失败: {fe}")
        elif "ai-agent-research-report.md" in msg or "终极调研产物" in msg or "# 📦" in msg:
            report_content = msg
            break

    if not report_content and messages:
        report_content = messages[-1]

    # 将所有绝对路径 /Users/.../.nanobot/media/ 替换为带有主服务端口的绝对地址 http://localhost:8080/media/
    report_content = re.sub(r'/Users/[^\s*`)]+?/\.nanobot/media/', 'http://localhost:8080/media/', report_content)
    full_trace = re.sub(r'/Users/[^\s*`)]+?/\.nanobot/media/', 'http://localhost:8080/media/', full_trace)

    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
        zip_file.writestr("execution_trace.md", full_trace or "暂无推演记录")
        zip_file.writestr(report_filename, report_content or "暂无产物报告")
        if report_filename != "ai-agent-research-report.md":
            zip_file.writestr("ai-agent-research-report.md", report_content or "暂无产物报告")
        zip_file.writestr("README.txt", f"龙虾智能体操作系统 (Longxia OS) - 产物包\n会话ID: {session_id}\n包含完整推演链路与终极Markdown交付物。")

    zip_buffer.seek(0)
    return Response(
        content=zip_buffer.getvalue(),
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename={session_id}-deliverables.zip"}
    )


@app.get("/api/v1/experts")
async def get_experts():
    """获取所有动态加载的专家团队配置（实时扫描 configs/agents 目录）"""
    from loaders.agent_loader import AgentRegistry
    import yaml
    os.makedirs("configs/agents", exist_ok=True)

    # 确保基础 6 大特战专家 YAML 存在
    defaults = [
        {
            "agent_id": "lobster_governor",
            "name": "总督阁下 (Supreme Governor)",
            "role_description": "统揽全局的最高决策者，负责接收指挥官下达的宏观指令，进行深度需求拆解、全盘推演与任务编排分派。",
            "system_prompt": "你是龙虾特战队（WorkBuddy 编排中枢）的最高总督阁下。作为统揽全局的最高决策者，接到指挥官指令后必须首先进行深刻的【需求分析】，挖掘核心业务诉求与潜在风险；其次输出结构清晰的【执行计划】，将宏观目标拆解为具体子任务并指派下级参谋。最终汇总响应务必使用优雅 Markdown 语法排版，包含清晰多级标题与多维对比表格，保持威严果断，严禁废话。",
            "llm_requirement": "default",
            "skills_allowed": ["spawn", "message"]
        },
        {
            "agent_id": "lobster_pr",
            "name": "公关参谋 (社交龙虾)",
            "role_description": "专门处理外部网络舆情、全网深度检索与社交媒体沟通的公关大师，确保对外发声的精准与专业。",
            "system_prompt": "你是龙虾特战队的资深公关参谋与全网信息情报专家。接到指令后立即调用外部搜索工具进行多轮次信息捕获；对搜集到的数据展开【需求分析】与【舆情洞察】，精准提取核心矛盾点与公众情绪；以极具同理心与公信力语言草拟声明或竞品对比，并采用标准 Markdown 格式交付精美对比表格与时间线。",
            "llm_requirement": "pr_expert",
            "skills_allowed": ["web_search", "slack", "web_fetch"]
        },
        {
            "agent_id": "lobster_verifier",
            "name": "无情裁决器 (Ruthless Verifier)",
            "role_description": "冷酷无情的法官与风控守护者，负责对所有输出声明与代码方案进行致命风险拦截与协同阻断 (HITL)。",
            "system_prompt": "你是龙虾特战队中不可被欺骗、冷酷无情的裁决器。以最严苛法眼审视上游专家团生成的所有公文与代码；深入查找任何潜在法律合规漏洞、自相矛盾或次生风险；一旦发现致命缺陷立即驳回或触发协同阻断挂起机制等待人工终审；以条理分明 Markdown 格式输出风险评估与整改清单。",
            "llm_requirement": "verifier",
            "skills_allowed": ["manual_approve"]
        },
        {
            "agent_id": "lobster_tactical",
            "name": "战术参谋 (Tactical Planner)",
            "role_description": "精通沙盘推演、系统架构检索与多路径执行预案生成的战术大师，保障特战行动的无懈可击。",
            "system_prompt": "你是龙虾特战队的高阶战术参谋与沙盘推演大师。接到战术编排指令后善用文件检索工具深度探查代码库；基于勘测事实展开【需求分析】，生成包含 Plan A、Plan B 及极端底线 Plan C 的多路径执行策略；采用工业级 Markdown 语法排版步骤拆解与资源消耗评估表。",
            "llm_requirement": "tactical_planner",
            "skills_allowed": ["read_file", "list_dir", "grep"]
        },
        {
            "agent_id": "lobster_creative",
            "name": "创意文案参谋 (Creative Writer)",
            "role_description": "具备高发散思维与情绪共鸣能力的文案大师，负责撰写极具传播力、感染力与美学价值的对外文案。",
            "system_prompt": "你是龙虾特战队的首席创意文案参谋与品牌美学大师。深入揣摩目标受众心理诉求，跳出传统思维框架，以极富感染力与情绪共鸣的笔触构思故事线；熟练运用 Markdown 引用区块与精心调配的标题层级，让每一篇文案都成为令人赞叹的艺术品。",
            "llm_requirement": "creative_writer",
            "skills_allowed": ["edit_file", "write_file"]
        },
        {
            "agent_id": "lobster_schedule",
            "name": "极限行程调度官 (Schedule Manager)",
            "role_description": "擅长多线并发管理、资源冲突化解与时间窗口计算的日程专家，确保所有行动严丝合缝。",
            "system_prompt": "你是龙虾特战队的极限行程调度官与资源运筹专家。面对复杂排期与会议冲突，精准计算时间窗口与关键路径；以最优化算法化解多线并发带来的资源抢占，确保团队运作高效丝滑；输出排版精良、一目了然的 Markdown 行程甘特图表或任务时间线。",
            "llm_requirement": "default",
            "skills_allowed": ["exec", "glob"]
        }
    ]
    for d in defaults:
        fp = os.path.join("configs/agents", f"{d['agent_id']}.yaml")
        if not os.path.exists(fp):
            with open(fp, 'w', encoding='utf-8') as f:
                yaml.dump(d, f, allow_unicode=True, sort_keys=False)

    AgentRegistry.load_from_directory("configs/agents")

    icon_map = {
        "lobster_governor": "🦞",
        "lobster_pr": "🦚",
        "lobster_verifier": "⚖️",
        "lobster_tactical": "🛰️",
        "lobster_creative": "🎨",
        "lobster_schedule": "📅",
        "lobster_bi": "📊",
        "lobster_coder": "💻",
        "lobster_finance": "💰",
        "lobster_hr": "👥",
        "lobster_seo": "🚀",
        "lobster_legal": "📜",
        "lobster_uiux": "✨",
        "lobster_community": "🔥",
        "lobster_global": "🌍"
    }

    res = []
    for cfg in AgentRegistry.list_all():
        res.append({
            "id": cfg.agent_id,
            "name": cfg.name,
            "title_en": cfg.agent_id,
            "icon": icon_map.get(cfg.agent_id, "🤖"),
            "scenario": cfg.llm_requirement,
            "description": cfg.role_description,
            "system_prompt": cfg.system_prompt,
            "skills": cfg.skills_allowed
        })
    return {"status": "ok", "experts": res}


@app.get("/api/v1/skills")
async def get_skills():
    """获取所有从 OpenClaw 生态及 Eigent 挂载的技能插件库"""
    from loaders.skill_adapter import SkillAdapter
    base_path = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    skills_dir = os.path.join(base_path, "plugins", "openclaw_skills")
    
    loaded_skills = SkillAdapter.load_all_skills(skills_dir)
    skills_list = []
    for name, schema in loaded_skills.items():
        skills_list.append({
            "name": name,
            "description": schema.get("function", {}).get("description", ""),
            "parameters": schema.get("function", {}).get("parameters", {}),
            "instructions": schema.get("instructions", "")
        })
    
    # 补充已注册的 Eigent / OS 级内置基础工具
    builtin_tools = [
        {"name": "edit_file", "description": "编辑并修改本地文件内容", "parameters": {"type": "object", "properties": {"path": {"type": "string"}, "content": {"type": "string"}}}, "instructions": "直接修改指定路径的文件内容"},
        {"name": "exec", "description": "在沙盒终端中执行系统命令", "parameters": {"type": "object", "properties": {"command": {"type": "string"}}}, "instructions": "运行指定的 bash/zsh 命令并捕获输出"},
        {"name": "web_search", "description": "调用 DuckDuckGo/Google 进行全网搜索引擎检索", "parameters": {"type": "object", "properties": {"query": {"type": "string"}}}, "instructions": "获取最新公共网络资讯与舆情数据"},
        {"name": "web_fetch", "description": "抓取指定 URL 的网页正文内容并转为 Markdown", "parameters": {"type": "object", "properties": {"url": {"type": "string"}}}, "instructions": "高效提取指定网页的纯文本内容"},
        {"name": "list_dir", "description": "列出指定目录下的所有文件与子目录结构", "parameters": {"type": "object", "properties": {"path": {"type": "string"}}}, "instructions": "分析项目目录结构与层级关系"},
        {"name": "grep", "description": "使用正则表达式在文件或目录中搜索文本", "parameters": {"type": "object", "properties": {"pattern": {"type": "string"}, "path": {"type": "string"}}}, "instructions": "快速定位代码库中的特定变量或函数定义"}
    ]
    
    all_skills = skills_list + builtin_tools
    return {"status": "ok", "skills": all_skills}


@app.get("/api/v1/tools")
async def get_tools():
    """获取龙虾特战队底层编排引擎注册的 12 大原生工具链定义 (Native Tools)"""
    native_tools = [
        {
            "tool_id": "web_search",
            "name": "全网深度搜索引擎 (Web Search)",
            "category": "全网情报检索",
            "description": "调用 DuckDuckGo/Google 外部搜索接口捕获全网最新资讯、竞品动态及行业研报，支持自动提炼摘要与多源交叉验证。",
            "parameters": {"query": "搜索关键词字符串", "max_results": "返回的最大条目数 (默认10)"},
            "instructions": "当接到事实核查或竞品调研任务时首选此工具，获取外部客观数据。"
        },
        {
            "tool_id": "web_fetch",
            "name": "指定网页深度抓取器 (Web Fetch)",
            "category": "全网情报检索",
            "description": "抓取指定 URL 目标网页的正文 DOM 结构，自动剥离广告与冗余标签并转换为结构化 Markdown 文本。",
            "parameters": {"url": "目标网页的完整 HTTP/HTTPS 链接"},
            "instructions": "配合 web_search 使用，深入单篇研报或官方公告获取完整正文内容。"
        },
        {
            "tool_id": "read_file",
            "name": "本地文件读取器 (Read File)",
            "category": "底层系统勘测",
            "description": "高效读取本地代码库或知识工程目录下的指定文件内容，自动解析编码格式。",
            "parameters": {"path": "目标文件的相对或绝对路径"},
            "instructions": "用于获取本地已存储的架构设计、历史日志或配置文件。"
        },
        {
            "tool_id": "list_dir",
            "name": "目录树拓扑扫描器 (List Directory)",
            "category": "底层系统勘测",
            "description": "扫描并列出指定路径下的所有文件与子目录层级结构，支持递归计算文件大小。",
            "parameters": {"path": "目标目录路径 (默认根目录)"},
            "instructions": "在重构或排查项目结构时，首选此工具建立全盘拓扑认知。"
        },
        {
            "tool_id": "grep",
            "name": "高阶正则文本匹配器 (Grep Search)",
            "category": "底层系统勘测",
            "description": "使用高性能正则表达式在整个项目或指定目录树中精准匹配变量名、函数定义及错误日志。",
            "parameters": {"pattern": "正则表达式或关键词", "path": "搜索的目标目录或文件"},
            "instructions": "极速定位系统报错位置与关键函数声明。"
        },
        {
            "tool_id": "edit_file",
            "name": "本地文件差异补丁器 (Edit File)",
            "category": "工程文件操作",
            "description": "对指定的本地文件进行精确的多行差异替换或内容修改，确保代码或文案无缝更新。",
            "parameters": {"path": "目标文件路径", "content": "修改后的完整或局部替换内容"},
            "instructions": "当需要修复 Bug、修改文案或更新配置时调用。"
        },
        {
            "tool_id": "write_file",
            "name": "新文件创建与覆写器 (Write File)",
            "category": "工程文件操作",
            "description": "在指定目录下创建全新的文件或全量覆写已有文件内容，支持多级父目录自动生成。",
            "parameters": {"path": "新文件路径", "content": "要写入的完整文件内容"},
            "instructions": "用于输出最终的 Markdown 调研报告或生成新代码文件。"
        },
        {
            "tool_id": "exec",
            "name": "沙盒终端命令执行器 (Exec Command)",
            "category": "沙盒终端交互",
            "description": "在受控的沙盒终端环境中执行系统级 bash/zsh 脚本命令，实时捕获标准输出与错误流。",
            "parameters": {"command": "要执行的命令行字符串"},
            "instructions": "用于执行构建脚本、运行单元测试或动态环境探查。"
        },
        {
            "tool_id": "manual_approve",
            "name": "协同阻断与人工终审器 (HITL Approve)",
            "category": "协同风控阻断",
            "description": "主动触发协同阻断挂起机制 (Human-in-the-loop)，暂停当前智能体工作流，等待指挥官在大屏端授权放行。",
            "parameters": {"reason": "触发阻断的具体风险原因或审核说明"},
            "instructions": "在遇到高危操作、法律敏感条款或重大业务决策点时强制调用。"
        },
        {
            "tool_id": "spawn",
            "name": "子领域专家动态生成器 (Spawn Expert)",
            "category": "多智能体编排",
            "description": "在运行态动态克隆或派生出一个全新的子领域专家参谋，并赋予专属系统提示词与技能清单。",
            "parameters": {"agent_id": "新智能体标识", "system_prompt": "专属提示词", "skills": "技能列表"},
            "instructions": "当现有特战队专家无法覆盖新出现的复杂子任务时调用。"
        },
        {
            "tool_id": "message",
            "name": "跨智能体神经通讯总线 (Message Bus)",
            "category": "多智能体编排",
            "description": "在不同的专家参谋之间传递结构化推演结论与中间态数据，实现无缝的异步协同。",
            "parameters": {"target": "目标专家 ID", "content": "传递的信息内容"},
            "instructions": "用于多智能体之间的协作分工与成果汇聚。"
        },
        {
            "tool_id": "slack",
            "name": "Slack 企业级通讯总线 (Slack Bus)",
            "category": "外部通讯总线",
            "description": "连接 Slack 企业通讯渠道，读取频道历史消息记录或向指定频道广播危机预警公告。",
            "parameters": {"channel": "频道名称", "message": "公告内容"},
            "instructions": "用于外部团队沟通与预警广播。"
        }
    ]
    return {"status": "ok", "tools": native_tools}


@app.get("/api/v1/health")
async def health():
    return {"status": "ok", "engine": "OrchestrationEngine v2"}


@app.get("/api/file/content")
@app.get("/api/v1/file/content")
async def get_file_content(path: str):
    """读取生成在本地的任意交付物文件内容（支持绝对路径或相对项目根目录路径）"""
    try:
        root_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        if not os.path.isabs(path):
            target_path = os.path.join(root_dir, path)
        else:
            target_path = path
            
        if not os.path.exists(target_path):
            raise HTTPException(status_code=404, detail=f"文件不存在: {path}")
            
        with open(target_path, "r", encoding="utf-8") as f:
            content = f.read()
        return {"path": target_path, "content": content}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/file/download")
@app.get("/api/v1/file/download")
async def download_file(path: str):
    """读取并返回本地任意二进制文件/图片流（解决绝对路径突破沙盒限制的痛点）"""
    try:
        from fastapi.responses import FileResponse
        root_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        if not os.path.isabs(path):
            target_path = os.path.join(root_dir, path)
        else:
            target_path = path
            
        if not os.path.exists(target_path):
            raise HTTPException(status_code=404, detail=f"文件不存在: {path}")
            
        return FileResponse(target_path)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))




# ══════════════════════════════════════════════════════════════
# WebSocket 双向通道
# ══════════════════════════════════════════════════════════════

@app.websocket("/ws/events")
async def websocket_endpoint(websocket: WebSocket):
    """
    双向 WebSocket：
    - 服务端 → 前端：THINKING_START / STREAM_TEXT / HITL_SUSPEND / WORKFLOW_END 等事件
    - 前端 → 服务端：{"action": "ping"} / {"action": "hitl_approve", "session_id": "xxx"} 或 {"action": "stop"}
    """
    await _ws_manager.connect(websocket)
    try:
        while True:
            raw = await websocket.receive_text()
            try:
                msg = json.loads(raw)
                action = msg.get("action")
                if action == "ping":
                    await websocket.send_text(json.dumps({"event": "pong", "timestamp": msg.get("timestamp")}))
                elif action == "hitl_approve":
                    session_id = msg.get("session_id", "")
                    await _engine.resume(session_id)
                elif action == "stop":
                    await websocket.send_text(json.dumps({"event": "stop_ack"}))
            except json.JSONDecodeError:
                pass
    except WebSocketDisconnect:
        _ws_manager.disconnect(websocket)


# 挂载后端生成的媒体资源目录（使前端可通过 /media/generated/... 访问本地生成的琉璃质感配图）
from nanobot.config.paths import get_media_dir
media_dir = get_media_dir().resolve()
if not os.path.exists(media_dir):
    os.makedirs(media_dir, exist_ok=True)
app.mount("/media", StaticFiles(directory=media_dir), name="media")

# 挂载前端静态文件（将 frontend 目录挂载到根路径，提供完整的大屏及配置界面）
frontend_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "frontend")
if os.path.exists(frontend_dir):
    app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="frontend")



if __name__ == "__main__":
    import uvicorn
    # 使用相对模块路径启动
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", "8080")),
        reload=True,
    )
