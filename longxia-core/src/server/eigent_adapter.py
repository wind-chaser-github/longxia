import os
import importlib
import inspect
from typing import Any
from server.tool_executor import ToolExecutor

class EigentAdapter:
    """
    Eigent 工具生态自动桥接器
    扫描 eigent/agent/toolkit 目录，自动加载所有继承自 AbstractToolkit 的子类，
    并将其包含的 FunctionTool 注入到龙虾 OS 的 ToolExecutor 中。
    """
    
    @classmethod
    def load_all(cls):
        print("🦞 [EigentAdapter] 正在扫描并装载 Eigent 生态工具包...")
        
        # 确定 toolkit 目录路径
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        toolkit_dir = os.path.join(base_dir, "eigent", "agent", "toolkit")
        
        if not os.path.exists(toolkit_dir):
            print(f"⚠️ [EigentAdapter] 工具包目录不存在: {toolkit_dir}")
            return
            
        registered_count = 0
        
        for filename in os.listdir(toolkit_dir):
            if filename.endswith(".py") and not filename.startswith("__"):
                module_name = f"eigent.agent.toolkit.{filename[:-3]}"
                try:
                    # 动态导入模块
                    module = importlib.import_module(module_name)
                    
                    # 动态尝试获取 AbstractToolkit
                    try:
                        from eigent.agent.toolkit.abstract_toolkit import AbstractToolkit
                    except ImportError:
                        AbstractToolkit = None
                    
                    if not AbstractToolkit:
                        continue
                        
                    # 遍历模块内的所有类
                    for name, obj in inspect.getmembers(module, inspect.isclass):
                        # 判断是否继承自 AbstractToolkit（排除其自身）
                        if issubclass(obj, AbstractToolkit) and obj is not AbstractToolkit:
                            try:
                                # 尝试实例化工具包，使用虚拟的 agent_name 和 task_id
                                toolkit_instance = obj(api_task_id="lob_init", agent_name="lobster_system")
                                tools = toolkit_instance.get_can_use_tools("lob_init")
                                
                                for tool in tools:
                                    func_name = f"eigent:{tool.func.__name__}"
                                    # 将函数挂载到 ToolExecutor
                                    ToolExecutor._handlers[func_name] = tool.func
                                    registered_count += 1
                                    
                            except Exception as ex:
                                # 某些 Toolkit 可能因为缺少本地依赖（如 Playwright）而实例化失败，跳过即可
                                print(f"⚠️ [EigentAdapter] 工具包 {name} 初始化跳过: {ex}")
                                
                except ImportError as e:
                    print(f"⚠️ [EigentAdapter] 模块导入失败 {module_name}: {e}")

        print(f"✅ [EigentAdapter] Eigent 生态挂载完成！共注册了 {registered_count} 个 OS 级工具。")
