"""
龙虾 OS — 工业级顶配多智能体接力协同 E2E 深度全景验证
(Premium Industrial-Grade Multi-Agent Orchestration & Artifact Seeding)

专门用于生成媲美乃至超越 WorkBuddy 顶配企业级水准的万字深度研报与多维图表，
并在 SQLite 数据库中完成全景沉淀，为前端大屏提供极为震撼的视觉与内容体验。
"""
import asyncio
import os
import sqlite3
import time
import uuid
import bootstrap
from conductor.engine import LongxiaOrchestrator
from nanobot.providers.base import LLMResponse, LLMProvider, GenerationSettings

class PremiumIndustrialProvider(LLMProvider):
    def __init__(self):
        super().__init__(api_key="premium-industrial-key")
        self.generation = GenerationSettings()
        self.turn = 0
    
    def get_default_model(self) -> str:
        return "lobster-ultra-industrial-v1"
    
    async def chat(self, **kwargs) -> LLMResponse:
        self.turn += 1
        if self.turn == 1:
            content = (
                "需求分析：接到指挥官下达的战略级调研指令，要求对当前全球顶尖的 AI Agent 操作系统与多智能体编排框架（包括 LangGraph、CrewAI、PraisonAI 及龙虾 OS 本地内核）展开深度架构解构与选型评估。\n"
                "潜在风险评估：开源生态演进极快，需避免单纯依赖过时文档；必须结合底层沙盒探查与外部实时资讯交叉比对，确保技术判断的绝对精准与前瞻性。\n"
                "执行计划：\n"
                "1. 启动跨域协同调研矩阵。首先派生公关参谋 (社交龙虾) 调用外部网络搜索接口捕获全网最新星标热度与开发者生态数据；\n"
                "2. 指派战术参谋 (Tactical Planner) 调用本地沙盒勘测工具 (grep/read_file) 深度剖析本地 Conductor 神经消息总线与底层状态循环源码；\n"
                "3. 汇总全域数据，交由无情裁决器 (Ruthless Verifier) 进行风控合规终审与终极产物包封装。\n"
                "执行：[spawn] 派生公关参谋与战术参谋进行双线并发数据捕获与沙盒勘测。\n\n"
                "# 🦞 龙虾 OS - 战略级多智能体协同编排书与全景需求解构 (Strategic Orchestration Plan)\n\n"
                "随着大语言模型从单一对话向复杂自主智能体形态演进，企业级 AI 架构的核心诉求已从单纯的 Prompt 工程转向**高并发多智能体编排、底层沙盒安全调度及协同风控阻断 (Human-in-the-loop)**。\n\n"
                "本编排书旨在拉动龙虾特战队全域专家网络，深度解构全球主流开源框架的核心底层逻辑，并与龙虾 OS 的自主内核展开全维度对比，为指挥官的下一代技术演进提供坚实底座。"
            )
        elif self.turn == 2:
            content = (
                "需求分析：奉总督阁下指令，需对外部开源 Agent 框架生态展开实时情报捕获与多源交叉验证，确保底层数据的客观与鲜活。\n"
                "执行计划：调用 web_search 检索 2026 最新行业研报与开发者论坛评测；调用 web_fetch 提取核心框架的官方架构白皮书正文。\n"
                "执行：[web_search] 检索 2026 全球开源多智能体框架生态演进与评测数据；[web_fetch] 抓取 GitHub 趋势榜单及核心白皮书深度指标。\n\n"
                "## 🌐 全球开源 Agent 框架全景市场情报与开发者生态速递 (Global Market Intelligence)\n\n"
                "经过对 DuckDuckGo 与各大开源社区深度检索及交叉数据清洗，当前全球主流多智能体框架呈现出截然不同的架构流派与生态位分布：\n\n"
                "| 框架名称 | GitHub Stars | 核心架构特征 | 状态管理机制 | HITL 协同阻断支持 | 生产级部署就绪度 |\n"
                "| :--- | :--- | :--- | :--- | :--- | :--- |\n"
                "| **LangGraph** | 38.5k | 循环图状态机 (StateGraph) | 基于 Channels 的持久化快照 | 强 (原生支持中断与状态恢复) | 高 (深度绑定 LangChain 生态) |\n"
                "| **CrewAI** | 22.1k | 角色扮演与层级委派模式 | 内存级任务流水线传递 | 中 (依赖人工介入回调函数) | 中高 (适合快速业务流搭建) |\n"
                "| **PraisonAI** | 15.4k | YAML 声明式低代码驱动 | 极简上下文共享机制 | 弱 (主要依赖单轮次问答阻断) | 中 (适合敏捷微服务化包装) |\n"
                "| **AutoGen v2** | 29.8k | 异步消息驱动 Actor 模型 | 基于事件循环的消息广播 | 强 (支持自定义 Speaker 拦截) | 高 (适合复杂异步多节点推演) |\n"
                "| **龙虾 OS** | **内核独创** | **薄层总线 + 原生沙盒工具链** | **双向持久化与心跳保活引擎** | **极致 (大屏红色警报与远程放行)** | **极高 (工业级零依赖安全加密)** |\n\n"
                "**生态洞察总结**：当前行业正经历从声明式流水线 (CrewAI/PraisonAI) 向图状态机 (LangGraph) 的深度跃迁，而龙虾 OS 则通过极薄的编排总线与底层沙盒解耦，完美兼顾了高定制性与极致风控。"
            )
        elif self.turn == 3:
            content = (
                "需求分析：需基于外部竞品情报，结合本地代码库勘测事实，展开深度架构解耦与底层机制比对。\n"
                "执行计划：调用 grep 检索本地事件循环与总线机制 (`_dispatch`, `MessageBus`)；调用 read_file 读取 `src/conductor/engine.py` 核心调度源码；绘制多维对比象限图与底层状态机流转图。\n"
                "执行：[grep] 检索本地 Conductor 神经消息总线与心跳保活实现；[read_file] 读取 src/conductor/engine.py 核心状态机调度与挂起放行管线。\n\n"
                "## 🏰 龙虾 OS 底层内核架构与全球竞品深度剖析 (Architectural Deep Dive & Comparison)\n\n"
                "在深入比对了本地 `src/conductor/engine.py` 源码与各大竞品底层后，我们发现龙虾 OS 的核心壁垒在于其**基于第一性原理构建的异步事件循环 (AgentLoop)**。该循环彻底摒弃了臃肿的中间件抽象，直接以最小化开销驱动底层沙盒与 WebSocket 总线。\n\n"
                "```mermaid\n"
                "quadrantChart\n"
                "    title 全球多智能体框架成熟度与定制灵活性全景评估\n"
                "    x-axis 低度定制封装 --> 深度内核完全掌控\n"
                "    y-axis 单一剧本流转 --> 复杂工业级协同阻断\n"
                "    quadrant-1 工业级领跑者\n"
                "    quadrant-2 敏捷原型工具\n"
                "    quadrant-3 基础实验玩具\n"
                "    quadrant-4 底层硬核引擎\n"
                "    \"LangGraph\": [0.68, 0.82]\n"
                "    \"CrewAI\": [0.45, 0.72]\n"
                "    \"PraisonAI\": [0.38, 0.58]\n"
                "    \"AutoGen v2\": [0.75, 0.65]\n"
                "    \"龙虾 OS (Lobster OS)\": [0.95, 0.96]\n"
                "```\n\n"
                "### 底层状态机流转架构\n\n"
                "龙虾 OS 的每一次推演均严格遵循从快照恢复到工具执行、协同挂起再到大屏广播的闭环管线：\n\n"
                "```mermaid\n"
                "graph TD\n"
                "    A[指挥官下达指令] -->|InboundMessage| B(Conductor 神经消息总线)\n"
                "    B --> C{AgentLoop 状态机引擎}\n"
                "    C -->|_state_restore| D[检查运行态快照与会话记忆]\n"
                "    C -->|_state_think| E[专家智能体多模态思考与 CoT]\n"
                "    E -->|触发沙盒工具| F[SubagentManager 动态克隆派生]\n"
                "    F -->|执行结果注入| C\n"
                "    C -->|触发协同阻断| G[HITL 挂起等待导演大屏授权]\n"
                "    G -->|放行 / 恢复| H[OutboundMessage 广播与最终成果交付]\n"
                "```\n\n"
                "已完成深度技术剖析与拓扑图谱构建，移交无情裁决器进行最终合规风控与交付物全量落盘。"
            )
        else:
            content = (
                "需求分析：接收全域调研报告与架构对比图谱，需进行严格的风控合规审查与终极交付物封装。\n"
                "风控审查：核查数据引用来源是否真实、是否存在版权冲突及潜在次生风险。经审查，全栈数据交叉验证无误，架构对比逻辑严密，符合龙虾特战队 P0 级交付标准。\n"
                "执行计划：调用 write_file 将万字终极研报全量覆写至项目根目录 `ai-agent-research-report.md`，并生成 ZIP 产物包结构。\n"
                "执行：[write_file] 写入终极产物包文件 ai-agent-research-report.md；[manual_approve] 触发人工终审确认。\n\n"
                "## 📦 终极万字调研研报与成果交付物包说明 (Ultimate Research Deliverables)\n\n"
                "经过龙虾特战队四大核心参谋的无缝异步协同，全景深度调研报告已成功封装，并全量覆写至项目根目录 `ai-agent-research-report.md`。\n\n"
                "### 核心产物清单\n"
                "1. **`ai-agent-research-report.md`**：包含完整万字背景剖析、市场规模预测表及演进路线图；\n"
                "2. **`execution_trace.md`**：完整记载了总督阁下、公关参谋、战术参谋与裁决器的底层神经思考链路与沙盒调用日志；\n"
                "3. **`architectural_blueprints.svg`**：包含 Mermaid 矢量化渲染的象限图与状态机拓扑图。\n\n"
                "### 指挥官决策建议\n"
                "- **短期演进**：建议持续强化底层 `SubagentManager` 的并发沙盒隔离能力，确保在高负载多专家派生下的绝对安全性；\n"
                "- **长期布局**：依托现有的 SQLite 多模型路由架构，进一步引入基于 Eigent 生态的跨域 MCP 工具包，打造无可匹敌的工业级自主智能体中枢。"
            )
        return LLMResponse(content=content, finish_reason="stop")

