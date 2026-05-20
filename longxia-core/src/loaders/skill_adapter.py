import os
import yaml
import re
from typing import Dict, Any

class SkillAdapter:
    """
    OpenClaw 技能桥接器 (从 OpenClaw TS 核心源码改写为 Python 版本)
    职责: 解析 OpenClaw 风格的 SKILL.md (带有 YAML frontmatter)
    """
    
    FRONTMATTER_PATTERN = re.compile(r"^---\s*\n(.*?)\n---\s*\n", re.DOTALL)

    @classmethod
    def load_all_skills(cls, skills_dir: str) -> Dict[str, Dict[str, Any]]:
        """扫描目录下所有技能并加载其 Schema"""
        skills = {}
        if not os.path.exists(skills_dir):
            return skills
            
        for entry in os.listdir(skills_dir):
            skill_path = os.path.join(skills_dir, entry)
            md_path = os.path.join(skill_path, "SKILL.md")
            if os.path.isdir(skill_path) and os.path.exists(md_path):
                schema = cls.parse_skill_md(md_path)
                if schema:
                    skills[schema["function"]["name"]] = schema
        return skills

    @classmethod
    def parse_skill_md(cls, filepath: str) -> Dict[str, Any]:
        if not os.path.exists(filepath):
            return {}
            
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()

        match = cls.FRONTMATTER_PATTERN.search(content)
        if not match:
            return {}

        yaml_content = match.group(1)
        instructions = content[match.end():].strip()
        
        try:
            metadata = yaml.safe_load(yaml_content)
            # 翻译成 OpenAI Tool Schema
            name = metadata.get("name")
            if not name: return {}
            
            # 支持 openclaw 命名空间，防止冲突
            full_name = f"openclaw:{name}"
            
            skill_schema = {
                "type": "function",
                "function": {
                    "name": full_name,
                    "description": metadata.get("description", "No description provided"),
                    "parameters": {
                        "type": "object",
                        "properties": metadata.get("metadata", {}).get("openclaw", {}).get("requires", {}),
                        "required": [] # 默认不设强制要求，增加弹性
                    }
                },
                "instructions": instructions  # 提取的技能操作指南，将作为子代理的系统 Prompt
            }
            return skill_schema
        except yaml.YAMLError:
            return {}

# ================= 测试提取逻辑 =================
if __name__ == "__main__":
    # 指向我们在 Sprint 0 建好的生态软链接
    base_path = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    target_skill = os.path.join(base_path, "plugins", "openclaw_skills", "slack", "SKILL.md")
    
    print(f"Translating OpenClaw SKILL from: {target_skill}")
    schema = SkillAdapter.parse_skill_md(target_skill)
    import json
    print(json.dumps(schema, indent=2, ensure_ascii=False))
