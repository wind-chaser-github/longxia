import os
import yaml
from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Any

class WorkflowTransition(BaseModel):
    condition: str = Field(default="always", description="流转条件，如 'always', 'on_error', 'requires_approval'")
    next_node: str = Field(..., description="满足条件时，下一个接手的节点 ID (END表示结束)")

class WorkflowNode(BaseModel):
    node_id: str = Field(..., description="节点唯一标识")
    agent_id: str = Field(..., description="分配给该节点的专家 ID")
    hitl_enabled: bool = Field(default=False, description="是否需要人工授权 (HITL) 才能放行")
    transitions: List[WorkflowTransition] = Field(default_factory=list, description="流转出口")

class WorkflowConfig(BaseModel):
    workflow_id: str = Field(..., description="剧本ID，例如 crisis_pr")
    entry_node: str = Field(..., description="剧本入口节点 ID")
    nodes: Dict[str, WorkflowNode] = Field(..., description="所有流转节点的映射表")

class WorkflowRegistry:
    """动态流转图谱加载器"""
    _workflows: Dict[str, WorkflowConfig] = {}

    @classmethod
    def load_from_directory(cls, config_dir: str):
        if not os.path.exists(config_dir):
            print(f"[Warn] Workflow config directory {config_dir} not found.")
            return

        for filename in os.listdir(config_dir):
            if filename.endswith(('.yaml', '.yml')):
                filepath = os.path.join(config_dir, filename)
                try:
                    with open(filepath, 'r', encoding='utf-8') as f:
                        data = yaml.safe_load(f)
                        wf_config = WorkflowConfig(**data)
                        cls._workflows[wf_config.workflow_id] = wf_config
                        print(f"[Success] Loaded Workflow: {wf_config.workflow_id} with {len(wf_config.nodes)} nodes")
                except Exception as e:
                    print(f"[Error] Failed to parse workflow {filename}: {str(e)}")

    @classmethod
    def get_workflow(cls, workflow_id: str) -> Optional[WorkflowConfig]:
        return cls._workflows.get(workflow_id)
