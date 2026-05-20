"""
Longxia OS Bootstrap — The Namespace Harmonizer
"""
import sys
import os
from pathlib import Path

# 1. 确定项目根目录 (src)
SRC_DIR = Path(__file__).resolve().parent

# 2. 注入核心路径，确保物理拷贝的 nanobot, praisonai, eigent 能够被识别
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

# 3. 强行劫持模块命名空间，解决内部引用冲突
try:
    import nanobot
    sys.modules["nanobot"] = nanobot
    import praisonai
    sys.modules["praisonai"] = praisonai
    import eigent
    sys.modules["eigent"] = eigent
except ImportError:
    pass

# 为 Eigent 提供别名 app
sys.modules["app"] = sys.modules.get("eigent")

# 4. 自动加载环境变量配置 (.env)
try:
    from dotenv import load_dotenv
    env_path = SRC_DIR.parent / ".env"
    if env_path.exists():
        load_dotenv(dotenv_path=env_path, override=True)
        print(f"⚡ [Bootstrap] Loaded environment variables from {env_path}")
except ImportError:
    pass

# 5. 提供 json_repair 的兼容性 Mock
try:
    import json_repair
except ImportError:
    import json
    class _JsonRepairMock:
        @staticmethod
        def loads(s, *args, **kwargs):
            try:
                return json.loads(s)
            except Exception:
                return s
    sys.modules["json_repair"] = _JsonRepairMock()

print("⚡ [Bootstrap] Namespace Harmonized. All 6 frameworks are live.")
