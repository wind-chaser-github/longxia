"""
WorkBuddy 通用任务自定义专家团拼装模式与单兵突击模式 E2E 测试
验证动态生成 Workflow DAG 机制及多专家接力协同与 HITL 阻断放行
"""
import asyncio
import bootstrap
from conductor.engine import LongxiaOrchestrator
from nanobot.providers.base import LLMResponse, LLMProvider, GenerationSettings

class MockAssemblyProvider(LLMProvider):
    def __init__(self):
        super().__init__(api_key="mock")
        self.generation = GenerationSettings()
        self.turn = 0
    
    def get_default_model(self) -> str:
        return "mock-assembly-model"
    
    async def chat(self, **kwargs) -> LLMResponse:
        self.turn += 1
        if self.turn == 1:
            content = (
                "需求分析：收到指挥官最高指令，需对目前 GitHub 上最火的开源大模型与 Agent 框架展开深度架构点评。\n"
                "计划：启动跨域协同调研工作流。派生公关参谋进行外部资讯与 GitHub 热度检索；派生战术参谋进行本地代码基内核比对；最终交由无情裁决器终审。\n"
                "执行：[spawn] 派生子领域专家进行并发数据捕获与代码比对。\n\n"
                "# 🦞 龙虾 OS - 最高总督宏观调配与任务编排书\n\n"
                "已完成需求深度拆解，启动跨域协同调研工作流。核心目标：分析 LangGraph、CrewAI、PraisonAI 架构特性，并输出全景对比象限图与研报产物。"
            )
        elif self.turn == 2:
            content = (
                "需求分析：需获取全网最新 Agent 框架动态与热度指标。\n"
                "计划：执行 web_search 检索热点项目，执行 web_fetch 抓取 GitHub 趋势榜单热度数据。\n"
                "执行：[web_search] 查询 2026 最新开源 Agent 框架生态；[web_fetch] 抓取 GitHub 趋势榜单热度数据。\n\n"
                "## 🌐 全网开源 Agent 框架市场情报速递\n\n"
                "| 框架名称 | GitHub Stars | 核心架构特征 | 适用场景 |\n"
                "| :--- | :--- | :--- | :--- |\n"
                "| **LangGraph** | 38.5k | 循环图状态机 (StateGraph) | 复杂多步可控 Agent 环 |\n"
                "| **CrewAI** | 22.1k | 角色扮演与层级委派 | 企业级多智能体流水线 |\n"
                "| **PraisonAI** | 15.4k | YAML 声明式低代码驱动 | 快速全栈微服务化编排 |\n\n"
                "已完成外部情报收集与清洗，移交战术参谋进行本地映射比对。"
            )
        elif self.turn == 3:
            content = (
                "需求分析：需比对外部竞品与本地 Conductor 引擎架构差异。\n"
                "计划：调用 grep 检索本地事件循环与总线机制，调用 read_file 读取核心引擎源码。\n"
                "执行：[grep] 检索本地 Conductor 神经消息总线实现；[read_file] 读取 src/conductor/engine.py 核心调度机制。\n\n"
                "## 🏰 龙虾 OS 底层架构与竞品深度比对\n\n"
                "```mermaid\n"
                "quadrantChart\n"
                "    title 框架成熟度与定制灵活性对比\n"
                "    x-axis 低度定制 -> 深度内核掌控\n"
                "    y-axis 单一剧本 -> 复杂工业级协同\n"
                "    quadrant-1 工业级领跑者\n"
                "    quadrant-2 敏捷原型工具\n"
                "    quadrant-3 基础玩具\n"
                "    quadrant-4 底层硬核引擎\n"
                "    \"LangGraph\": [0.65, 0.85]\n"
                "    \"CrewAI\": [0.45, 0.75]\n"
                "    \"PraisonAI\": [0.35, 0.55]\n"
                "    \"龙虾 OS (Lobster OS)\": [0.92, 0.95]\n"
                "```\n\n"
                "已完成深度技术剖析，准备生成最终交付物报告与风控终审。"
            )
        else:
            content = (
                "需求分析：需将所有调研成果打包写入交付物 markdown 文件，并进行最终合规审查。\n"
                "计划：调用 write_file 将研报持久化至项目根目录。\n"
                "执行：[write_file] 写入产物文件 ai-agent-research-report.md。\n\n"
                "## 📦 终极调研产物交付说明\n\n"
                "已成功生成全景深度调研报告，文件已输出至项目根目录 `ai-agent-research-report.md`。包含万字竞品深度剖析、多维架构对比表及演进指南。"
            )
        return LLMResponse(content=content, finish_reason="stop")

