# Muse 全能恋爱助手 Skill（muse-love-assistant v1.1.0）

## 内容

- **军师**：微信回复、关系推进、争执修复、`/急` 简短话术
- **分析**：聊天截图与对话结构化分析、证据/猜测分离、趋势复盘
- **陪伴**：明确为虚构 AI 的温柔陪聊模式，和现实关系隔离
- **约会**：自然邀约、建议与拒绝后的应对
- **隐私与记忆**：默认不存储；用户明确授权后，可选保存匿名对象档案与虚拟人设

## 安装（Muse 调用 Codex CLI 的情形）

1. 将 ZIP 上传到 Muse 云服务器（或通过你已有的安全文件传输工具放到服务器）。
2. 以**实际运行 Codex 的同一个 Linux 用户**执行：

```bash
mkdir -p "$HOME/.agents/skills"
unzip muse-love-assistant-v1.1.0.zip -d "$HOME/.agents/skills/"
test -f "$HOME/.agents/skills/muse-love-assistant/SKILL.md" && echo 'Skill files installed'
python3 "$HOME/.agents/skills/muse-love-assistant/scripts/selftest.py"
```

3. 启动 Codex 并查看 `/skills`（或者在交互输入里 `$muse-love-assistant`）；若后台进程没发现，重启相应 Codex 进程。Muse 的独立路由器**不一定会自动**把聊天转发给 Codex，需要另外验证。
4. 向 Muse 发送：`请调用 $muse-love-assistant，进入 /军师。对象A说“今天又加班了”，给我三种自然回复。` 再测试 `/分析`、`/陪伴` 和 `/退出陪伴`。
5. **默认为无长期档案。** 如需记忆，先确认云服务器上的明文存储风险，再明确授权开启：`python3 .../scripts/memory.py consent on --confirm YES`。授权前不得执行。

> 注意：如果用 `sudo` 安装到了 root 的 `~/.agents/skills`，而 Codex 实际以 `hatch` 账号运行，就会“文件存在但看不到 Skill”。应该检查执行用户和 HOME，不要凭主机名字推断实际用户。

## 文件结构

```text
muse-love-assistant/
├── SKILL.md
├── README.md
├── references/
│   ├── coach.md
│   ├── analysis.md
│   ├── companion.md
│   ├── dating.md
│   └── memory-privacy.md
├── scripts/
│   ├── memory.py
│   └── selftest.py
└── assets/
    ├── demo.txt
    └── muse-install-prompt.md
```

## 命令速览

- `/军师` — 可直接复制的回复
- `/急` — 一句最佳回复
- `/分析` — 分析当前聊天记录
- `/约会` — 邀约话术或规划
- `/复盘` — 关系时间线（仅使用已授权材料）
- `/陪伴` — AI 角色陪聊
- `/退出陪伴` — 退出角色
- `/记录`、`/档案`、`/隐私` — 告知并管理存储权限

## 安全说明

该 Skill 不提供微信自动登录、二维码扫描、收发消息或第三方账号连接功能。无网络调用、无非标准 Python 依赖。`memory.py` 是**可选**脚本，不运行也能使用军师、分析、陪伴功能。存储使用未加密 SQLite，不应保存第三方原始聊天全文和身份信息。用户删除请求只影响该数据库，不保证云端备份、宿主平台日志或聊天历史同步清除。

如 Muse 平台存在自己的对话历史与记忆服务，这些由 Muse 平台独立管理；本 Skill 无法控制它们。

## 兼容性说明

标准 `SKILL.md` YAML 元数据已按照官方 Agent Skills 文档设计；**这里通过自检脚本验证功能，不代表已在你的 Muse 服务器上完成实测。** 运行版 Codex 的 Skill 加载细节与 Muse 的消息路由应在目标环境验证。

## 自动陪伴模式（v1.1）

日常闲聊默认进入 AI 陪伴；真实恋爱聊天切换到军师或分析；工作、编程、技术排错继续原有 Muse 工作流。注意：安装 Skill 本身只保证 Codex 能发现，在 Muse 层面是否自动路由还需要验证。可将 `assets/muse-global-prompt.md` 用于 Muse 的全局提示词。

如果 Muse 无法访问 ChatGPT 中的下载链接，优先通过 SSH 或服务器控制台安装，或直接粘贴单文件安装脚本的内容，不要把 ChatGPT sandbox 链接当作服务器路径。