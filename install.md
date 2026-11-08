# 页间 · 安装说明

一个贴链接就能把文章读成「导图 + 要点 + 逐段精读 + 读后评论」的 DeepSeek Harness 插件。

## 需要什么

- DeepSeek Harness（桌面版或 Web 版都行）
- 已经配置好的模型（插件用 Harness 当前的默认模型，不另外要 key）
- 生成导图需要本机装了 **Microsoft Edge**（Windows 自带；macOS 可装 Edge，或把 `lib/mindmap.js` 里的浏览器路径改成 Chrome）

## 安装

### 方式一：命令行（推荐）

```sh
dsh plugin --profile <你的 profile> add https://github.com/Edsenpai/page-between
```

装完重启 Harness，侧栏出现「页间」。

### 方式二：手动登记

1. 把仓库克隆或下载到一个**固定的位置**，例如：

   - Windows：`C:\Users\<你>\.dsh\plugins\page-between`
   - macOS：`~/.dsh/plugins/page-between`

   不要放在会被清理的临时目录。

2. 找到你的 profile 目录（默认 `~/.dsh/profiles/desktop`），编辑其中的 `package.json`：

   ```json
   {
     "dependencies": {
       "dsh-page-between": "link:C:/Users/<你>/.dsh/plugins/page-between"
     },
     "dsh": {
       "profile": {
         "bundles": [
           "dsh-page-between"
         ]
       }
     }
   }
   ```

   要点：

   - `dependencies` 里用 `link:` 加**绝对路径**（macOS 用 `link:/Users/<你>/.dsh/plugins/page-between`）
   - `dsh.profile.bundles` 里加上同一行，顺序排在其他 UI 插件后面
   - 只加这一个包，**不要动原有的其它行**

3. 重启 Harness。第一次打开是干净的：一张使用指南便签 + 一个搜索框。

## 更简单的办法：让 AI 帮你装

对 Harness 说：

> 把 https://github.com/Edsenpai/page-between 装到当前 profile，装完重载。

它会自己改配置、重载，比手改 JSON 稳。

## 怎么用

1. 贴一个文章链接，回车
2. 约 2 秒后正文和结构导图先出来，解读随后补上
3. 框选任意一句 →「收进便签」，便签可以拖、可以缩放、可以改字
4. 底部输入框可以就这篇文章继续追问（涉及文章外的事实会联网查）
5. 文末「导出到 Notion」一键复制 Notion 版
6. 便签多了以后，用便签区上方的「整理」回到网格、「总览」搜索全部便签

右上角 `简 / 繁 / EN` 可以切换解读语言（会重新生成，每种语言独立缓存）。

## 已知限制

- 需要登录或强反爬的站点可能取不到正文，会明确提示
- 导图渲染依赖本机浏览器（Edge/Chrome），没有的话导图会缺失，其余功能正常
- 解读由模型生成，30–70 秒，取决于文章长度和输出长度

## 隐私

所有数据都在本机：文章内容、解读、便签存在本地（浏览器 localStorage + 临时目录）。除了调用你自己配置的模型（以及可选的联网检索），不上传到别处。
