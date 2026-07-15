# NeCode Desktop 七牛发布上传设计

## 目标

在 NeCode Desktop 的 GitHub Release 附件上传成功后，把同一批桌面安装包上传到七牛云 `downloads/` 目录，并刷新对应 CDN URL。

本次不修改 Windows 签名流程。Windows 包保持现有构建状态，macOS 继续使用现有签名和公证流程。

## 发布流程

`desktop-package.yml` 的 `publish-release` job 继续负责汇总 Windows 和 macOS 构建产物。现有 `gh release upload` 成功后执行七牛上传：

1. 从 `release-assets` 读取 `.exe` 和 `.dmg` 文件。
2. 逐个上传到 `<bucket>/downloads/<filename>`。
3. 收集 `https://dl.inoteexpress.com/downloads/<filename>` URL。
4. 所有文件上传成功后刷新这些 CDN URL。
5. 任一上传或 CDN 刷新失败时，以非零状态结束 workflow。

七牛上传不重新下载 GitHub Release 附件，确保 GitHub Release 和七牛使用同一份本地产物。

## 配置

敏感凭据使用 GitHub Actions Secrets：

- `QINIU_ACCESS_KEY`
- `QINIU_SECRET_KEY`

非敏感配置使用 GitHub Actions Variables：

- `QINIU_BUCKET`，当前值为 `aegean-ne`
- `QINIU_PREFIX`，当前值为 `downloads`
- `QINIU_CDN_BASE`，当前值为 `https://dl.inoteexpress.com/downloads/`

上传脚本必须通过环境变量读取这些配置。仓库、日志和 workflow 中不得包含真实七牛密钥。

## 上传脚本

仓库内新增一个 Python 脚本，使用七牛官方 Python SDK。脚本接收待上传目录，递归读取普通文件，并保留相对于输入目录的路径。

对象 Key 由 `QINIU_PREFIX` 和相对路径组成。对于当前平铺的 `release-assets`，结果为：

```text
downloads/necode-desktop-windows-x64.exe
downloads/necode-desktop-macos-arm64.dmg
```

脚本在开始上传前验证目录、环境变量和候选文件。上传响应不是成功状态时立即报错。CDN 刷新响应不是成功状态时同样报错，不提供静默跳过或伪成功路径。

## Workflow 集成

`publish-release` job 在 GitHub Release 上传之后：

1. 安装固定版本的七牛 Python SDK。
2. 将 GitHub Secrets 和 Variables 注入上传步骤环境变量。
3. 调用仓库内上传脚本处理 `release-assets`。

七牛步骤只在前面的 Release 创建和附件上传成功后运行。七牛失败不会撤销已创建的 GitHub Release，但 workflow 会明确失败并保留错误日志。

## 验证

实现后进行以下验证：

- 上传脚本的语法检查。
- 使用不包含真实凭据的输入验证参数和缺失配置错误。
- 运行现有桌面 workflow 文本测试，并更新其七牛步骤断言。
- 检查 Git diff，确认没有密钥或无关文件进入提交。

真实七牛上传只能在配置新 GitHub Secrets 后通过 workflow 验证。
