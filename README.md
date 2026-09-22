# MioNovel

把散在硬盘上的小说（txt / epub）拖进浏览器，变成一个能离线读、能换主题的书架。

文件不上传，全部存在本机浏览器的 IndexedDB 里，装成 PWA 之后断网也能读。

## 跑起来

```bash
bun install
bun run dev        # http://localhost:5179
```

其它命令：

```bash
bun run build      # 生产构建（含 Service Worker）
bun run preview    # 预览构建产物
bun run typecheck  # tsc --noEmit
bun run samples    # 生成验收用的样例文件到 samples/
bun run verify     # 跑解析器验收（txt + epub）
bun run icons      # 从 public/logo.svg 重新生成全套图标
```

## 用法

拖一个或多个文件到窗口任意位置，或者点「导入」。支持：

- **txt** — 自动识别 UTF-8 / UTF-16 / GB18030（含 GBK、GB2312）/ Big5 / Shift_JIS 等编码；
  分章按中文小说、英文小说、纯数字标题逐级尝试，都不像就按约 3000 字分段。
- **epub** — 读 OPF 元数据、目录（nav.xhtml 和 toc.ncx 都认）、封面；正文里的图片抽出来一起存，
  书自带的样式会被剥掉，排版统一跟主题走。

导入之后觉得分章或者编码不对，点书卡片右上角的「⋯」→ 解析设置，改完原地重新解析，
**不需要重新导入**（原始文件一直留着）。

阅读器里：点正文中间显示/隐藏工具栏，翻页模式下点左右两侧翻页，`←` `→` 翻章，
`t` 开目录，`Esc` 关面板，`f` 全屏。

## 目录结构

```
src/
  parsers/          解析层：把文件变成归一化的「章」列表
    types.ts        BookParser 接口——加格式只需要写一个实现
    registry.ts     按 magic bytes 判定格式，按需加载对应的解析器
    txt/            编码检测（encoding）→ 分章判定（chapters）→ 流式解析（parse）
    epub/           解包与组装（parse）、包文档（opf）、目录（toc）、
                    封面回退链（cover）、路径解析（paths）、净化与重写（html）
  db/               Dexie schema 与所有数据访问
  themes/           主题注册表、内置主题、样式表生成
  store/            zustand：阅读设置（持久化）、导入队列（内存）
  components/       shelf/（书架）reader/（阅读器）ui/（五个手写基础组件）
  hooks/            取书、取章、主题、快捷键、拖拽、翻页测量
  lib/              纯函数：进度换算、格式化、className 拼接
  styles/           app.css（Tailwind 与主题 token）content.css（正文排版）
docs/SPEC.md        设计决定与理由 —— 动手改之前先看它
scripts/            样例生成与验收脚本
```

## 几个不能随便改的地方

- **主题只能通过注册表加**。往 `themes/builtin.ts` 里加一条数据就行；不要在组件里写死颜色，
  也不要在 CSS 里为某个主题写选择器。所有颜色都是 `:root[data-theme=…]` 上的变量，
  组件只认 `bg-bg` / `text-fg-muted` 这类工具类。破了这条，换主题就会只换一半。
- **`parsers/epub/html.ts` 里的 `scrubDocument()` 不能删**，也别把安全性完全交给 DOMPurify。
  实测 DOMPurify 在某些 DOM 实现下（比如 happy-dom）会静默什么都不做——连 `<script>` 都不删。
  我们用 `innerHTML` 注入正文，所以危险标签和 `on*` 属性必须由自己那层删掉。
- **解析器不要直接碰 Dexie**，一切通过 `ParseSink` 交出去。这是「30MB 的 txt 峰值内存只有单章」
  的前提：一旦解析器自己把全书留在数组里，大文件就会把标签页撑爆。
- **别用 localStorage 存书或章节**。localStorage 只能放字符串且有 5MB 上限，
  书和章节一律进 IndexedDB；localStorage 只有阅读设置（几百字节）在用。
- **进度只存「章序号 + 章内比例」**，不要引入 CFI 之类的格式专属定位。
  现在滚动和翻页、txt 和 epub 共用同一套进度模型，所以切换阅读模式或重新解析都不会让进度错位。
- **正文不要塞进 iframe**。iframe 里拿不到外层的 CSS 变量，主题要么注入第二份、要么维护两套——
  koodo-reader 就是那样，加一个可主题化的界面就要改两个仓库。我们用净化 + 作用域 CSS 拿到隔离。
- **`ReaderView.tsx` 里翻页模式的测量不能去掉失败保护**。容器宽度还没就位时量出来的页宽会把正文挤成一条窄柱，
  页数暴涨，而且因为没有尺寸变化，`ResizeObserver` 之后不会来纠正——必须重试到量成功为止。
- **`bun run verify` 必须过**。它覆盖的是最容易悄悄坏掉的部分：编码识别、分章、目录归并、
  图片路径重写、净化。没有 CI，这个脚本就是回归防线。

## 还没做的

书签与标注（`bookmarks` 表已经建好）、全文搜索、mobi / azw3 / fb2（加一个 `BookParser` 实现即可）、
云同步、划词翻译与朗读、图文型 epub 的原始版式、主题编辑器 UI（现在用自定义 CSS 兜着）。

## 设计与取舍

完整的理由在 [docs/SPEC.md](docs/SPEC.md)：为什么不用 epub.js、为什么数据要分四张表、
为什么主题是一张生成的样式表、编码检测踩过哪些坑、翻页模式的测量为什么要重试。
