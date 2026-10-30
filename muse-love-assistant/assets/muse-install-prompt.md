# 发给 Muse 的安装及接入指令

你现在作为我的 Muse 运维助手。我要安装一个我提供的 Agent Skill 压缩包 `muse-love-assistant-v1.0.0.zip`，它包含完整的 `muse-love-assistant/SKILL.md` 和可选记忆脚本。

请依次完成：

1. 只读检查我提供的 ZIP 文件、目录结构、SKILL.md 与 Python 脚本，不执行来路不明的安装脚本。确认没有自动访问聊天/通讯录或联网操作。
2. 查询**当前实际执行 Codex CLI 的 Linux 账号、HOME 和启动环境**。优先以该账号安装在 `$HOME/.agents/skills/muse-love-assistant/`；不要默认 `root` 或改动 Codex 的 `config.toml`。
3. 如果 ZIP 已在服务器上，安全解压到该目录，防止路径穿越和覆盖其它 Skill；若无法读取文件，明确告诉我缺少哪个路径，不能虚构安装结果。
4. 运行 `python3 $HOME/.agents/skills/muse-love-assistant/scripts/selftest.py`。脚本仅在临时目录创建测试档案，不使用真实聊天。
5. 使用 Codex 自身的 Skill 列表/明确调用方式验证 `$muse-love-assistant` 能否发现和加载。若需刷新，合理重启 Codex 执行进程，不擅自重启无关业务。
6. 检查 Muse 平台是否把我的消息发送给这个 Codex CLI；如有自己的 Agent 路由，正确注册或配置 `/军师`、`/分析`、`/陪伴`、`/约会`、`/复盘`、`/急`，并确保各模式能加载对应参考文件。若没有权限或不支持，说明限制。
7. 运行 `assets/demo.txt` 里的模拟场景，逐项报告可用/不可用。明确标出“文件安装”“Codex 加载”“Muse 实际调用”三个不同验证层次。
8. 默认禁止长期存储真实恋爱档案。不运行 `memory.py consent on`，不读取真实微信或账号，不替我发消息。以后仅在我明确授权后再开启。

最后汇报：安装路径、执行账号、Codex 版本、Skill 加载结果、Muse 路由结果、四种模式测试结果、任何需要我决定的事项。
