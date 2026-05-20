import os
from typing import Any, Dict
from nanobot.agent.tools.base import Tool, tool_parameters
from nanobot.agent.subagent import SubagentManager

def create_skill_tool(skill_schema: Dict[str, Any], subagents: SubagentManager) -> Tool:
    """
    动态生成一个 SkillTool 类，并将其实例化。
    这个 Tool 并不是在本地线程中同步执行代码，而是将自身封装为一个 Subagent（子代理）丢入后台执行。
    """
    tool_name = skill_schema["function"]["name"]
    tool_desc = skill_schema["function"]["description"]
    tool_params = skill_schema["function"]["parameters"]
    skill_instructions = skill_schema.get("instructions", "No specific instructions provided.")

    @tool_parameters(tool_params)
    class DynamicSkillTool(Tool):
        @property
        def name(self) -> str:
            return tool_name

        @property
        def description(self) -> str:
            return tool_desc

        async def execute(self, **kwargs: Any) -> Any:
            import time
            import json
            task_id = f"sub_{time.time_ns()}"
            
            # 拼接传入的参数，组合成子代理的执行依据
            args_str = json.dumps(kwargs, indent=2, ensure_ascii=False)
            task_prompt = (
                f"【执行依据】\n{skill_instructions}\n\n"
                f"【入参要求】\n{args_str}\n\n"
                f"请根据上述要求，调用你自身的生态工具执行完成该技能动作，并汇报最终结果。"
            )
            
            origin = {"channel": "system", "chat_id": "orchestrator", "session_key": "unified"}
            
            print(f"🧬 [SkillExecutor] 正在将技能 '{self.name}' 具象化为子代理 (TaskID: {task_id})...")
            
            # 使用 Nanobot 底层 SubagentManager 发起子任务
            result_msg = subagents.spawn_subagent(
                task_id=task_id,
                task=task_prompt,
                display_label=self.name.split(":")[-1],
                origin=origin
            )
            
            return f"技能已移交专家子代理执行。\n{result_msg}"

    return DynamicSkillTool()