events = []
async def ws_sink(payload):
    events.append(payload)
    event_type = payload.get('event_type', '')
    data = payload.get('payload', {})
    
    if event_type == 'WORKFLOW_START':
        print(f"\n🎬 [开始战略级协作剧本] {data}\n" + "-"*70)
    elif event_type == 'AGENT_ACTIVATED':
        print(f"\n👤 [专家介入] 顶级专家: {data.get('agent')} 正在接管神经通讯总线...\n" + "-"*70)
    elif event_type == 'THINKING_START':
        print(f"🧠 [{data.get('agent')}] 正在展开深度思维链推演与工具调度编排...")
    elif event_type == 'TOOL_CALL':
        tools_str = ", ".join(data.get('tools', []))
        print(f"\n⚙️ [底层沙盒调度] 触发系统级沙盒工具链: {tools_str}")
        print(f"   ↳ 调度详情: {data.get('details')[:80]}...\n")
    elif event_type == 'STREAM_TEXT':
        delta = data.get('delta', '')
        print(delta, end='', flush=True)
    elif event_type == 'HITL_SUSPEND':
        print(f"\n\n⚠️ [协同阻断] 触发系统级风控挂起 (HITL): {data.get('message')}\n" + "="*70)
    elif event_type == 'WORKFLOW_END':
        print(f"\n\n✨ [协作圆满结束] 龙虾特战队战略级多专家协同推演与产物交付成功完成！\n" + "="*70)

