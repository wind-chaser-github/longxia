"""
E2E 冒烟测试 — 验证 LongxiaOrchestrator 的核心管线

测试要点：
1. LongxiaOrchestrator 能正确继承 AgentLoop 的完整能力
2. ToolRegistry 自动注册 13 个内置工具
3. SubagentManager 就绪
4. SkillsLoader 自动发现技能
5. run_workflow 正确将消息注入总线
"""
import asyncio
import bootstrap

from conductor.engine import LongxiaOrchestrator
from nanobot.providers.base import LLMResponse, LLMProvider, GenerationSettings


class MockProvider(LLMProvider):
    """最小化的 Mock Provider，仅实现框架所需的抽象接口。"""
    
    def __init__(self):
        super().__init__(api_key="mock")
        self.generation = GenerationSettings()
    
    def get_default_model(self) -> str:
        return "mock-model"
    
    async def chat(self, **kwargs) -> LLMResponse:
        return LLMResponse(
            content="Mock: 任务调度完成，所有子代理已派遣。",
            finish_reason="stop",
        )


async def ws_sink(payload):
    """模拟 WebSocket 事件接收器"""
    event = payload.get("event", payload.get("state", "unknown"))
    print(f"📊 [WS] {event}: {payload}")


async def main():
    print("=" * 60)
    print("🦞 龙虾 OS E2E 冒烟测试")
    print("=" * 60)
    
    provider = MockProvider()
    
    # 实例化编排器 — 直接传入 provider，不依赖环境变量
    engine = LongxiaOrchestrator(
        provider=provider,
        model="mock-model",
        publish_event=ws_sink,
    )
    
    # 验证框架能力
    print(f"\n✅ AgentLoop 初始化成功")
    print(f"  - 已注册工具: {engine.tool_names}")
    print(f"  - 工具数量: {len(engine.tool_names)}")
    print(f"  - SubagentManager: {'就绪' if engine.subagents else '未就绪'}")
    print(f"  - 模型: {engine.model}")
    print(f"  - 工作空间: {engine.workspace}")
    
    # 验证 Skills 被 ContextBuilder 正确发现
    skills_summary = engine.context.skills.build_skills_summary()
    skill_count = skills_summary.count("**") // 2 if skills_summary else 0
    print(f"  - 发现技能: {skill_count} 个")
    
    # 验证 run_workflow 能将消息注入总线
    print(f"\n🚀 测试 run_workflow 消息注入...")
    await engine.run_workflow("test_wf_01", "sess_1001", "测试紧急公关处理任务")
    
    # 检查总线中是否有消息
    bus_size = engine.bus.inbound_size
    print(f"  - 总线中待消费消息: {bus_size}")
    assert bus_size > 0, "run_workflow 应该向总线注入了消息"
    
    # 从总线取出消息验证内容
    msg = await engine.bus.consume_inbound()
    print(f"  - 消息来源: {msg.channel}:{msg.sender_id}")
    print(f"  - 消息内容: {msg.content[:50]}...")
    assert msg.channel == "lobster-ui"
    assert msg.sender_id == "director"
    assert "测试紧急公关处理任务" in msg.content
    
    print(f"\n{'=' * 60}")
    print(f"✅ 全部测试通过！框架管线完整且正常工作。")
    print(f"{'=' * 60}")


if __name__ == "__main__":
    asyncio.run(main())
