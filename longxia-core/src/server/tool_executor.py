import asyncio
import json
from typing import Dict, Any, List

class ToolExecutor:
    """
    工业级工具执行器 (Tool Sandbox Runner)
    这是补齐 Workbuddy / OpenClaw 庞大生态能力的“引擎舱”。
    职责：
    1. 接收 LLM 返回的结构化 Tool Call 参数。
    2. 安全地隔离执行（捕获异常，设定 Timeout 熔断，防止阻塞主引擎）。
    3. 支持动态加载并触发 OpenClaw 的内部逻辑或第三方 API。
    """
    
    @classmethod
    async def execute_tool(cls, tool_call_id: str, function_name: str, raw_arguments: str) -> Dict[str, Any]:
        """异步执行单个工具，自带错误捕捉和超时机制"""
        print(f"[ToolExecutor] Received request to execute: '{function_name}' with args: {raw_arguments}")
        
        try:
            # 1. 严格的 JSON 校验 (防止大模型幻觉输出了非 JSON 字符串)
            arguments = json.loads(raw_arguments)
        except json.JSONDecodeError as e:
            return cls._build_error_result(tool_call_id, function_name, f"Arguments JSON parse failed: {str(e)}")

        # 2. 模拟沙盒执行与超时熔断机制 (Timeout)
        try:
            # 限制执行时间为 10 秒，防止某些外部请求卡死整个协作网络
            result_data = await asyncio.wait_for(
                cls._dispatch_to_handler(function_name, arguments), 
                timeout=10.0
            )
            return cls._build_success_result(tool_call_id, function_name, result_data)
            
        except asyncio.TimeoutError:
            error_msg = f"Tool execution timed out after 10 seconds."
            print(f"[ToolExecutor] {error_msg}")
            return cls._build_error_result(tool_call_id, function_name, error_msg)
        except Exception as e:
            print(f"[ToolExecutor] Execution crashed: {str(e)}")
            return cls._build_error_result(tool_call_id, function_name, f"Execution failed: {str(e)}")

    # ================= 动态插件注册机制 (解决扩展性痛点) =================
    _handlers: Dict[str, Any] = {}

    @classmethod
    def register_handler(cls, tool_name: str):
        """
        装饰器：允许在系统任何地方动态注册新的技能处理器，
        彻底消灭硬编码的 if/elif 逻辑，实现真正的插件化 (Plugin Architecture)。
        """
        def decorator(func):
            cls._handlers[tool_name] = func
            print(f"[ToolExecutor] Registered dynamic handler for: {tool_name}")
            return func
        return decorator

    @classmethod
    async def _dispatch_to_handler(cls, function_name: str, arguments: Dict[str, Any]) -> str:
        """从注册表中查找并调用真正的执行函数"""
        # ── 内置感官：Markitdown ──────────────────────────
        if function_name == "longxia:markitdown":
            return await cls._run_markitdown(arguments)

        handler = cls._handlers.get(function_name)
        if not handler:
            # 如果没有本地处理器，返回提示（未来可桥接至 Electron）
            return f"Handler for {function_name} not found. Forwarding to Electron Bridge..."
        
        # 允许处理器是异步或同步
        if asyncio.iscoroutinefunction(handler):
            return await handler(arguments)
        else:
            return handler(arguments)

    @classmethod
    async def _run_markitdown(cls, args: Dict[str, Any]) -> str:
        """使用 markitdown 转换文档"""
        file_path = args.get("file_path")
        if not file_path: return "Error: No file_path provided"
        
        try:
            from markitdown import MarkItDown
            md = MarkItDown()
            result = md.convert(file_path)
            return result.text_content
        except ImportError:
            return "Error: markitdown library not installed. Please run 'pip install markitdown'"
        except Exception as e:
            return f"Error during markitdown conversion: {str(e)}"

    @staticmethod
    def _build_success_result(tool_id: str, name: str, content: str) -> Dict[str, Any]:
        """组装标准的 OpenAI tool_message 结构，塞回给大模型"""
        return {
            "role": "tool",
            "tool_call_id": tool_id,
            "name": name,
            "content": content
        }

    @staticmethod
    def _build_error_result(tool_id: str, name: str, error_msg: str) -> Dict[str, Any]:
        """将报错信息返回给大模型，让大模型产生自我纠正 (Self-Correction)"""
        return {
            "role": "tool",
            "tool_call_id": tool_id,
            "name": name,
            "content": json.dumps({"error": error_msg, "instruction": "Please correct your arguments and try again."})
        }

# ================= 测试执行器 =================
if __name__ == "__main__":
    async def test():
        # 模拟从 LLM 收到了一段参数正确的 tool call
        success_res = await ToolExecutor.execute_tool(
            "call_12345", 
            "openclaw:slack/read_messages", 
            '{"channelId": "C123", "limit": 1}'
        )
        print("Success Result:\n", json.dumps(success_res, indent=2, ensure_ascii=False))

        # 模拟大模型幻觉，传了不规范的 JSON
        error_res = await ToolExecutor.execute_tool(
            "call_67890", 
            "openclaw:browser/search", 
            '{"query": "Bad JSON string...}'
        )
        print("\nError Result (Triggering Self-Correction):\n", json.dumps(error_res, indent=2, ensure_ascii=False))

    asyncio.run(test())
