"""
真实大模型直连 E2E 测试脚本
自动从 SQLite 加载用户配置的真实大语言模型（如火山引擎豆包或 OpenAI/Anthropic），
执行真实的自定义专家团接力调研推演，并在终端输出实时推演流与最终交付报告。
"""
import asyncio
import bootstrap
from conductor.engine import LongxiaOrchestrator

events = []
async def ws_sink(payload):
    events.append(payload)
    event_type = payload.get('event_type', '')
    data = payload.get('payload', {})
    
    if event_type == 'STREAM_TEXT':
        delta = data.get('delta', '')
        print(delta, end='', flush=True)
    elif event_type == 'WORKFLOW_START':
        print(f"\n\n🎬 [开始协作剧本] {data}\n" + "-"*50)
    elif event_type == 'AGENT_ACTIVATED':
        print(f"\n\n👤 [专家介入] {data.get('agent')} (节点: {data.get('node_id')})\n" + "-"*50)
    elif event_type == 'THINKING_START':
        print(f"🤔 [{data.get('agent')}] 正在深度思考推演中...\n")
    elif event_type == 'HITL_SUSPEND':
        print(f"\n\n⚠️ [协同阻断] {data.get('message')}\n" + "="*50)
    elif event_type == 'WORKFLOW_END':
        print(f"\n\n✨ [协作圆满结束]\n" + "="*50)

async def main():
    print("=" * 70)
    print("🦞 龙虾 OS - 直连真实大模型多智能体接力 E2E 实测")
    print("=" * 70)
    
    # 不传 provider，让引擎自动调用 load_provider_from_db 加解密直连真实大模型！
    engine = LongxiaOrchestrator(
        publish_event=ws_sink,
    )
    
    print(f"\n✅ 成功从 SQLite 加载真实大模型配置:")
    print(f"  - 当前驱动 Provider: {engine.provider.__class__.__name__}")
    print(f"  - 当前模型名称: {engine.model}")
    print(f"  - API Base: {getattr(engine.provider, 'api_base', '默认')}")
    
    # 后台运行 outbound_dispatcher 消费者，确保流式输出及完整响应被实时捕获
    async def real_outbound_dispatcher():
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
                elif not meta.get("_stream_delta") and not meta.get("_stream_end") and msg.content:
                    await ws_sink({
                        "trace_id": trace_id,
                        "event_type": "STREAM_TEXT",
                        "payload": {"delta": msg.content + "\n\n"}
                    })
            except asyncio.CancelledError:
                break
            except Exception as e:
                print(f"\n⚠️ Real Outbound Error: {e}")

    outbound_task = asyncio.create_task(real_outbound_dispatcher())
    loop_task = asyncio.create_task(engine.run())
    
    # 启动工作流 custom_assembly，指定 2 位核心专家参与接力调研（总督 + 战术参谋）以加快测试效率
    custom_experts = ["lobster_governor", "lobster_tactical"]
    print(f"\n🚀 启动真实大模型自定义专家团模式，参与专家列表: {custom_experts}")
    wf_task = asyncio.create_task(
        engine.run_workflow(
            workflow_id="custom_assembly",
            session_id="sess_real_doubao_999",
            prompt="调研目前 GitHub 上最火的开源大模型与 Agent 框架，给出简要的架构点评。",
            custom_experts=custom_experts
        )
    )
    
    # 给定充分时间让真实大模型完成调用与生成，到达末位专家挂起 (HITL)
    await asyncio.sleep(120)
    
    print("\n\n🔍 检查当前 WebSocket 广播事件...")
    event_types = [e.get("event_type") for e in events]
    assert "WORKFLOW_START" in event_types
    assert "AGENT_ACTIVATED" in event_types
    assert "STREAM_TEXT" in event_types, "真实大模型必须有推演文本输出"
    assert "HITL_SUSPEND" in event_types
    
    print("\n✅ HITL 成功挂起！模拟导演在大屏点击放行...")
    await engine.resume("sess_real_doubao_999")
    
    # 等待剩余流程执行完毕
    await asyncio.sleep(60)
    
    print("\n" + "=" * 70)
    print("✅ 龙虾 OS 直连真实大模型多智能体接力 E2E 测试完美通过！")
    print("=" * 70)

    loop_task.cancel()
    outbound_task.cancel()

if __name__ == "__main__":
    asyncio.run(main())