async def main():
    print("=" * 80)
    print("🦞 龙虾 OS - 顶配工业级万字研报接力协同 E2E 深度全景验证")
    print("=" * 80)
    
    engine = LongxiaOrchestrator(
        provider=PremiumIndustrialProvider(),
        model="lobster-ultra-industrial-v1",
        publish_event=ws_sink,
    )
    
    async def premium_outbound_dispatcher():
        while True:
            try:
                msg = await engine.bus.consume_outbound()
                meta = msg.metadata or {}
                trace_id = msg.chat_id

                if meta.get("_stream_delta") and not meta.get("_stream_end"):
                    await ws_sink({
                        "trace_id": trace_id,
                        "event_type": "STREAM_TEXT",
                        "payload": {"delta": msg.content}
                    })
                elif meta.get("_turn_end"):
                    await ws_sink({
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
                                await ws_sink({
                                    "trace_id": trace_id,
                                    "event_type": "AGENT_ACTIVATED",
                                    "payload": {"agent": agent_name}
                                })
                                await ws_sink({
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
                        await ws_sink({
                            "trace_id": trace_id,
                            "event_type": "TOOL_CALL",
                            "payload": {
                                "tools": tool_names,
                                "details": msg.content or "正在执行底层工具链调用与深度计算验证..."
                            }
                        })
                    elif meta.get("_reasoning_delta"):
                        await ws_sink({
                            "trace_id": trace_id,
                            "event_type": "THINKING_START",
                            "payload": {"agent": "龙虾特战队"}
                        })
                elif not meta.get("_stream_delta") and not meta.get("_stream_end") and msg.content:
                    import re
                    m = re.search(r'\[(.*?)\]', msg.content)
                    if m:
                        await ws_sink({
                            "trace_id": trace_id,
                            "event_type": "TOOL_CALL",
                            "payload": {
                                "tools": [m.group(1)],
                                "details": msg.content
                            }
                        })
                    await ws_sink({
                        "trace_id": trace_id,
                        "event_type": "STREAM_TEXT",
                        "payload": {"delta": msg.content + "\n\n"}
                    })
            except asyncio.CancelledError:
                break
            except Exception as e:
                print(f"⚠️ Premium Outbound Error: {e}")

    outbound_task = asyncio.create_task(premium_outbound_dispatcher())
    loop_task = asyncio.create_task(engine.run())
    
    # 启动工作流 custom_assembly，指定 4 位核心专家参与顶配接力调研
    custom_experts = ["lobster_governor", "lobster_pr", "lobster_tactical", "lobster_verifier"]
    print(f"\n🚀 启动顶配万字研报接力剧本，参与专家列表: {custom_experts}")
    wf_task = asyncio.create_task(
        engine.run_workflow(
            workflow_id="custom_assembly",
            session_id="sess_premium_longxia_2026",
            prompt="深度解构当前全球顶尖的 AI Agent 操作系统与多智能体编排框架，展开万字架构点评与全景选型评估。",
            custom_experts=custom_experts
        )
    )
    
    await asyncio.sleep(4)
    
    print("\n🔍 检查当前 WebSocket 广播事件...")
    event_types = [e.get("event_type") for e in events]
    print("捕获到的事件序列:", event_types)
    
    assert "WORKFLOW_START" in event_types
    assert "AGENT_ACTIVATED" in event_types
    assert "STREAM_TEXT" in event_types
    assert "HITL_SUSPEND" in event_types
    
    print("\n✅ HITL 成功挂起！模拟导演在大屏点击放行...")
    await engine.resume("sess_premium_longxia_2026")
    
    await asyncio.sleep(3)
    
    event_types_after = [e.get("event_type") for e in events]
    print("放行后的事件序列:", event_types_after)
    assert "WORKFLOW_END" in event_types_after
    
    print("\n" + "=" * 80)
    print("✅ 龙虾 OS - 顶配工业级万字研报接力协同 E2E 测试完美通过！")
    print("=" * 80)

    loop_task.cancel()
    outbound_task.cancel()

if __name__ == "__main__":
    asyncio.run(main())
