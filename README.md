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
bun run verify     # 跑验收（38 项 txt + 45 项 epub + 640 份演示模式文件）
bun run verify:decoy   # 只跑演示模式：括号配对、空块、重名方法、行数对齐等
bun run icons      # 从 public/MioNovel.png 重新生成全套图标（favicon / PWA / apple-touch）
bun run logo       # 从同一张原图派生界面用的小图（logo-64 / logo-192 / favicon.svg）
```

## 用法

拖一个或多个文件到窗口任意位置，或者点「导入」。支持：

- **txt** — 自动识别 UTF-8 / UTF-16 / GB18030（含 GBK、GB2312）/ Big5 / Shift_JIS 等编码；
  分章按中文小说、英文小说、纯数字标题逐级尝试，都不像就按约 3000 字分段。
- **epub** — 读 OPF 元数据、目录（nav.xhtml 和 toc.ncx 都认）、封面；正文里的图片抽出来一起存，
  书自带的样式会被剥掉，排版统一跟主题走。SVG 包 `image` 的整页封面会转成普通 `<img>`；
  中日对照这类双语书（次要语言段落用弱化样式排版）会被自动识别，
  阅读设置里可以切换「对照 / 只看译文 / 只看原文」。

导入之后觉得分章或者编码不对，点书卡片右上角的「⋯」→ 解析设置，改完原地重新解析，
**不需要重新导入**（原始文件一直留着）。epub 没有可调项，但解析器更新之后（脚注、封面、
双语标记这类改进）也能在同一个地方重跑一遍，不用删了重导。

阅读器里：点正文中间显示/隐藏工具栏，翻页模式下点左右两侧翻页、滚轮和触控板也翻页，
窗口够宽时一屏并排两页（放不下就退回单页居中），`←` `→` 翻章，`t` 开目录，
`Esc` 关面板，`f` 全屏。

## 编辑器主题

主题列表里的 **VS Code 暗 / VS Code 亮** 不只是换配色：选中之后整个应用变成编辑器
——书架换成资源管理器（书是文件夹、章是文件），首页不再显示封面，正文按代码排版
（行号、对话与标题的语法配色、右侧缩略图），下面一条状态栏。

打开时是工作区首页，不会自动翻进某本小说：左边是整棵树，点书名或章节才开始读。
点进章节会进阅读器，阅读器的左侧同样是**整个书架**（可以直接换到另一本），
树底下有一行「回书架」。面包屑的第一节也是回首页的出口。读的是正文，
图不渲染——封面、卷首插图、正文插图都会写成一行 `![插图](./OEBPS/Images/pic.png)`，
说明这里原本有一张图、它的原始路径是什么。

编辑器形态下能用的：活动栏切「资源管理器 / 搜索」、点已选中的图标收起侧栏、`t` 开关侧栏、
标签页记录这次会话开过的章、点或拖缩略图跳位置、状态栏上的全书进度与上下章、
本章字数 / 全书字数、`TXT` 编码这类信息都在状态栏右下角。上下章在状态栏常驻，
不用翻到章末才找得到。右侧缩略图写的是**正文本身**（压到 3px 的字），
不是一个占位的色块。

选中这套主题时会顺带把阅读设置调成它自带的一套（等宽、不缩进、段间距 0），
之后就完全按你自己的设置走。颜色是从 VS Code 的 Dark Modern / Light Modern 与
Dark+ / Light+ 的 token 表里抄的，不是照着感觉调的——配套约束见 [docs/SPEC.md](docs/SPEC.md) 五 5.4。

### 演示模式（Alt+Q）

按 `Alt+Q`，或者从标题栏的 ☰ 菜单、阅读设置里的「演示模式」打开，整个窗口换成一份**看着像真的**
源文件：书名变仓库名、章节变文件名、每一段正文变成文件里的一行，状态栏是 `Ln 171, Col 26` /
`TypeScript React` / `Spaces: 2`，浏览器标签页的标题和图标也一起换。再按一次原样回来。

八种语言可选（在阅读设置里）：Java · Spring Boot、C# · ASP.NET Core、Python · Django、
C++ · CMake、React · TypeScript、Vue 3 单文件组件、Go、Rust。每种生成的都是一份**结构完整的文件**：
文件头（package / using / import）、类型声明、若干方法或组件、结尾的收尾行；
文件名和文件里的类名/组件名同源，所以 `CatalogService.java` 里的类就叫 `CatalogService`。
语法高亮交给 highlight.js（按需加载，只在演示模式用），颜色由主题的 token 变量给出。

开关会记住（存在 `mionovel:decoy`），下次打开还在。它不改任何数据，只改显示。

右侧缩略图跟着一起换——它写的是屏幕上真实显示的那份内容，所以演示模式下也是代码。

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
  components/
    shelf/          书架卡片、书详情面板
    reader/         正文视图（滚动/翻页）、工具栏、目录、阅读设置
    code/           编辑器形态的外壳：窗口/资源管理器/搜索/缩略图/正文预览
    ui/             手写基础件：Button / Slider / Switch / Panel / Dialog /
                    Select / Toast / Logo / icons
  hooks/            取书、取章、主题、快捷键、拖拽、翻页测量、淡出用的 presence
  lib/              纯函数：进度换算、格式化、className 拼接、
                    正文的代码标签（code.ts）
  styles/           app.css（Tailwind、主题 token、动效工具类）content.css（正文排版）
                    code.css（编辑器形态）
docs/SPEC.md        设计决定与理由 —— 动手改之前先看它
scripts/            样例生成、验收脚本、标识派生
public/             MioNovel.png（标识原图）与由它生成的图标
```

