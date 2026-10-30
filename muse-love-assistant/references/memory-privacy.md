# 长期记忆、存储与隐私

## 最小权限原则
默认只使用当前会话上下文，**不自动持久保存**。第三方私人聊天属于敏感材料，只能处理用户有权分享的内容。尽量匿名化为对象 A、对象 B。不保存照片原图、电话、住址、身份证、账号密码、验证码、详细性信息或私密影像。不从微信/MCP/手机自动读取，也不向任何人发送消息。

## 本地记忆机制
可选 `scripts/memory.py`，**Python 3 标准库**，在 Muse 服务器当前 Unix 用户目录写一个 SQLite 数据库，默认 `~/.local/share/muse-love-assistant/relations.db`。这是云服务器上该用户的数据，**不是用户手机上的本地加密保险箱**。目录权限尽量 0700、文件 0600；没有提供数据库加密，拥有服务器/备份权限的管理员仍可能读取。部署前应向用户说明，必要时禁用。

持久化须两个层次的明确授权：
1. 用户明确说「开启 Muse 恋爱档案存储」或等价意思，并知道服务器侧存储后，可执行 `consent on --confirm YES`。
2. 每次新增/变更人物档案、聊天事件、人设偏好之前，用户要明确要求记录该**具体内容**。不能从“帮我分析”推断“准许保存”。

## 命令速查（从 skill 目录执行）
- `python3 scripts/memory.py status`：状态和统计，不泄露聊天正文。
- `python3 scripts/memory.py consent on --confirm YES`：仅在上述明确授权后开启。
- `python3 scripts/memory.py consent off`：禁止新写入，原始记录仍在；要删除须另行操作。
- `python3 scripts/memory.py person upsert --id A --stage 熟悉 --summary '已约过一次咖啡'`：授权后写入对象 A 的必要摘要。
- `python3 scripts/memory.py note add --person A --date 2026-10-30 --kind 邀约 --fact '双方商量周末喝咖啡' --inference '有继续了解的可能' --next '确认对方方便时间'`：只写精简事实/推测，推测与事实分栏。
- `python3 scripts/memory.py person list`、`person show --id A`：读取档案；仅为解决当前请求读取所需对象。
- `python3 scripts/memory.py companion set --name 阿星 --style '温柔风趣'`：在用户明确要求保存时写入虚拟人设。
- `python3 scripts/memory.py companion show`：读取虚拟人设；**不得**和真实对象混在一起。
- `python3 scripts/memory.py export --out /safe/path/love-export.json`：用户明确要求导出时进行，提醒导出文件是明文。
- `python3 scripts/memory.py forget --id A --confirm DELETE`：删除指定档案和事件。
- `python3 scripts/memory.py forget-all --confirm DELETE_ALL`：删除所有档案及伴侣人设并关闭存储；仅在用户明确要求时。

数据库无图片采集、无账号登录和网络请求；忘记操作无法清除之前的系统备份、外部模型日志或聊天历史。不得宣称彻底消失。用户要求删除聊天产品记忆时，应解释 Skill 存储和平台记忆/聊天记录是不同系统。

## 复盘提取
只在授权下读取 `person show` 的简要事实和事件；如时间线不足，说明覆盖范围。不得自动把陪伴模式中的虚构内容写入真实关系的事实表。
