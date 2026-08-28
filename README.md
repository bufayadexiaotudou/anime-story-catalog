# 剧情动画候选库（加密版）

一个用于浏览经典、剧情向动画作品的个人候选库，部署于 GitHub Pages。

## 隐私与加密

本仓库不会公开保存动画资料网页的明文内容。

- `index.html`：仅包含中文解锁界面和浏览器端解密逻辑。
- `payload-meta.json`：只保存加密参数与密文分片顺序。
- `payload-*.txt`：AES-GCM 加密后的 Base64 密文，不是动画资料明文。
- 密钥由浏览器使用 **PBKDF2-SHA-256** 派生，迭代 **310,000 次**。
- 页面主体使用 **AES-256-GCM** 加密并进行完整性校验。
- **访问密码不保存在仓库中，也不会发送到 GitHub 或其他服务器。**
- “已看 / 未看”等个人观影标记只保存在访问该网页的浏览器 `localStorage` 中，不会提交回仓库。
- 解锁页包含 `noindex,nofollow,noarchive`，用于降低搜索引擎收录概率；真正保护正文的是内容加密，而不是该标签。

## 一键换密码、重新加密并上传

仓库内已经附带 Windows 一键工具：

`tools/change-password.cmd`

它会自动完成：

1. 检查当前目录、Git 仓库和 `origin` 是否正确。
2. `git pull --ff-only` 同步最新版本。
3. 如果本机已有 `source.html`，直接使用它作为明文源网页。
4. 如果没有 `source.html`，提示输入**当前旧密码**，从仓库现有密文恢复出本机 `source.html`。
5. 隐藏输入新密码两次。
6. 使用新的随机 Salt 和 IV，以 PBKDF2-SHA-256 + AES-256-GCM 重新加密。
7. 重新生成 `payload-meta.json` 和全部 `payload-*.txt`，并删除不再需要的旧分片。
8. 立即做一次完整解密自检，确认新密文能 100% 还原 `source.html`。
9. 只暂存加密数据文件；若发现 `source.html` 或其他意外文件进入暂存区，会自动停止。
10. 自动 `git commit` 并 `git push` 到 GitHub，覆盖旧密文。GitHub Pages 更新后旧密码失效，新密码生效。

### 第一次在自己的电脑上使用

需要安装：

- Git for Windows
- Node.js 18 或更高版本

然后：

```bash
git clone https://github.com/bufayadexiaotudou/anime-story-catalog.git
cd anime-story-catalog
```

之后直接双击：

`tools/change-password.cmd`

如果本机没有 `source.html`，第一次会先询问当前旧密码来恢复明文；以后只要保留本机 `source.html`，换密码时就不再需要旧密码。

### 明文文件保护

`source.html` 已被 `.gitignore` 明确忽略，脚本还会额外检查它是否被 Git 跟踪或误加入暂存区。

**不要手动使用 `git add -f source.html`。**

如果不希望电脑长期保留明文网页，换密码完成后可以删除 `source.html`。下次运行工具时，再使用届时的旧密码从密文恢复即可。

### 只生成、不上传（可选）

如果希望先检查文件，不立即提交和推送：

```bash
node tools/change-password.mjs --no-push
```

该模式会生成并暂存新密文，但不执行 `git commit` 和 `git push`。

## 访问模型

GitHub Pages 地址本身仍是公开 URL，因此知道地址的人都可以打开“输入密码”的页面。

但是在不知道密码的情况下，公开仓库和 GitHub Pages 只能取得解锁代码、加密参数和密文，无法直接读取动画候选库正文。

## GitHub Pages 发布

在仓库中进入：

`Settings → Pages → Build and deployment → Source: Deploy from a branch`

然后选择：

- Branch：`main`
- Folder：`/ (root)`

保存后，站点地址为：

`https://bufayadexiaotudou.github.io/anime-story-catalog/`

## 注意

不要把原始明文网页、解密后的 HTML 或访问密码提交到这个公开仓库。
