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
