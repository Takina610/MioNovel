/**
 * 环境声明。
 *
 * Bun 在运行时提供 `import.meta.dir`（当前文件所在目录的绝对路径），
 * 但它的类型定义来自 @types/bun——为了两个构建脚本装一整套类型不划算，
 * 这里按实际用到的范围声明一下。
 *
 * 这个文件里没有任何 import / export，所以它是全局脚本，
 * 下面的 interface 会和全局的 ImportMeta 合并。
 */
interface ImportMeta {
  dir: string
}
