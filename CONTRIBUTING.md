# 🤝 Contributing to Longxia (龙虾特战队)

首先，非常感谢您对 Longxia 项目的关注和支持！正是因为您的参与，Longxia 才能变得更加强大和完善。

为了保障代码仓库的高质量与维护的规范性，请在提交代码前仔细阅读以下贡献指南。

---

## 🐛 报告 Issue 与提交反馈

如果您在现场测试或本地运行中发现了 Bug，或者希望为项目提出新需求（Feature Request），请优先使用 GitHub Issues 提交。
提交时请尽量包含以下信息：
1. **复现环境**：您的操作系统版本、Python 及 Node.js 版本、以及显卡配置（如本地 RTX 5090 / 4090）。
2. **复现步骤**：详细描述您的输入指令或所执行的测试流程。
3. **错误日志**：直接附带后台命令行中输出的报错堆栈或网络请求报错信息。

---

## 🛠️ 提交 Pull Request (PR) 流程

1. **Fork 本仓库** 并将您的 Fork 仓克隆至本地。
2. **创建您的功能分支**，请遵循以下分支命名规范：
   - 功能开发：`feature/your-feature-name`
   - 漏洞修复：`bugfix/your-bug-name`
   - 稳定重构：`refactor/your-refactor-name`
3. **编写并提交您的代码**：
   - 保持原有的代码注释与 Docstrings 不变。
   - 遵循 PEP8（Python）和 ESLint（TypeScript/Frontend）代码风格。
4. **进行本地功能测试**：
   - 确保修改后的代码在本地通过全部自动化测试（如运行 `python src/test_e2e.py`）。
   - 本地前端及 API 接口响应顺畅。
5. **Push 分支** 并向本仓库提交 Pull Request。
6. **Commit 提交信息规范**，我们建议使用如下格式：
   - `feat: 增加本地热敏打印半色调网点算法`
   - `fix: 修复 Wav2Lip 前5秒锚点检测在非人脸视频下的报错`
   - `docs: 更新 9 号方案大屏 UI 的分辨率规范表`

我们会尽快安排维护团队对您的 PR 进行 Review 与合并！再次感谢您的贡献！
