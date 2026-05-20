import os
import yaml
from pydantic import BaseModel, Field
from typing import List, Dict, Optional

class AgentConfig(BaseModel):
    """专家属性强校验模型 (参考 PraisonAI 的低代码配置思想)"""
    agent_id: str = Field(..., description="专家的全局唯一标识，如 lobster_pr")
    name: str = Field(..., description="专家的中文展示名")
    role_description: str = Field(..., description="专家的角色与背景设定")
    system_prompt: str = Field(..., description="注入给 LLM 的系统级提示词")
    llm_requirement: str = Field(default="local_rtx_5090_primary", description="该专家所需的大模型 Provider")
    skills_allowed: List[str] = Field(default_factory=list, description="允许挂载的生态工具 ID 列表")

class AgentRegistry:
    """动态专家池注册中心"""
    _agents: Dict[str, AgentConfig] = {}

    @classmethod
    def load_from_directory(cls, config_dir: str):
        """扫描 configs/agents/ 目录，将所有 YAML 转换为内存 Agent 对象"""
        if not os.path.exists(config_dir):
            print(f"[Warn] Agent config directory {config_dir} not found.")
            return

        for filename in os.listdir(config_dir):
            if filename.endswith(('.yaml', '.yml')):
                filepath = os.path.join(config_dir, filename)
                try:
                    with open(filepath, 'r', encoding='utf-8') as f:
                        data = yaml.safe_load(f)
                        # Pydantic 强校验
                        agent_config = AgentConfig(**data)
                        cls._agents[agent_config.agent_id] = agent_config
                        print(f"[Success] Loaded Agent: {agent_config.name} ({agent_config.agent_id})")
                except Exception as e:
                    print(f"[Error] Failed to parse agent config {filename}: {str(e)}")

    @classmethod
    def get_agent(cls, agent_id: str) -> Optional[AgentConfig]:
        return cls._agents.get(agent_id)

    @classmethod
    def list_all(cls) -> List[AgentConfig]:
        return list(cls._agents.values())

# 测试入口
if __name__ == "__main__":
    # 执行该脚本将自动加载当前目录上两级的 configs/agents
    base_path = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    target_dir = os.path.join(base_path, "configs", "agents")
    print(f"Loading agents from {target_dir}...")
    AgentRegistry.load_from_directory(target_dir)