## 几个不能随便改的地方

- **主题只能通过注册表加**。往 `themes/builtin.ts` 里加一条数据就行；不要在组件里写死颜色，
  也不要在 CSS 里为某个主题写选择器。所有颜色都是 `:root[data-theme=…]` 上的变量，
  组件只认 `bg-bg` / `text-fg-muted` 这类工具类。破了这条，换主题就会只换一半。
- **界面形态也由主题声明，组件不许认主题 id**。`chrome: 'code'` 的主题走编辑器外壳，
  组件读 `useChrome()`，样式只挂在 `.mn-code` 类上。要判断「这是不是编辑器形态」，
  永远看这个标志，不要写 `themeId === 'vscode'`——那样再加一套编辑器主题就得改一遍组件。
- **编辑器形态下的正文只贴标签、不写字**。`lib/code.ts` 给段落贴 `mn-tok-*` / `mn-code-line`，
  颜色在 `styles/code.css` 里从 `--mn-code-*` 取。别往正文里插原文没有的记号（`//`、`def` 之类），
  也别在 JS 里写死颜色。唯一的例外是图片：它写成一行 `![](./原图路径)`——图不渲染，
  那行就是「这里有一张图」。分好的类名要能被 `content.css` 的排版规则继续管着
  （一套排版管两种形态）。
- **演示模式的名字必须同源**。`lib/decoy.ts` 里文件名和文件里的类名都从同一个 `Ctx`
  （`makeCtx(preset, seed)`）推出来，而 `seed` 由 `decoySeed(bookId, chapterIndex)` 统一给出——
  目录树、标签页、正文三处必须传同一个。各自哈希一遍的后果是 `ReportMapper.java` 里写着
  `class CatalogService`，那是懂代码的人一眼就看得出的假。加语言时照这个约定加：文件名的推法、
  文件头（`preamble` / `open` / `fields` 都是「组」，要么整段写进去、要么整段不写）、
  块、收尾、单行填充，然后跑 `bun run verify:decoy`。
- **演示模式生成的是纯文本，不是带颜色的 HTML**。上色统一交给 highlight.js
  （`lib/highlight.ts`，按行 tokenize，颜色映射见 `styles/code.css` 的 `.hljs-*` 一段）。
  别在模板里手写颜色——自己写一套 token 规则既不准也维护不动。
- **代码的缩进靠 `white-space: pre-wrap`**（`.mn-content--code`）。HTML 默认把行首空白折掉，
  少了那一条，生成得再对也会平铺到左边——一眼假。这条和上面那条是一对，改一个要看另一个。
- **动效只用 `--mn-dur-*` 和 `mn-*` 那几个工具类**（见 `styles/app.css`），不要在组件里现编毫秒数或
  新写一套 keyframes。新加一种「出场感」之前先看现有的四条能不能复用；所有动画都要能被
  `prefers-reduced-motion` 压掉——那条 `@media` 块不能删。
- **翻页模式下别给 `.mn-content` 加位移/缩放动画**。`transform` 是翻页的地盘（translateX 表示当前页），
  两条动画抢同一个属性会让翻页一顿一顿的——所以换章的淡入在翻页模式只动 `opacity`。
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
- **翻页模式的 `.mn-frame--paged` 一屏裁剪窗口不能拆**。桌面宽窗口下正文栏宽远小于视口，
  没有它 translateX 之后上一页和下一页会同时露在两侧；宽度和中缝必须是整数，多列布局的可见列数是
  `floor((容器宽 + 中缝) ÷ (列宽 + 中缝))`，差一个像素就少算一列。整页插图也依赖 `--mn-page-height`
  限高 + 翻页模式下去掉垂直边距，否则图会被挤去下一列，当前页变成空白页。
- **滚动模式进章时的位置恢复，只在版面变了的时候重写 `scrollTop`，读者一动手就停**。
  重写同一个位置没有别的作用，只会把读者刚滚走的位置拽回来——症状是「章首往下滚突然回弹、
  章末往上滚被拽回章末」。
- **`bun run verify` 必须过**。它覆盖的是最容易悄悄坏掉的部分：编码识别、分章、目录归并、
  图片路径重写、净化、锚点落点。没有 CI，这个脚本就是回归防线。
- **锚点 id 必须带 `mn-` 前缀**（解析时统一加，链接侧同前缀重写）。不加的话真实浏览器里
  DOMPurify 会按 DOM clobbering 把 `id="target"`、`id="name"` 这类删掉，脚注就跳不到位置了；
  happy-dom 下它是空转的，验收脚本看不出来，所以这条只能靠约定守住。

## 还没做的

书签与标注（`bookmarks` 表已经建好）、全文搜索、mobi / azw3 / fb2（加一个 `BookParser` 实现即可）、
云同步、划词翻译与朗读、图文型 epub 的原始版式、主题编辑器 UI（现在用自定义 CSS 兜着）。

## 设计与取舍

完整的理由在 [docs/SPEC.md](docs/SPEC.md)：为什么不用 epub.js、为什么数据要分四张表、
为什么主题是一张生成的样式表、编码检测踩过哪些坑、翻页模式的测量为什么要重试。
