# 🛡️ Security Policy for Longxia

## Supported Versions

我们目前仅对最新的主分支（`main`）提供积极的安全更新支持：

| Version | Supported |
| :--- | :--- |
| main (latest) |  Yes |
| <= 0.1.0 |  No |

---

## Reporting a Vulnerability

如果您在 Longxia 的多智能体协同引擎（Conductor）、本地 Web 接口（FastAPI 服务）或任何本地算法模型中发现了安全隐患（如本地 API Key 的内存溢出风险、非授权的本地路径遍历漏洞等）：

1. **请勿直接提交公开的 GitHub Issue**。
2. 请直接发送加密邮件至项目维护者邮箱，或者通过私密信道向开发团队提交漏洞详情。
3. 请在邮件中包含：
   - 漏洞的影响范围与危害类型。
   - 详细的漏洞 PoC（概念验证代码或触发指令）。
   - 能够有效减缓该漏洞危害的临时替代方案（如有）。

我们会在收到汇报后的 **48小时内** 确认漏洞细节，并在确认后尽快推行安全补丁。再次感谢您为保障 Longxia 社区的安全做出的努力！