events = []
async def ws_sink(payload):
    events.append(payload)
    event_type = payload.get('event_type', '')
    data = payload.get('payload', {})
    
    if event_type == 'WORKFLOW_START':
        print(f"\n🎬 [开始协作剧本] {data}\n" + "-"*60)
    elif event_type == 'AGENT_ACTIVATED':
        print(f"\n👤 [专家介入] 智能体: {data.get('agent')} 正在接管神经通讯总线...\n" + "-"*60)
    elif event_type == 'THINKING_START':
        print(f"🧠 [{data.get('agent')}] 正在展开深度思维链推演与工具调度编排...")
    elif event_type == 'TOOL_CALL':
        tools_str = ", ".join(data.get('tools', []))
        print(f"\n⚙️ [原生工具调度] 触发底层沙盒工具链: {tools_str}")
        print(f"   ↳ 调度详情: {data.get('details')[:80]}...\n")
    elif event_type == 'STREAM_TEXT':
        delta = data.get('delta', '')
        print(delta, end='', flush=True)
    elif event_type == 'HITL_SUSPEND':
        print(f"\n\n⚠️ [协同阻断] 触发系统级风控挂起 (HITL): {data.get('message')}\n" + "="*60)
    elif event_type == 'WORKFLOW_END':
        print(f"\n\n✨ [协作圆满结束] 龙虾特战队多专家协同推演与产物交付成功完成！\n" + "="*60)

async def main():
    print("=" * 70)
    print("🦞 龙虾 OS - WorkBuddy 自定义专家团拼装模式 E2E 深度全景验证")
    print("=" * 70)
    
    engine = LongxiaOrchestrator(
        provider=MockAssemblyProvider(),
        model="mock-assembly-model",
        publish_event=ws_sink,
    )
    
    # 后台模拟主服务的 outbound_dispatcher 消费者，确保完整响应、工具调用及流式包被实时捕获广播
    async def mock_outbound_dispatcher():
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
                    # 检查内容中是否包含工具执行提示
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
                print(f"⚠️ Mock Outbound Error: {e}")

    outbound_task = asyncio.create_task(mock_outbound_dispatcher())
    loop_task = asyncio.create_task(engine.run())
    
    # 启动工作流 custom_assembly，指定 4 位专家参与协同接力
    custom_experts = ["lobster_governor", "lobster_pr", "lobster_tactical", "lobster_verifier"]
    print(f"\n🚀 启动通用任务自定义专家团模式，参与专家列表: {custom_experts}")
    wf_task = asyncio.create_task(
        engine.run_workflow(
            workflow_id="custom_assembly",
            session_id="sess_custom_888",
            prompt="调研目前 GitHub 上最火的开源大模型与 Agent 框架，给出架构点评。",
            custom_experts=custom_experts
        )
    )
    
    # 给定时间让前三个专家执行完，到达末位 verifier 挂起 (HITL)
    await asyncio.sleep(4)
    
    print("\n🔍 检查当前 WebSocket 广播事件...")
    event_types = [e.get("event_type") for e in events]
    print("捕获到的事件序列:", event_types)
    
    assert "WORKFLOW_START" in event_types
    assert "AGENT_ACTIVATED" in event_types
    assert "STREAM_TEXT" in event_types, "完整响应必须通过 STREAM_TEXT 广播给大屏展示"
    assert "HITL_SUSPEND" in event_types
    
    print("\n✅ HITL 成功挂起！模拟导演在大屏点击放行...")
    await engine.resume("sess_custom_888")
    
    # 等待剩余流程执行完毕
    await asyncio.sleep(3)
    
    event_types_after = [e.get("event_type") for e in events]
    print("放行后的事件序列:", event_types_after)
    assert "WORKFLOW_END" in event_types_after, "放行后，工作流应顺利结束"
    
    print("\n" + "=" * 70)
    print("✅ WorkBuddy 通用任务自定义专家团拼装模式 E2E 测试完美通过！")
    print("=" * 70)

    loop_task.cancel()
    outbound_task.cancel()

if __name__ == "__main__":
    asyncio.run(main())
