# 剧情动画候选库（加密版）

这是一个用于 GitHub Pages 的静态网页版本。

## 安全设计

- 页面主体不会以明文提交到仓库。
- `index.html` 内只包含解锁界面和密文。
- 密钥由浏览器使用 PBKDF2-SHA-256 派生（310,000 次迭代）。
- 页面主体使用 AES-256-GCM 加密并校验完整性。
- 密码不写入仓库，也不会发送到服务器。
- “已看/未看”状态继续只保存在访问者自己浏览器的 `localStorage` 中。
- 页面包含 `noindex,nofollow,noarchive`，用于减少搜索引擎收录；它不是访问控制本身。

## 重要说明

GitHub Pages 的 URL 仍然是公开 URL。保护机制来自“没有密码就无法解密页面主体”，不是 GitHub Pages 的登录认证。

请不要把明文源网页或密码提交到公开仓库。

## GitHub Pages

仓库创建后，在 Settings → Pages 中把发布来源设为默认分支 `main` 的 `/ (root)`。
