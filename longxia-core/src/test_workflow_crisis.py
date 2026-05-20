"""
工作流剧本与 HITL 协同阻断 E2E 测试
验证 crisis_pr 剧本的 3 个节点流转及挂起/放行机制
"""
import asyncio
import bootstrap
from conductor.engine import LongxiaOrchestrator
from nanobot.providers.base import LLMResponse, LLMProvider, GenerationSettings

class MockCrisisProvider(LLMProvider):
    def __init__(self):
        super().__init__(api_key="mock")
        self.generation = GenerationSettings()
    
    def get_default_model(self) -> str:
        return "mock-crisis-model"
    
    async def chat(self, **kwargs) -> LLMResponse:
        messages = kwargs.get("messages", [])
        last_content = messages[-1].get("content", "") if messages else ""
        return LLMResponse(
            content=f"Mock专家响应: 已处理内容 [{last_content[:20]}...]",
            finish_reason="stop",
        )

events = []
async def ws_sink(payload):
    events.append(payload)
    print(f"📊 [WS] {payload.get('event_type')}: {payload.get('payload')}")

async def main():
    print("=" * 60)
    print("🦞 龙虾 OS 剧本流转与 HITL 协同阻断测试")
    print("=" * 60)
    
    engine = LongxiaOrchestrator(
        provider=MockCrisisProvider(),
        model="mock-crisis-model",
        publish_event=ws_sink,
    )
    
    # 启动 AgentLoop 后台循环
    loop_task = asyncio.create_task(engine.run())
    
    # 启动工作流 crisis_pr
    wf_task = asyncio.create_task(
        engine.run_workflow("crisis_pr", "sess_crisis_100", "公司产品出现突发负面舆情，请求紧急公关处理。")
    )
    
    # 给定时间让前两个节点 (step_governor_init, step_pr_draft) 执行完，到达 step_final_verify 挂起
    await asyncio.sleep(2)
    
    print("\n🔍 检查当前 WebSocket 广播事件...")
    event_types = [e.get("event_type") for e in events]
    print("捕获到的事件序列:", event_types)
    
    assert "WORKFLOW_START" in event_types
    assert "AGENT_ACTIVATED" in event_types
    assert "HITL_SUSPEND" in event_types
    assert "WORKFLOW_END" not in event_types, "未放行前，工作流不应结束"
    
    print("\n✅ HITL 成功挂起！模拟导演在大屏点击放行...")
    await engine.resume("sess_crisis_100")
    
    # 等待剩余流程执行完毕
    await asyncio.sleep(2)
    
    event_types_after = [e.get("event_type") for e in events]
    print("放行后的事件序列:", event_types_after)
    assert "WORKFLOW_END" in event_types_after, "放行后，工作流应顺利结束"
    
    print("\n" + "=" * 60)
    print("✅ 剧本多节点流转与 HITL 阻断放行测试完美通过！")
    print("=" * 60)

    loop_task.cancel()

if __name__ == "__main__":
    asyncio.run(main())
